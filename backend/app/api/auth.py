import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token
from app.core.database import get_db
from app.models.user import User
from app.models.installation import Installation

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

GITHUB_API = "https://api.github.com"


@router.get("/github/login")
async def github_login():
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&scope=repo,read:org,workflow"
    )
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    # Exchange code for token
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        data = resp.json()
        if "access_token" not in data:
            raise HTTPException(status_code=400, detail=f"GitHub OAuth failed: {data}")
        github_token = data["access_token"]

    # Fetch user profile
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/user",
            headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
        )
        resp.raise_for_status()
        gh_user = resp.json()

    # Upsert user
    result = await db.execute(select(User).where(User.github_id == gh_user["id"]))
    user = result.scalar_one_or_none()

    if user:
        user.github_access_token = github_token
        user.username = gh_user["login"]
        user.avatar_url = gh_user.get("avatar_url")
        user.email = gh_user.get("email")
    else:
        user = User(
            github_id=gh_user["id"],
            username=gh_user["login"],
            email=gh_user.get("email"),
            avatar_url=gh_user.get("avatar_url"),
            github_access_token=github_token,
        )
        db.add(user)

    await db.flush()

    installation = await _find_or_sync_installation(
        db=db,
        github_token=github_token,
        account_login=gh_user["login"],
    )
    if installation:
        user.installation_id = installation.installation_id

    await db.flush()
    await db.refresh(user)

    jwt_token = create_access_token({"sub": str(user.id), "github_id": user.github_id})
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={jwt_token}")


@router.get("/me")
async def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_from_token(credentials, db)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "github_id": user.github_id,
        "app_installed": user.installation_id is not None,
        "installation_id": user.installation_id,
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await _get_user_from_token(credentials, db)


async def _get_user_from_token(credentials, db) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == int(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.installation_id:
        installation = await _find_or_sync_installation(
            db=db,
            github_token=user.github_access_token,
            account_login=user.username,
        )
        if installation:
            user.installation_id = installation.installation_id
            await db.commit()
            await db.refresh(user)

    return user


async def _find_or_sync_installation(
    db: AsyncSession,
    github_token: str,
    account_login: str,
) -> Installation | None:
    inst_result = await db.execute(
        select(Installation).where(
            Installation.account_login == account_login,
            Installation.suspended == False,  # noqa: E712
        )
    )
    installation = inst_result.scalar_one_or_none()
    if installation:
        return installation

    github_installation = await _get_github_installation(github_token, account_login)
    if not github_installation:
        return None

    account = github_installation.get("account", {})
    installation_id = github_installation["id"]
    result = await db.execute(
        select(Installation).where(Installation.installation_id == installation_id)
    )
    installation = result.scalar_one_or_none()

    if installation:
        installation.account_login = account.get("login", account_login)
        installation.account_type = account.get("type", "User")
        installation.account_avatar_url = account.get("avatar_url")
        installation.suspended = False
    else:
        installation = Installation(
            installation_id=installation_id,
            account_login=account.get("login", account_login),
            account_type=account.get("type", "User"),
            account_avatar_url=account.get("avatar_url"),
            suspended=False,
        )
        db.add(installation)

    await db.flush()
    return installation


async def _get_github_installation(github_token: str, account_login: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API}/user/installations",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if resp.status_code in (401, 403, 404):
            return None
        resp.raise_for_status()

    installations = [
        installation
        for installation in resp.json().get("installations", [])
        if installation.get("app_slug") == settings.github_app_slug
    ]

    # Prefer a direct user install, but allow org installs too. GitHub returns every
    # installation this OAuth user can access, and org installs should still unlock the app.
    for installation in installations:
        account = installation.get("account", {})
        if account.get("login", "").lower() == account_login.lower():
            return installation

    return installations[0] if installations else None
