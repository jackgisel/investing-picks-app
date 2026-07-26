"""Worker entrypoint — APScheduler in a dedicated process (not the API)."""

from __future__ import annotations

import logging
import os
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

# Ensure apps/api is importable for shared models/services
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_API = os.path.join(_ROOT, "apps", "api")
if _API not in sys.path:
    sys.path.insert(0, _API)

from worker.jobs.runner import (
    job_backfill_prices,
    job_backfill_snapshots,
    job_biweekly_evaluate,
    job_daily_marks,
    job_weekly_refresh,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("worker")


def main():
    scheduler = BlockingScheduler(timezone="America/New_York")

    scheduler.add_job(
        job_daily_marks,
        CronTrigger(day_of_week="mon-fri", hour=18, minute=30),
        id="daily_marks",
        replace_existing=True,
    )
    scheduler.add_job(
        job_weekly_refresh,
        CronTrigger(day_of_week="sat", hour=10, minute=0),
        id="weekly_refresh",
        replace_existing=True,
    )
    # 1st and 3rd Friday 11:00 ET — but the market is shut on some Fridays
    # (Good Friday, Juneteenth, an observed 4th of July), and an evaluation
    # cycle that silently vanishes is worse than one that runs a day early.
    # So the trigger fires every weekday of an evaluation week and the job
    # itself decides which day is the real one: the last session on or before
    # the target Friday. Every other firing logs and returns immediately.
    scheduler.add_job(
        job_biweekly_evaluate,
        CronTrigger(day="1-7,15-21", day_of_week="mon-fri", hour=11, minute=0),
        id="biweekly_evaluate",
        replace_existing=True,
    )

    log.info("Worker scheduler started")
    if os.environ.get("RUN_JOB_ONCE"):
        name = os.environ["RUN_JOB_ONCE"]
        log.info("Running once: %s", name)
        {
            "daily_marks": job_daily_marks,
            "weekly_refresh": job_weekly_refresh,
            "biweekly_evaluate": job_biweekly_evaluate,
            # Not on any schedule — a one-shot repair, dry run unless
            # BACKFILL_COMMIT is set.
            "backfill_snapshots": job_backfill_snapshots,
            # Also unscheduled: loads ~14 months of daily closes so the
            # 12-month momentum factor can be computed. Idempotent.
            "backfill_prices": job_backfill_prices,
        }[name]()
        return

    scheduler.start()


if __name__ == "__main__":
    main()
