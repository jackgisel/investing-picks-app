"""Lifecycle helpers for durable background-job records."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from app.db.models import JobRun


def reap_stale_job_runs(
    db: Session,
    *,
    job_name: str,
    stale_after: timedelta,
    now: datetime | None = None,
) -> int:
    """Close runs whose process disappeared before it could record an outcome.

    There is deliberately no attempt to resume a half-finished run here. The
    refresh writers are idempotent, so the safe recovery is to expose the
    abandoned run as an error and let the next scheduled/manual run start from
    the durable progress it left behind.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = now - stale_after
    minutes = stale_after.total_seconds() / 60
    detail = (
        f"Stale run reaped after exceeding the {minutes:g}-minute runtime limit; "
        "the process likely exited before recording completion."
    )
    result = db.execute(
        update(JobRun)
        .where(
            JobRun.job_name == job_name,
            JobRun.status == "running",
            # A running row without a start time cannot prove it is live, and
            # otherwise blocks the recovery path forever.
            or_(JobRun.started_at.is_(None), JobRun.started_at <= cutoff),
        )
        .values(status="error", detail=detail, finished_at=now)
    )
    db.commit()
    return result.rowcount or 0
