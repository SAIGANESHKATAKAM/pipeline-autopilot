from sqlalchemy import String, Integer, DateTime, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    installation_id: Mapped[int] = mapped_column(Integer, index=True)

    # GitHub info
    repo_full_name: Mapped[str] = mapped_column(String(300))
    run_id: Mapped[int] = mapped_column(Integer, index=True)
    workflow_name: Mapped[str] = mapped_column(String(300))
    branch: Mapped[str] = mapped_column(String(300))
    commit_sha: Mapped[str] = mapped_column(String(100))
    commit_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Check Run (shows status on GitHub commits)
    check_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(50))  # analyzing, fixed, analyzed, error, no_logs

    # AI analysis
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_files: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list

    # Fix
    fix_pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fix_branch: Mapped[str | None] = mapped_column(String(300), nullable=True)
    fix_applied: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
