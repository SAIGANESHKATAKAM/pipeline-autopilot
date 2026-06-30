from datetime import datetime
from app.services import github_service, ai_service


async def analyze_and_fix(
    installation_id: int,
    repo_full_name: str,
    run_id: int,
    workflow_name: str,
    branch: str,
    commit_sha: str,
    commit_message: str,
) -> dict:
    """
    Full pipeline: fetch logs → AI analysis → generate fix → open PR.
    Returns result dict with all details.
    """
    result = {
        "run_id": run_id,
        "repo": repo_full_name,
        "status": "analyzing",
        "error_summary": None,
        "root_cause": None,
        "ai_report": None,
        "affected_files": [],
        "fix_pr_url": None,
        "fix_branch": None,
        "fix_applied": False,
        "error": None,
    }

    # Step 1: Fetch logs
    logs = await github_service.get_run_logs(installation_id, repo_full_name, run_id)
    if not logs:
        failed_jobs = await github_service.get_failed_jobs(installation_id, repo_full_name, run_id)
        if failed_jobs:
            lines = []
            for job in failed_jobs:
                failed_steps = [s for s in job.get("steps", []) if s.get("conclusion") == "failure"]
                step_names = ", ".join(s["name"] for s in failed_steps)
                lines.append(f"Job '{job['name']}' failed at: {step_names}")
            logs = "\n".join(lines)
        else:
            result["status"] = "no_logs"
            result["error"] = "No logs available for this run."
            return result

    # Step 2: AI analysis
    analysis = await ai_service.analyze_pipeline_failure(
        logs=logs,
        repo_name=repo_full_name,
        workflow_name=workflow_name,
        branch=branch,
        commit_message=commit_message or "",
    )

    result["error_summary"] = analysis.get("error_summary")
    result["root_cause"] = analysis.get("root_cause")
    result["affected_files"] = analysis.get("affected_files", [])

    # Step 3: Auto-fix if confident
    if analysis.get("can_auto_fix") and analysis.get("fix_suggestions"):
        suggestion = analysis["fix_suggestions"][0]
        file_path = suggestion.get("file")
        fix_description = suggestion.get("description", "")

        if file_path:
            file_content = await github_service.get_file_content(
                installation_id, repo_full_name, file_path, ref=branch
            )
            if file_content:
                fix_result = await ai_service.generate_fix(
                    file_path=file_path,
                    file_content=file_content,
                    error_summary=analysis["error_summary"],
                    root_cause=analysis["root_cause"],
                    fix_description=fix_description,
                )
                if fix_result.get("fixed_content"):
                    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
                    fix_branch = f"autopilot/fix-run-{run_id}-{timestamp}"
                    pr_body = _build_pr_body(
                        run_id=run_id,
                        repo_full_name=repo_full_name,
                        error_summary=analysis["error_summary"],
                        root_cause=analysis["root_cause"],
                        explanation=fix_result["explanation"],
                        changes=fix_result["changes_made"],
                        commit_sha=commit_sha,
                    )
                    try:
                        fix_pr_url = await github_service.create_fix_pr(
                            installation_id=installation_id,
                            repo_full_name=repo_full_name,
                            base_branch=branch,
                            fix_branch=fix_branch,
                            file_path=file_path,
                            new_content=fix_result["fixed_content"],
                            commit_message=f"fix: auto-fix pipeline failure in run #{run_id}",
                            pr_title=f"[Pipeline Autopilot] Fix: {analysis['error_summary'][:80]}",
                            pr_body=pr_body,
                        )
                        result["fix_pr_url"] = fix_pr_url
                        result["fix_branch"] = fix_branch
                        result["fix_applied"] = True
                    except Exception as e:
                        result["error"] = f"PR creation failed: {str(e)}"

    # Step 4: Generate markdown report
    report = await ai_service.generate_report(
        repo_name=repo_full_name,
        workflow_name=workflow_name,
        branch=branch,
        error_summary=analysis.get("error_summary", ""),
        root_cause=analysis.get("root_cause", ""),
        affected_files=analysis.get("affected_files", []),
        fix_applied=result["fix_applied"],
        pr_url=result.get("fix_pr_url"),
    )
    result["ai_report"] = report
    result["status"] = "fixed" if result["fix_applied"] else "analyzed"
    return result


def _build_pr_body(
    run_id, repo_full_name, error_summary, root_cause,
    explanation, changes, commit_sha
) -> str:
    changes_list = "\n".join(f"- {c}" for c in changes) if changes else "- See diff"
    return f"""## 🤖 Pipeline Autopilot — Auto Fix

**Triggered by:** Failed workflow run [#{run_id}](https://github.com/{repo_full_name}/actions/runs/{run_id})
**Commit:** `{commit_sha[:8]}`

### ❌ What Failed
{error_summary}

### 🔍 Root Cause
{root_cause}

### ✅ What Was Changed
{explanation}

**Specific changes:**
{changes_list}

---
> This PR was automatically generated by [Pipeline Autopilot](https://github.com/marketplace/pipeline-autopilot).
> Please review carefully before merging.
"""
