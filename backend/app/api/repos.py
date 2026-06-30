import httpx
from fastapi import APIRouter, Depends, HTTPException
from app.api.auth import get_current_user
from app.models.user import User
from app.services.github_service import list_repos, get_installation_token
from app.core.config import settings

router = APIRouter(prefix="/repos", tags=["repos"])
GITHUB_API = "https://api.github.com"


@router.get("")
async def get_repos(current_user: User = Depends(get_current_user)):
    """List all repos. If app is installed, fetch via installation token; else use OAuth token."""
    if current_user.installation_id:
        repos = await list_repos(current_user.installation_id)
    else:
        # Fall back to OAuth token for repos (read-only, no app features)
        repos = await _list_repos_oauth(current_user.github_access_token)

    return [
        {
            "id": r["id"],
            "full_name": r["full_name"],
            "name": r["name"],
            "private": r["private"],
            "default_branch": r.get("default_branch", "main"),
            "html_url": r["html_url"],
            "description": r.get("description"),
            "language": r.get("language"),
            "updated_at": r.get("updated_at"),
            "app_installed": current_user.installation_id is not None,
        }
        for r in repos
    ]


async def _list_repos_oauth(access_token: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        repos, page = [], 1
        while True:
            resp = await client.get(
                f"{GITHUB_API}/user/repos",
                params={"per_page": 100, "page": page, "sort": "updated"},
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            repos.extend(batch)
            page += 1
            if len(batch) < 100:
                break
        return repos


@router.get("/{owner}/{repo}/runs")
async def get_runs(
    owner: str,
    repo: str,
    status: str = "failure",
    current_user: User = Depends(get_current_user),
):
    """List GitHub Actions workflow runs for a repo."""
    token = (
        await get_installation_token(current_user.installation_id)
        if current_user.installation_id
        else current_user.github_access_token
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs",
            params={"status": status, "per_page": 20},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        resp.raise_for_status()
        runs = resp.json().get("workflow_runs", [])

    return [
        {
            "id": r["id"],
            "name": r["name"],
            "status": r["status"],
            "conclusion": r["conclusion"],
            "head_branch": r["head_branch"],
            "head_sha": r["head_sha"],
            "head_commit": r.get("head_commit", {}).get("message", ""),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "html_url": r["html_url"],
        }
        for r in runs
    ]
