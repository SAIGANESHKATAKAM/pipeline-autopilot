from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # GitHub App (for webhooks + repo access)
    github_app_id: str = "CHANGE_ME"
    github_app_private_key: str = "CHANGE_ME"
    github_webhook_secret: str = "CHANGE_ME"

    # GitHub OAuth App (for website login)
    # Same GitHub App can be used — or create a separate OAuth App
    github_client_id: str = "CHANGE_ME"
    github_client_secret: str = "CHANGE_ME"

    # AI providers
    gemini_api_key: str = "CHANGE_ME"
    openrouter_api_key: str = "CHANGE_ME"
    openrouter_model: str = "openai/gpt-4o"
    openrouter_site_url: str = "https://pipeline-autopilot-nine.vercel.app"
    openrouter_site_name: str = "Pipeline Autopilot"

    # JWT for website sessions
    jwt_secret: str = "change-this-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Frontend URL (for OAuth redirect + CORS)
    frontend_url: str = "http://localhost:5173"

    # Database
    database_url: str = "sqlite+aiosqlite:///./pipeline_autopilot.db"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"


settings = Settings()
