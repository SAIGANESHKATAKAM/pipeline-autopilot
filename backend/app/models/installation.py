from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Installation(Base):
    """Tracks GitHub App installations (one per user/org)."""
    __tablename__ = "installations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    installation_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    account_login: Mapped[str] = mapped_column(String(200))   # user or org name
    account_type: Mapped[str] = mapped_column(String(50))     # User or Organization
    account_avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    suspended: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
