"""Scheduled job runners."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

import httpx

from sqlalchemy import update
from sqlalchemy.orm import Session

from outpick_strategy.cadence import is_evaluation_friday

from app.config import get_settings
from app.db.models import JobRun
from app.db.session import SessionLocal
from app.services.portfolio import ensure_default_portfolio, run_evaluation
from app.services.job_runs import reap_stale_job_runs
from worker.jobs.deadline import JobDeadline, JobDeadlineExceeded
from worker.services.fmp import FMPClient
from worker.services.market_calendar import is_effective_run_day, is_trading_day
from worker.services.ingest import (
    backfill_price_history,
    refresh_fundamentals,
    refresh_marks,
    refresh_universe,
)
from worker.services.scoring import diagnose_unscored_holdings, score_universe

log = logging.getLogger(__name__)

# Synthetic job_runs row for a held ticker missing from the latest score run.
# Status is error so the existing 5-minute alert sweep mails the admins — the
# same channel as a crashed daily_marks, because an unrated holding is the same
# class of problem: the book is running without the data the strategy needs.
UNRATED_HOLDINGS_JOB = "unrated_holdings"


def _fmp(deadline: JobDeadline | None = None) -> FMPClient:
    s = get_settings()
    return FMPClient(
        s.fmp_api_key,
        s.fmp_base_url,
        rate_limit=s.fmp_rate_limit,
        deadline=deadline,
    )


def reap_stale_weekly_refreshes() -> int:
    """Expose refreshes orphaned by a process exit as terminal errors."""
    db = SessionLocal()
    try:
        timeout = timedelta(minutes=get_settings().weekly_refresh_timeout_minutes)
        count = reap_stale_job_runs(
            db,
            job_name="weekly_refresh",
            stale_after=timeout,
        )
        if count:
            log.error("Reaped %s stale weekly_refresh run(s)", count)
        return count
    finally:
        db.close()


def _post_to_web_app(
    path: str, label: str, timeout: float, json: dict | None = None
) -> dict:
    """POST to an internal endpoint on the web app, best-effort.

    These are the only outbound calls this service makes to the web app.
    Everything else between the two goes through the shared Postgres, but
    research notes are web-owned — the content, the editor, the renderer and the
    Anthropic client all live there — and reaching across to write them from
    here would put a second writer on a table with no shared model.

    Never raises. Every caller is either a scheduled sweep that will run again
    or a step appended to a job whose real work is already committed, so an
    exception here could only turn a recoverable miss into a failed cycle.
    """
    settings = get_settings()
    base = (getattr(settings, "web_app_url", "") or "").strip().rstrip("/")
    secret = getattr(settings, "internal_api_secret", "") or ""
    if not base or not secret:
        log.info("WEB_APP_URL or INTERNAL_API_SECRET unset; skipping %s", label)
        return {"skipped": "not_configured"}

    # Railway's UI hands you a bare hostname ("web.railway.internal"), and httpx
    # rejects a URL with no scheme outright. Internal traffic is plain HTTP, so
    # filling it in is unambiguous — and this is exactly the value someone will
    # paste next time.
    if "://" not in base:
        base = f"http://{base}"

    try:
        with httpx.Client(timeout=httpx.Timeout(timeout, connect=10.0)) as client:
            res = client.post(
                f"{base}{path}",
                headers={"Authorization": f"Bearer {secret}"},
                json=json,
            )
            res.raise_for_status()
            body = res.json()
            log.info("%s: %s", label, body)
            return body
    except Exception as e:
        log.exception("%s failed", label)
        return {"error": str(e)}


def sync_insight_drafts() -> dict:
    """Ask the web app to open and draft research notes for any unwritten pick.

    Best-effort by design. The endpoint it calls is a reconciliation sweep, so a
    firing that never lands is picked up by the next one; failing the whole
    evaluation job because a draft could not be written would be much worse
    than a note arriving a day late.

    The timeout is minutes because the sweep drafts sequentially and each note
    is a model call.
    """
    return _post_to_web_app(
        "/api/internal/insights/sync", "Insight draft sync", 600.0
    )


def job_weekly_review_draft():
    """Ask the web app to draft this week's Friday portfolio review.

    The web app owns the note, the editor and the Anthropic client. A firing
    that never lands is picked up by the operator's Draft button or the next
    Friday; failing the worker process over a model timeout would be worse.
    """
    return _post_to_web_app(
        "/api/internal/insights/weekly-review/draft",
        "Weekly review draft",
        600.0,
    )


def job_weekly_review_publish():
    """Publish the Friday review if an admin confirmed it.

    Unconfirmed drafts are left alone and the web app emails the admins that
    the week was skipped. The claim lives on the insight row, so a redeploy
    that fires this twice still mails the list once.
    """
    return _post_to_web_app(
        "/api/internal/insights/weekly-review/publish",
        "Weekly review publish",
        300.0,
    )


def job_market_note_prepare():
    """Open the coming week's Market Note row and nag if nothing is ready.

    Runs a couple of days before the Monday send so there is time to write it.
    The web app decides whether to actually mail the reminder — a nag that
    fires whether or not the work is done is a nag people filter.
    """
    return _post_to_web_app(
        "/api/internal/market-note/prepare",
        "Market Note prepare",
        120.0,
    )


def job_market_note_send():
    """Mail the confirmed Market Note to the free list.

    A week with nothing confirmed is a skip, not a failure: the admins are told
    and the list hears nothing. The send is never allowed to bypass the confirm
    gate, because mailing a half-written note on a schedule is worse than
    missing a week. Claims live on the issue row and in the dispatch ledger, so
    a redeploy that fires this twice still mails the list once.
    """
    return _post_to_web_app(
        "/api/internal/market-note/send",
        "Market Note send",
        600.0,
    )


def job_weekly_summary():
    """Alias for operators who still have RUN_JOB_ONCE=weekly_summary.

    The Sunday stats digest is gone. This name now fires the Friday publish
    path, which no-ops when the week was already sent or never confirmed.
    """
    return job_weekly_review_publish()


def job_x_thread_draft(kind: str = "weekly_review"):
    """Draft an X thread for admin review. Never posts.

    Same shape as the weekly review draft and for the same reason: the web app
    owns the Anthropic client and the thread table, and a firing that never
    lands is picked up by the operator's Draft button or the next schedule.
    """
    return _post_to_web_app(
        "/api/internal/x/draft",
        f"X thread draft ({kind})",
        300.0,
        json={"kind": kind},
    )


def job_x_thread_market_draft():
    """The market-conditions-and-sectors thread. Own job so it can have its
    own cron slot without threading an argument through APScheduler."""
    return job_x_thread_draft("market")


def job_x_thread_spotlight_draft():
    """The daily screener-name-or-sector spotlight.

    Never an active pick or a book holding — see the style guide's compliance
    line in `x-thread-draft.ts` for why that distinction has to be spelled out
    in the thread every time, not just implied by the section it runs in."""
    return job_x_thread_draft("spotlight")


def job_x_thread_post():
    """Post every confirmed thread. Unconfirmed drafts are left alone.

    The confirm gate is never bypassed here. A thread makes public performance
    claims about a real book, so an unread draft going out on a schedule is
    strictly worse than a thread that misses its slot.
    """
    return _post_to_web_app("/api/internal/x/post", "X thread post", 300.0)


def job_performance_alerts():
    """Check for position milestones and portfolio drawdowns.

    Every alert is claimed by EVENT rather than by day, so a position sitting
    above a threshold does not re-announce itself on every run.
    """
    return _post_to_web_app(
        "/api/internal/email/performance-alerts", "Performance alerts", 300.0
    )


def alert_failed_job_runs(limit: int = 10) -> dict:
    """Mail the admins about job failures nobody has been told about yet.

    A sweep rather than an alert fired from `_track`'s except block, for the
    reason the drafting pipeline is a sweep: a push that fails is a failure
    nobody hears about, and the whole point of this is that a failure stops
    being silent. `alerted_at` is claimed BEFORE the call and released if the
    call fails, so a crash mid-alert retries rather than double-mails.

    Never raises. It runs on the same tick as the stale-run reaper, and an
    alerting problem must not take the reaper down with it.
    """
    db = SessionLocal()
    try:
        rows = (
            db.query(JobRun)
            .filter(JobRun.status == "error", JobRun.alerted_at.is_(None))
            .order_by(JobRun.id.desc())
            .limit(limit)
            .all()
        )
        if not rows:
            return {"alerted": 0}

        alerted = 0
        for run in rows:
            claimed_at = datetime.now(timezone.utc)
            # Claim first. Two workers overlapping must not both mail.
            won = db.execute(
                update(JobRun)
                .where(JobRun.id == run.id, JobRun.alerted_at.is_(None))
                .values(alerted_at=claimed_at)
            )
            db.commit()
            if won.rowcount != 1:
                continue

            body = {
                "job_name": run.job_name,
                "run_id": str(run.id),
                "failed_at": (run.finished_at or claimed_at).isoformat(),
                "detail": run.detail or "",
            }
            if run.job_name == UNRATED_HOLDINGS_JOB:
                body.update(_unrated_alert_fields(run.detail or ""))
            res = _post_to_web_app(
                "/api/internal/ops/job-failed",
                f"Job failure alert ({run.job_name})",
                60.0,
                json=body,
            )
            if res.get("error") or res.get("skipped") == "not_configured":
                # Give the claim back so the next sweep tries again. Losing the
                # alert entirely is the bug being fixed here.
                db.execute(
                    update(JobRun)
                    .where(JobRun.id == run.id)
                    .values(alerted_at=None)
                )
                db.commit()
            else:
                alerted += 1

        return {"alerted": alerted, "candidates": len(rows)}
    except Exception as e:
        log.exception("Job-failure alert sweep failed")
        return {"error": str(e)}
    finally:
        db.close()


def _unrated_alert_fields(detail: str) -> dict[str, str]:
    """Subject line for the unrated-holdings mail, parsed from JobRun.detail."""
    tickers: list[str] = []
    for line in detail.splitlines():
        if ": " in line and not line.startswith("Unrated"):
            tickers.append(line.split(":", 1)[0].strip())
    if len(tickers) == 1:
        return {"headline": f"{tickers[0]} has no rating", "eyebrow": "Unrated holding"}
    if tickers:
        return {
            "headline": f"{len(tickers)} holdings have no rating",
            "eyebrow": "Unrated holdings",
        }
    return {"headline": "Holdings have no rating", "eyebrow": "Unrated holding"}


def format_unrated_detail(incidents) -> str:
    as_of = next((row.as_of for row in incidents if row.as_of is not None), None)
    header = (
        f"Unrated holdings as of {as_of.isoformat()}."
        if as_of is not None
        else "Unrated holdings."
    )
    lines = [
        header,
        "Sell rules skip any name with no score.",
        "",
    ]
    for row in incidents:
        lines.append(f"{row.ticker}: {row.reason}")
    return "\n".join(lines)


def sweep_ops_alerts() -> dict:
    """Record unrated holdings, then mail any unalerted error JobRuns.

    One function so the 5-minute tick cannot alert before the incident row
    exists. `record_unrated_holdings` is a no-op when every holding is scored.
    """
    recorded = record_unrated_holdings()
    alerted = alert_failed_job_runs()
    return {"unrated_holdings": recorded, "job_failures": alerted}


def record_unrated_holdings(db: Session | None = None) -> dict:
    """Write an error JobRun when a live holding has no rating.

    Dedupes on the exact detail string, so a re-score the same day with the
    same gap does not mail twice, and a new scoring date (or a new reason)
    mails again. Never raises: it runs on the same tick as the job-failure
    sweep, and a diagnostic problem must not take that sweep down with it.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        incidents = diagnose_unscored_holdings(db)
        if not incidents:
            return {"unrated": 0}
        detail = format_unrated_detail(incidents)
        existing = (
            db.query(JobRun)
            .filter(
                JobRun.job_name == UNRATED_HOLDINGS_JOB,
                JobRun.detail == detail,
            )
            .first()
        )
        if existing:
            return {"unrated": len(incidents), "recorded": False}
        now = datetime.now(timezone.utc)
        db.add(
            JobRun(
                job_name=UNRATED_HOLDINGS_JOB,
                status="error",
                detail=detail,
                finished_at=now,
            )
        )
        db.commit()
        log.error("Recorded unrated_holdings incident:\n%s", detail)
        return {"unrated": len(incidents), "recorded": True}
    except Exception as e:
        log.exception("Unrated-holdings check failed")
        try:
            db.rollback()
        except Exception:
            pass
        return {"error": str(e)}
    finally:
        if own_session:
            db.close()


def job_auto_publish_insights():
    """Publish drafts whose review window has expired, and mail the list.

    Deliberately its own scheduled job on a short interval rather than a step
    appended to the evaluation. The deadline it enforces is hours after the
    pick that created the draft, so nothing that runs at pick time could ever
    be the thing that fires it, and an admin who edits or regenerates a note
    moves the deadline — the schedule has to keep asking.

    Untracked by `_track`: it fires many times a day and would bury the handful
    of rows that say whether the real cycle jobs ran. What it does is visible in
    the note itself, which is either announced or still sitting in the queue.
    """
    return _post_to_web_app(
        "/api/internal/insights/auto-publish", "Insight auto-publish", 300.0
    )


def _track(job_name: str, fn):
    db = SessionLocal()
    run = JobRun(job_name=job_name, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    run_id = run.id
    try:
        result = fn(db)
        finished_at = datetime.now(timezone.utc)
        updated = db.execute(
            update(JobRun)
            .where(JobRun.id == run_id, JobRun.status == "running")
            .values(
                status="ok",
                detail=str(result) if result is not None else None,
                finished_at=finished_at,
            )
        )
        db.commit()
        if updated.rowcount != 1:
            # The periodic reaper won the race. Never turn a run that exceeded
            # its durable runtime limit green just because it eventually
            # returned after being declared abandoned.
            raise JobDeadlineExceeded(
                f"{job_name} exceeded its runtime limit before completion"
            )
        return result
    except Exception as e:
        log.exception("%s failed", job_name)
        # The failure usually leaves the session's transaction in a failed
        # state (e.g. an IntegrityError). Committing the error row on it would
        # raise PendingRollbackError and mask the original exception, so the one
        # failure you most need to see would leave no trace. Roll back first.
        try:
            db.rollback()
            db.execute(
                update(JobRun)
                .where(JobRun.id == run_id, JobRun.status == "running")
                .values(
                    status="error",
                    detail=str(e),
                    finished_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
        except Exception:
            log.exception("Could not record failure for %s", job_name)
        raise
    finally:
        db.close()


def job_daily_marks():
    def _run(db: Session):
        today = date.today()
        if not is_trading_day(today):
            # Nothing new to mark — the market never opened. Recording a
            # snapshot anyway would put a flat, duplicated point on the
            # published equity curve.
            log.info("%s is not a trading day; skipping marks", today)
            return {"skipped": "not_a_trading_day"}
        fmp = _fmp()
        try:
            ensure_default_portfolio(db, get_settings().initial_cash)
            n = refresh_marks(db, fmp)
            # Re-score every trading day, after marks so momentum sees today's
            # bar. Scoring is pure DB compute — compute_scores reads
            # Fundamentals/PriceBar/Stock and calls no FMP endpoint — so this
            # adds no API quota. It exists because a rating is published next to
            # every holding: scoring only on Saturday meant a subscriber
            # averaging into a name mid-week was reading a badge up to six days
            # old with nothing on screen saying so.
            s = score_universe(db)
            unrated = record_unrated_holdings(db)
            # Optional daily sells if enabled in params
            run_evaluation(db, mode="daily", dry_run=False)
            # Backstop. Manual buys go through the ops form, which opens the
            # placeholder row itself but deliberately does not draft — and a
            # push that never landed leaves nothing behind to notice. This
            # sweep is what makes the pipeline self-healing rather than
            # dependent on every trigger having fired.
            drafts = sync_insight_drafts()
            return {"marks": n, "scores": s, "unrated_holdings": unrated, "drafts": drafts}
        finally:
            fmp.close()

    return _track("daily_marks", _run)


def job_weekly_refresh():
    def _run(db: Session):
        timeout_seconds = get_settings().weekly_refresh_timeout_minutes * 60
        deadline = JobDeadline.after("weekly_refresh", timeout_seconds)
        # Schema upkeep FIRST. There is no Alembic here; ensure_schema is the
        # migration hook, and it previously only ran via refresh_marks — the
        # last step. Anything earlier in the job that depends on a new index
        # (the fundamentals (ticker, as_of) uniqueness) would run against a
        # table that had not been migrated yet.
        ensure_default_portfolio(db, get_settings().initial_cash)
        deadline.check()
        fmp = _fmp(deadline)
        try:
            u = refresh_universe(db, fmp)
            deadline.check()
            f = refresh_fundamentals(db, fmp)
            deadline.check()
            s = score_universe(db)
            deadline.check()
            m = refresh_marks(db, fmp)
            deadline.check()
            unrated = record_unrated_holdings(db)
            return {
                "universe": u,
                "fundamentals": f,
                "scores": s,
                "marks": m,
                "unrated_holdings": unrated,
            }
        finally:
            fmp.close()

    return _track("weekly_refresh", _run)


def job_backfill_snapshots():
    """One-shot equity-curve reconstruction. Not scheduled — run it deliberately.

    Dry run unless BACKFILL_COMMIT is set; see worker.backfill_snapshots.
    """
    from worker.backfill_snapshots import run_from_env

    return _track("backfill_snapshots", lambda _db: run_from_env())


def job_backfill_prices():
    """Price-history load and weekly top-up so momentum can be computed.

    Runs Saturday 14:00 ET, and on demand via RUN_JOB_ONCE for the initial load.
    It became scheduled because the two are the same operation: a series that is
    never topped up goes stale under a moving 365d anchor, which is exactly the
    condition BUG-W2 describes.

    Deliberately a separate job from weekly_refresh rather than a step inside it:
    it must not run in the API process behind the ops button, and padding the
    weekly job's runtime widens the window in which a redeploy can kill it.
    Idempotent — re-run it freely.
    """

    def _run(db: Session):
        ensure_default_portfolio(db, get_settings().initial_cash)
        fmp = _fmp()
        try:
            result = backfill_price_history(db, fmp)
        finally:
            fmp.close()
        # Score immediately rather than leaving it to the next daily_marks.
        # This job is the only thing that can turn an unscoreable ticker into a
        # scoreable one — momentum needs a bar near as_of - 365d, and under
        # min_factor_coverage = 1.0 a missing momentum value makes the whole
        # ticker unrated. weekly_refresh scores at 10:00, four hours before this
        # runs, so without this the bars land Saturday and the ratings they
        # unblock do not appear until Monday evening. Pure DB compute — no FMP
        # quota, same reasoning as the re-score in daily_marks.
        result["scores"] = score_universe(db)
        result["unrated_holdings"] = record_unrated_holdings(db)
        return result

    return _track("backfill_prices", _run)


def biweekly_target_friday(today: date) -> date | None:
    """The evaluation Friday for `today`'s week, if this is an evaluation week.

    Week-scoped on purpose — the scheduler fires every weekday of an evaluation
    week and this answers "which Friday is that firing for". The cadence rule
    itself lives in `outpick_strategy.cadence` because the API publishes the
    next evaluation date to subscribers and cannot import the worker.
    """
    friday = today + timedelta(days=4 - today.weekday())
    return friday if is_evaluation_friday(friday) else None


def job_biweekly_evaluate():
    def _run(db: Session):
        today = date.today()
        target = biweekly_target_friday(today)
        if target is None or not is_effective_run_day(target, today):
            # The trigger deliberately fires on several days of the evaluation
            # week; exactly one of them is the real run. When the target Friday
            # is a market holiday the cycle MOVES to the preceding session
            # rather than being skipped — a silently dropped evaluation is far
            # worse than one that runs a day early.
            log.info(
                "%s is not the effective run day for target %s; skipping",
                today,
                target,
            )
            return {"skipped": "not_effective_run_day", "target": str(target)}

        fmp = _fmp()
        try:
            refresh_marks(db, fmp)
            ev = run_evaluation(db, mode="biweekly", dry_run=False)
            # Open and draft a research note for anything just bought. Last,
            # and outside the transaction that matters: a pick that lands in
            # the book without a draft is a nuisance, but an evaluation that
            # fails because the web app was slow is a missed cycle.
            drafts = sync_insight_drafts()
            return {
                "evaluation_id": ev.id,
                "signal_count": len(ev.signals),
                "target": str(target),
                "ran_on": str(today),
                "drafts": drafts,
            }
        finally:
            fmp.close()

    return _track("biweekly_evaluate", _run)


def dca_target_friday(today: date) -> date | None:
    """This week's calendar Friday, or None on weekends.

    Same week-scoped trick as biweekly_evaluate: the trigger fires every
    weekday so a holiday Friday can move to Thursday.
    """
    if today.weekday() > 4:
        return None
    return today + timedelta(days=4 - today.weekday())


def job_dca_friday():
    def _run(db: Session):
        today = date.today()
        if not is_trading_day(today):
            log.info("%s is not a trading day; skipping DCA", today)
            return {"skipped": "not_a_trading_day"}
        target = dca_target_friday(today)
        if target is None or not is_effective_run_day(target, today):
            log.info(
                "%s is not the effective DCA day for target %s; skipping",
                today,
                target,
            )
            return {"skipped": "not_effective_run_day", "target": str(target)}

        from worker.services.market_calendar import last_trading_day_on_or_before
        from app.services.dca import run_dca_friday

        ensure_default_portfolio(db, get_settings().initial_cash)
        session = last_trading_day_on_or_before(target)
        return run_dca_friday(db, session)

    return _track("dca_friday", _run)


def job_dca_backfill():
    """Replay Friday DCA sessions from live inception through the last session.

    On-demand via RUN_JOB_ONCE=dca_backfill. Wipes the sample books and replays
    from DCA_START (the live start, not the live book's inception).
    """

    def _run(db: Session):
        from worker.services.market_calendar import last_trading_day_on_or_before
        from app.services.dca import DCA_START, backfill_dca

        ensure_default_portfolio(db, get_settings().initial_cash)
        end = last_trading_day_on_or_before(date.today())
        return backfill_dca(db, start=DCA_START, end=end)

    return _track("dca_backfill", _run)
