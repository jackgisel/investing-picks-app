"""Worker entrypoint — APScheduler in a dedicated process (not the API)."""

from __future__ import annotations

import logging
import os
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

# Ensure apps/api is importable for shared models/services
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_API = os.path.join(_ROOT, "apps", "api")
if _API not in sys.path:
    sys.path.insert(0, _API)

from worker.jobs.runner import (
    job_auto_publish_insights,
    job_backfill_prices,
    job_backfill_snapshots,
    job_biweekly_evaluate,
    job_daily_marks,
    job_weekly_refresh,
    reap_stale_weekly_refreshes,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("worker")


def main():
    scheduler = BlockingScheduler(timezone="America/New_York")

    # A deploy can kill a job between its initial "running" commit and its
    # terminal update. Sweep on boot and periodically so that failure becomes
    # visible without waiting for an operator to press the manual button.
    reap_stale_weekly_refreshes()
    scheduler.add_job(
        reap_stale_weekly_refreshes,
        IntervalTrigger(minutes=5),
        id="stale_job_reaper",
        replace_existing=True,
    )

    # Drafts publish themselves once their review window expires. Every 15
    # minutes rather than hourly so the note lands close to the deadline an
    # admin was shown in the ops queue; the sweep is a single indexed query and
    # does nothing at all when no draft is due.
    scheduler.add_job(
        job_auto_publish_insights,
        IntervalTrigger(minutes=15),
        id="auto_publish_insights",
        replace_existing=True,
    )

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
    # Saturday 14:00 ET — after weekly_refresh (10:00) has admitted the week's
    # new universe names, so they get history on the same day they appear. Kept
    # a separate job rather than a step inside weekly_refresh: it is the long
    # pole (a full-universe fetch), and folding it in would widen the window in
    # which a redeploy kills the refresh half-done. Monday's daily_marks
    # re-scores, so new bars reach ratings within a day.
    scheduler.add_job(
        job_backfill_prices,
        CronTrigger(day_of_week="sat", hour=14, minute=0),
        id="backfill_prices",
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
            # Scheduled every 15 min (above); on demand for when you have just
            # shortened the review window and do not want to wait for the tick.
            "auto_publish_insights": job_auto_publish_insights,
            # Not on any schedule — a one-shot repair, dry run unless
            # BACKFILL_COMMIT is set.
            "backfill_snapshots": job_backfill_snapshots,
            # Scheduled weekly (above); also runnable on demand for the
            # first load, which is much larger than a weekly top-up.
            "backfill_prices": job_backfill_prices,
        }[name]()
        return

    scheduler.start()


if __name__ == "__main__":
    main()
