import hmac
import hashlib
import json
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from sqlalchemy import select
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.installation import Installation
from app.models.pipeline_run import PipelineRun
from app.models.user import User
from app.services.fix_service import analyze_and_fix
from app.services.github_service import create_check_run, update_check_run

router = APIRouter(prefix="/webhook", tags=["webhook"])


def _verify_signature(payload: bytes, signature: str) -> bool:
    if not settings.github_webhook_secret or settings.github_webhook_secret == "CHANGE_ME":
        return True
    expected = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives ALL GitHub App webhook events.
    Handles: installation, workflow_run
    """
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_signature(payload_bytes, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = request.headers.get("X-GitHub-Event", "")
    payload = json.loads(payload_bytes)

    # ── Installation events (user installs/uninstalls your app) ──────────
    if event == "installation":
        background_tasks.add_task(_handle_installation, payload)
        return {"message": "installation event queued"}

    # ── Workflow run completed with failure ───────────────────────────────
    if event == "workflow_run":
        action = payload.get("action")
        run = payload.get("workflow_run", {})
        if action == "completed" and run.get("conclusion") == "failure":
            background_tasks.add_task(_handle_workflow_failure, payload)
            return {"message": "analysis queued"}

    return {"message": "event ignored"}


async def _handle_installation(payload: dict):
    """Store or remove installation when user installs/uninstalls the app."""
    action = payload.get("action")
    inst = payload.get("installation", {})
    installation_id = inst.get("id")
    account = inst.get("account", {})

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Installation).where(Installation.installation_id == installation_id)
        )
        existing = result.scalar_one_or_none()

        if action in ("created", "new_permissions_accepted", "unsuspend"):
            if existing:
                existing.suspended = False
                existing.account_login = account.get("login", "")
                existing.account_avatar_url = account.get("avatar_url")
            else:
                db.add(Installation(
                    installation_id=installation_id,
                    account_login=account.get("login", ""),
                    account_type=account.get("type", "User"),
                    account_avatar_url=account.get("avatar_url"),
                    suspended=False,
                ))

        elif action == "deleted":
            if existing:
                await db.delete(existing)
            # Unlink from users
            user_result = await db.execute(
                select(User).where(User.installation_id == installation_id)
            )
            for u in user_result.scalars().all():
                u.installation_id = None

        elif action == "suspend":
            if existing:
                existing.suspended = True

        await db.commit()

        # Link installation to any existing user with same login
        if action in ("created", "new_permissions_accepted", "unsuspend"):
            user_result = await db.execute(
                select(User).where(User.username == account.get("login", ""))
            )
            matched_user = user_result.scalar_one_or_none()
            if matched_user:
                matched_user.installation_id = installation_id
                await db.commit()


async def _handle_workflow_failure(payload: dict):
    """Full flow: analyze failure → create check run → fix → update check run."""
    run_data = payload.get("workflow_run", {})
    installation_id = payload.get("installation", {}).get("id")
    repo = payload.get("repository", {})

    if not installation_id:
        return

    repo_full_name = repo.get("full_name", "")
    run_id = run_data.get("id")
    workflow_name = run_data.get("name", "Unknown Workflow")
    branch = run_data.get("head_branch", "main")
    commit_sha = run_data.get("head_sha", "")
    commit_message = run_data.get("head_commit", {}).get("message", "")

    # Check not already processed
    async with AsyncSessionLocal() as db:
        existing = await db.execute(
            select(PipelineRun).where(
                PipelineRun.run_id == run_id,
                PipelineRun.installation_id == installation_id,
            )
        )
        if existing.scalar_one_or_none():
            return

        # Create DB record
        run_record = PipelineRun(
            installation_id=installation_id,
            repo_full_name=repo_full_name,
            run_id=run_id,
            workflow_name=workflow_name,
            branch=branch,
            commit_sha=commit_sha,
            commit_message=commit_message,
            status="analyzing",
        )
        db.add(run_record)
        await db.flush()
        run_db_id = run_record.id
        await db.commit()

    # Create a Check Run on the commit — user sees "Pipeline Autopilot: Analyzing..."
    check_run_id = None
    try:
        check_run_id = await create_check_run(
            installation_id=installation_id,
            repo_full_name=repo_full_name,
            head_sha=commit_sha,
            status="in_progress",
            title="Analyzing pipeline failure...",
            summary="Pipeline Autopilot is analyzing the failure and generating a fix.",
        )
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(PipelineRun).where(PipelineRun.id == run_db_id))
            rec = r.scalar_one_or_none()
            if rec:
                rec.check_run_id = check_run_id
                await db.commit()
    except Exception:
        pass  # Check run is best-effort

    # Run full analysis
    try:
        analysis = await analyze_and_fix(
            installation_id=installation_id,
            repo_full_name=repo_full_name,
            run_id=run_id,
            workflow_name=workflow_name,
            branch=branch,
            commit_sha=commit_sha,
            commit_message=commit_message,
        )

        # Save results
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(PipelineRun).where(PipelineRun.id == run_db_id))
            rec = r.scalar_one_or_none()
            if rec:
                rec.error_summary = analysis.get("error_summary")
                rec.root_cause = analysis.get("root_cause")
                rec.ai_report = analysis.get("ai_report")
                rec.affected_files = json.dumps(analysis.get("affected_files", []))
                rec.fix_pr_url = analysis.get("fix_pr_url")
                rec.fix_branch = analysis.get("fix_branch")
                rec.fix_applied = analysis.get("fix_applied", False)
                rec.status = analysis.get("status", "analyzed")
                await db.commit()

        # Update Check Run with result
        if check_run_id:
            fix_pr_url = analysis.get("fix_pr_url")
            fixed = analysis.get("fix_applied", False)
            error_summary = analysis.get("error_summary", "Pipeline failure analyzed")
            root_cause = analysis.get("root_cause", "")

            if fixed:
                conclusion = "action_required"
                title = f"Fix PR opened: {error_summary[:60]}"
                summary = (
                    f"**Root Cause:** {root_cause}\n\n"
                    f"**Fix PR:** {fix_pr_url}\n\n"
                    "Pipeline Autopilot has opened a PR with the fix. Please review and merge."
                )
                actions = [{
                    "label": "View Fix PR",
                    "description": "Open the auto-generated fix pull request",
                    "identifier": "view_pr",
                }]
            else:
                conclusion = "neutral"
                title = f"Analyzed: {error_summary[:60]}"
                summary = (
                    f"**Root Cause:** {root_cause}\n\n"
                    "Pipeline Autopilot analyzed the failure but could not generate an automatic fix. "
                    "Please review the root cause above."
                )
                actions = []

            await update_check_run(
                installation_id=installation_id,
                repo_full_name=repo_full_name,
                check_run_id=check_run_id,
                conclusion=conclusion,
                title=title,
                summary=summary,
                text=analysis.get("ai_report", ""),
                actions=actions,
            )

    except Exception as e:
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(PipelineRun).where(PipelineRun.id == run_db_id))
            rec = r.scalar_one_or_none()
            if rec:
                rec.status = "error"
                rec.error_summary = str(e)
                await db.commit()

        if check_run_id:
            try:
                await update_check_run(
                    installation_id=installation_id,
                    repo_full_name=repo_full_name,
                    check_run_id=check_run_id,
                    conclusion="neutral",
                    title="Analysis failed",
                    summary=f"Pipeline Autopilot encountered an error: {str(e)[:200]}",
                )
            except Exception:
                pass
