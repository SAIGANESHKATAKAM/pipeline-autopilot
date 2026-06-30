import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.pipeline_run import PipelineRun
from app.services.fix_service import analyze_and_fix

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


class AnalyzeRequest(BaseModel):
    repo_full_name: str
    run_id: int
    workflow_name: str
    branch: str
    commit_sha: str
    commit_message: str = ""


@router.post("/analyze")
async def trigger_analysis(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger analysis for a failed run from the dashboard."""
    if not current_user.installation_id:
        raise HTTPException(
            status_code=400,
            detail="GitHub App is not installed. Install it first to enable AI analysis.",
        )

    existing = await db.execute(
        select(PipelineRun).where(
            PipelineRun.run_id == req.run_id,
            PipelineRun.installation_id == current_user.installation_id,
        )
    )
    run = existing.scalar_one_or_none()
    if run and run.status in ("fixed", "analyzed"):
        return {"message": "Already analyzed", "run_db_id": run.id, "status": run.status}

    if not run:
        run = PipelineRun(
            installation_id=current_user.installation_id,
            repo_full_name=req.repo_full_name,
            run_id=req.run_id,
            workflow_name=req.workflow_name,
            branch=req.branch,
            commit_sha=req.commit_sha,
            commit_message=req.commit_message,
            status="pending",
        )
        db.add(run)
        await db.flush()
        await db.refresh(run)

    run_db_id = run.id
    background_tasks.add_task(
        _run_analysis_task,
        installation_id=current_user.installation_id,
        run_db_id=run_db_id,
        req=req,
    )
    return {"message": "Analysis started", "run_db_id": run_db_id, "status": "pending"}


async def _run_analysis_task(installation_id: int, run_db_id: int, req: AnalyzeRequest):
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(PipelineRun).where(PipelineRun.id == run_db_id))
        run = result.scalar_one_or_none()
        if not run:
            return
        run.status = "analyzing"
        await db.commit()

    try:
        analysis = await analyze_and_fix(
            installation_id=installation_id,
            repo_full_name=req.repo_full_name,
            run_id=req.run_id,
            workflow_name=req.workflow_name,
            branch=req.branch,
            commit_sha=req.commit_sha,
            commit_message=req.commit_message,
        )
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(PipelineRun).where(PipelineRun.id == run_db_id))
            run = r.scalar_one_or_none()
            if run:
                run.error_summary = analysis.get("error_summary")
                run.root_cause = analysis.get("root_cause")
                run.ai_report = analysis.get("ai_report")
                run.affected_files = json.dumps(analysis.get("affected_files", []))
                run.fix_pr_url = analysis.get("fix_pr_url")
                run.fix_branch = analysis.get("fix_branch")
                run.fix_applied = analysis.get("fix_applied", False)
                run.status = analysis.get("status", "analyzed")
                await db.commit()
    except Exception as e:
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(PipelineRun).where(PipelineRun.id == run_db_id))
            run = r.scalar_one_or_none()
            if run:
                run.status = "error"
                run.error_summary = str(e)
                await db.commit()


@router.get("/runs")
async def get_all_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All pipeline runs tracked for this user's installation."""
    if not current_user.installation_id:
        return []
    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.installation_id == current_user.installation_id)
        .order_by(desc(PipelineRun.created_at))
        .limit(100)
    )
    return [_serialize(r) for r in result.scalars().all()]


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Summary stats for the dashboard."""
    if not current_user.installation_id:
        return {"total": 0, "fixed": 0, "analyzed": 0, "pending": 0, "repos": 0}

    result = await db.execute(
        select(PipelineRun).where(PipelineRun.installation_id == current_user.installation_id)
    )
    runs = result.scalars().all()
    repos = len(set(r.repo_full_name for r in runs))
    return {
        "total": len(runs),
        "fixed": sum(1 for r in runs if r.fix_applied),
        "analyzed": sum(1 for r in runs if r.status == "analyzed"),
        "pending": sum(1 for r in runs if r.status in ("pending", "analyzing")),
        "repos": repos,
    }


@router.get("/runs/{run_db_id}")
async def get_run_detail(
    run_db_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.installation_id:
        raise HTTPException(status_code=404, detail="Not found")
    result = await db.execute(
        select(PipelineRun).where(
            PipelineRun.id == run_db_id,
            PipelineRun.installation_id == current_user.installation_id,
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _serialize(run, include_report=True)


def _serialize(run: PipelineRun, include_report: bool = False) -> dict:
    data = {
        "id": run.id,
        "repo_full_name": run.repo_full_name,
        "run_id": run.run_id,
        "workflow_name": run.workflow_name,
        "branch": run.branch,
        "commit_sha": run.commit_sha,
        "commit_message": run.commit_message,
        "status": run.status,
        "error_summary": run.error_summary,
        "root_cause": run.root_cause,
        "affected_files": json.loads(run.affected_files) if run.affected_files else [],
        "fix_pr_url": run.fix_pr_url,
        "fix_branch": run.fix_branch,
        "fix_applied": run.fix_applied,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }
    if include_report:
        data["ai_report"] = run.ai_report
    return data
