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

from app.db.migrations import ensure_schema
from app.db.session import engine

from worker.jobs.runner import (
    job_auto_publish_insights,
    job_backfill_prices,
    job_backfill_snapshots,
    job_biweekly_evaluate,
    job_daily_marks,
    job_dca_backfill,
    job_dca_friday,
    job_market_note_prepare,
    job_market_note_send,
    job_news_refresh,
    job_performance_alerts,
    job_weekly_refresh,
    job_weekly_review_draft,
    job_weekly_review_publish,
    job_weekly_summary,
    job_x_thread_draft,
    job_macro_refresh,
    job_x_thread_market_draft,
    job_x_thread_post,
    job_x_thread_spotlight_draft,
    job_x_thread_sunday_draft,
    reap_stale_weekly_refreshes,
    sweep_ops_alerts,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("worker")


def main():
    # Either process can be first up after a deploy, and the alert sweep below
    # reads a column `create_all` will not add to an existing table.
    ensure_schema(engine)

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

    # A failed job used to sit in the table waiting for someone to open the ops
    # page. Same tick as the reaper, and deliberately after it, so a run the
    # reaper just declared abandoned is alerted on this pass rather than the
    # next one. Unrated holdings are recorded first so a gap the re-score just
    # created is mailed on this tick rather than the next.
    sweep_ops_alerts()
    scheduler.add_job(
        sweep_ops_alerts,
        IntervalTrigger(minutes=5),
        id="job_failure_alerts",
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
    # Friday 10:00 PT — draft the weekly portfolio review for admin confirm.
    # Pacific, not the scheduler's default ET, so the two-hour window before
    # noon PT does not slide with daylight-saving relative to New York.
    scheduler.add_job(
        job_weekly_review_draft,
        CronTrigger(
            day_of_week="fri",
            hour=10,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="weekly_review_draft",
        replace_existing=True,
    )
    # Friday 12:00 PT — publish and email if confirmed; skip and tell the
    # admins if not. The claim is on the insight row, not this schedule.
    scheduler.add_job(
        job_weekly_review_publish,
        CronTrigger(
            day_of_week="fri",
            hour=12,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="weekly_review_publish",
        replace_existing=True,
    )
    # Saturday 10:00 PT — open the coming week's Market Note and nag if nothing
    # is ready. Two days of runway before the Monday send, and the web app only
    # mails the reminder when there is actually nothing confirmed.
    scheduler.add_job(
        job_market_note_prepare,
        CronTrigger(
            day_of_week="sat",
            hour=10,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="market_note_prepare",
        replace_existing=True,
    )
    # Monday 06:00 PT — the free Market Note goes out before the US open, which
    # is the point of a Monday note. Pacific for the same daylight-saving reason
    # as the weekly review. Unconfirmed weeks are skipped, not sent.
    scheduler.add_job(
        job_market_note_send,
        CronTrigger(
            day_of_week="mon",
            hour=6,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="market_note_send",
        replace_existing=True,
    )
    # Weekdays 19:00 ET — after daily_marks (18:30) has repriced the book, so a
    # milestone is measured against the session's close rather than yesterday's.
    scheduler.add_job(
        job_performance_alerts,
        CronTrigger(day_of_week="mon-fri", hour=19, minute=0),
        id="performance_alerts",
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
    # Weekdays 18:45 ET — after daily_marks (18:30) has written Friday closes
    # and scores, so the sample books fill against the session that just ended.
    # The job itself decides whether today is this week's Friday session
    # (holiday Fridays move to Thursday).
    scheduler.add_job(
        job_dca_friday,
        CronTrigger(day_of_week="mon-fri", hour=18, minute=45),
        id="dca_friday",
        replace_existing=True,
    )

    # Friday 10:30 PT — half an hour after the weekly review draft, so the
    # thread is written against the same week's facts and an admin reviews both
    # in one sitting. Drafting only; nothing reaches the timeline from here.
    scheduler.add_job(
        job_x_thread_draft,
        CronTrigger(
            day_of_week="fri",
            hour=10,
            minute=30,
            timezone="America/Los_Angeles",
        ),
        id="x_thread_draft",
        replace_existing=True,
    )
    # Tuesday 09:00 PT — the market-and-sectors thread, deliberately off the
    # Friday cycle so the account is not silent for six days and loud for one.
    scheduler.add_job(
        job_x_thread_market_draft,
        CronTrigger(
            day_of_week="tue",
            hour=9,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="x_thread_market_draft",
        replace_existing=True,
    )
    # Weekdays 06:00 PT — half an hour ahead of the spotlight draft, so a
    # headline pulled this morning is available for it to write about.
    scheduler.add_job(
        job_news_refresh,
        CronTrigger(
            day_of_week="mon-fri",
            hour=6,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="news_refresh",
        replace_existing=True,
    )
    # Weekdays 06:30 PT — half an hour ahead of the first post-check tick, so
    # a spotlight drafted today has a chance of being confirmed before it.
    # Alternates candidate/sector on its own (see `pickSpotlightIndex`); this
    # Sunday 16:00 PT — macro pull, then the week-ahead draft ninety minutes
    # later. Sunday rather than Monday morning because the thread argues about
    # a week that has not started, and the econ calendar for it is published
    # well before the Sunday close.
    scheduler.add_job(
        job_macro_refresh,
        CronTrigger(
            day_of_week="sun",
            hour=16,
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="macro_refresh",
        replace_existing=True,
    )
    # Sunday 17:30 PT — late enough that an admin reading it still has the
    # evening to confirm before futures open, early enough that they are not
    # editing a thread at midnight.
    scheduler.add_job(
        job_x_thread_sunday_draft,
        CronTrigger(
            day_of_week="sun",
            hour=17,
            minute=30,
            timezone="America/Los_Angeles",
        ),
        id="x_thread_sunday_draft",
        replace_existing=True,
    )
    # is just "run every weekday morning."
    scheduler.add_job(
        job_x_thread_spotlight_draft,
        CronTrigger(
            day_of_week="mon-fri",
            hour=6,
            minute=30,
            timezone="America/Los_Angeles",
        ),
        id="x_thread_spotlight_draft",
        replace_existing=True,
    )
    # Hourly, weekdays 07:00–17:00 PT. A thread goes out on the first tick
    # after an admin confirms it, so confirming is the act that publishes and
    # the schedule is only how long you might wait. Ticks with nothing
    # confirmed do one indexed query and return.
    scheduler.add_job(
        job_x_thread_post,
        CronTrigger(
            day_of_week="mon-fri",
            hour="7-17",
            minute=0,
            timezone="America/Los_Angeles",
        ),
        id="x_thread_post",
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
            # Scheduled Friday 10:00 / 12:00 PT. On-demand for a first send
            # or after fixing a draft. weekly_summary is a leftover alias for
            # the noon publish so an old RUN_JOB_ONCE still does something.
            "weekly_review_draft": job_weekly_review_draft,
            "weekly_review_publish": job_weekly_review_publish,
            "weekly_summary": job_weekly_summary,
            "market_note_prepare": job_market_note_prepare,
            "market_note_send": job_market_note_send,
            "performance_alerts": job_performance_alerts,
            # Not on any schedule — a one-shot repair, dry run unless
            # BACKFILL_COMMIT is set.
            "backfill_snapshots": job_backfill_snapshots,
            # Scheduled weekly (above); also runnable on demand for the
            # first load, which is much larger than a weekly top-up.
            "backfill_prices": job_backfill_prices,
            # Scheduled Fri/Tue (above). On demand for a first draft or
            # after editing the style guide. `x_thread_post` sends whatever is
            # confirmed right now instead of waiting for the hourly tick.
            "x_thread_draft": job_x_thread_draft,
            "x_thread_market_draft": job_x_thread_market_draft,
            "x_thread_spotlight_draft": job_x_thread_spotlight_draft,
            "x_thread_sunday_draft": job_x_thread_sunday_draft,
            "macro_refresh": job_macro_refresh,
            "x_thread_post": job_x_thread_post,
            "news_refresh": job_news_refresh,
            "dca_friday": job_dca_friday,
            "dca_backfill": job_dca_backfill,
        }[name]()
        return

    scheduler.start()


if __name__ == "__main__":
    main()
