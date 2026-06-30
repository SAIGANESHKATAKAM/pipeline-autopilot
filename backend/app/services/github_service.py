import time
import base64
import zipfile
import io
import httpx
from jose import jwt as jose_jwt
from app.core.config import settings

GITHUB_API = "https://api.github.com"


# ── GitHub App JWT (authenticates the app itself) ─────────────────────────

def _make_app_jwt() -> str:
    """Generate a short-lived JWT signed with the app's private key."""
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": settings.github_app_id}
    private_key = settings.github_app_private_key.replace("\\n", "\n")
    return jose_jwt.encode(payload, private_key, algorithm="RS256")


async def get_installation_token(installation_id: int) -> str:
    """Exchange app JWT for an installation access token (valid 1 hour)."""
    app_jwt = _make_app_jwt()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        return resp.json()["token"]


# ── Repo & workflow helpers ────────────────────────────────────────────────

async def list_repos(installation_id: int) -> list[dict]:
    """List all repos accessible to this installation."""
    token = await get_installation_token(installation_id)
    async with httpx.AsyncClient() as client:
        repos, page = [], 1
        while True:
            resp = await client.get(
                f"{GITHUB_API}/installation/repositories",
                params={"per_page": 100, "page": page},
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            )
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("repositories", [])
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return repos


async def get_run_logs(installation_id: int, repo_full_name: str, run_id: int) -> str:
    """Download and extract logs for a workflow run."""
    token = await get_installation_token(installation_id)
    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{repo_full_name}/actions/runs/{run_id}/logs",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        if resp.status_code == 404:
            return ""
        resp.raise_for_status()
        try:
            zf = zipfile.ZipFile(io.BytesIO(resp.content))
            logs = []
            for name in sorted(zf.namelist()):
                logs.append(f"=== {name} ===\n{zf.read(name).decode('utf-8', errors='replace')}")
            return "\n\n".join(logs)[:50000]
        except Exception:
            return resp.content.decode("utf-8", errors="replace")[:50000]


async def get_failed_jobs(installation_id: int, repo_full_name: str, run_id: int) -> list[dict]:
    """Get failed job steps for a workflow run."""
    token = await get_installation_token(installation_id)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{repo_full_name}/actions/runs/{run_id}/jobs",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        resp.raise_for_status()
        jobs = resp.json().get("jobs", [])
        return [j for j in jobs if j.get("conclusion") == "failure"]


async def get_file_content(
    installation_id: int, repo_full_name: str, path: str, ref: str = "HEAD"
) -> str | None:
    """Fetch a file's content from a repo."""
    token = await get_installation_token(installation_id)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{repo_full_name}/contents/{path}",
            params={"ref": ref},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        if data.get("encoding") == "base64":
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        return data.get("content", "")


async def create_fix_pr(
    installation_id: int,
    repo_full_name: str,
    base_branch: str,
    fix_branch: str,
    file_path: str,
    new_content: str,
    commit_message: str,
    pr_title: str,
    pr_body: str,
) -> str:
    """Create branch, commit fix, open PR. Returns PR URL."""
    token = await get_installation_token(installation_id)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    async with httpx.AsyncClient() as client:
        # Get base branch SHA
        ref_resp = await client.get(
            f"{GITHUB_API}/repos/{repo_full_name}/git/ref/heads/{base_branch}",
            headers=headers,
        )
        ref_resp.raise_for_status()
        base_sha = ref_resp.json()["object"]["sha"]

        # Create fix branch
        branch_resp = await client.post(
            f"{GITHUB_API}/repos/{repo_full_name}/git/refs",
            json={"ref": f"refs/heads/{fix_branch}", "sha": base_sha},
            headers=headers,
        )
        if branch_resp.status_code not in (201, 422):
            branch_resp.raise_for_status()

        # Get current file SHA
        file_resp = await client.get(
            f"{GITHUB_API}/repos/{repo_full_name}/contents/{file_path}",
            params={"ref": base_branch},
            headers=headers,
        )
        file_sha = file_resp.json().get("sha") if file_resp.status_code == 200 else None

        # Commit the fix
        content_b64 = base64.b64encode(new_content.encode()).decode()
        commit_payload = {
            "message": commit_message,
            "content": content_b64,
            "branch": fix_branch,
        }
        if file_sha:
            commit_payload["sha"] = file_sha

        await client.put(
            f"{GITHUB_API}/repos/{repo_full_name}/contents/{file_path}",
            json=commit_payload,
            headers=headers,
        )

        # Open PR
        pr_resp = await client.post(
            f"{GITHUB_API}/repos/{repo_full_name}/pulls",
            json={"title": pr_title, "body": pr_body, "head": fix_branch, "base": base_branch},
            headers=headers,
        )
        pr_resp.raise_for_status()
        return pr_resp.json()["html_url"]


# ── Check Runs API ─────────────────────────────────────────────────────────

async def create_check_run(
    installation_id: int,
    repo_full_name: str,
    head_sha: str,
    name: str = "Pipeline Autopilot",
    status: str = "in_progress",
    title: str = "Analyzing failure...",
    summary: str = "",
) -> int:
    """Create a Check Run on a commit. Returns check_run_id."""
    token = await get_installation_token(installation_id)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{repo_full_name}/check-runs",
            json={
                "name": name,
                "head_sha": head_sha,
                "status": status,
                "output": {"title": title, "summary": summary},
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def update_check_run(
    installation_id: int,
    repo_full_name: str,
    check_run_id: int,
    conclusion: str,       # success, failure, neutral, action_required
    title: str,
    summary: str,
    text: str = "",
    actions: list | None = None,
) -> None:
    """Update a Check Run with final result."""
    token = await get_installation_token(installation_id)
    payload = {
        "status": "completed",
        "conclusion": conclusion,
        "output": {"title": title, "summary": summary, "text": text},
    }
    if actions:
        payload["actions"] = actions

    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{GITHUB_API}/repos/{repo_full_name}/check-runs/{check_run_id}",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
