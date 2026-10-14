"""Scheduled job runners."""

from __future__ import annotations

import json
import logging
import os
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
from worker.backtest.workforce_ic import (
    WORKFORCE_IC_JOB,
    WORKFORCE_IC_TIMEOUT_MINUTES,
    compute_workforce_ic,
)
from worker.services.challenge_prices import (
    CHALLENGE_PRICE_JOB,
    CHALLENGE_PRICE_TIMEOUT_MINUTES,
    challenge_prices,
)
from worker.services.deep_prices import (
    DEEP_PRICE_JOB,
    DEEP_PRICE_TIMEOUT_MINUTES,
    deep_price_history,
)
from worker.services.employee_counts import (
    EMPLOYEE_COUNTS_JOB,
    EMPLOYEE_COUNTS_TIMEOUT_MINUTES,
    refresh_employee_counts,
)
from worker.services.fmp import FMPClient
from worker.services.job_openings import (
    COLLECT_JOB,
    COLLECT_TIMEOUT_MINUTES,
    DISCOVER_JOB,
    DISCOVER_TIMEOUT_MINUTES,
    AtsClient,
    collect_openings,
    discover_boards,
)
from worker.services.market_calendar import is_effective_run_day, is_trading_day
from worker.services.ingest import (
    CONSENSUS_SNAPSHOT_GAP_JOB,
    CONSENSUS_SNAPSHOT_JOB,
    CONSENSUS_SNAPSHOT_TIMEOUT_MINUTES,
    backfill_price_history,
    missing_snapshot_weekdays,
    news_universe_tickers,
    refresh_fundamentals,
    refresh_marks,
    refresh_macro,
    refresh_news,
    refresh_universe,
    snapshot_consensus,
    today_et,
)
from worker.services.scoring import diagnose_unscored_holdings, score_universe
from worker.services.splits import (
    apply_position_splits,
    record_splits,
    restate_price_bars,
)

log = logging.getLogger(__name__)

# Synthetic job_runs row for a held ticker missing from the latest score run.
# Status is error so the existing 5-minute alert sweep mails the admins — the
# same channel as a crashed daily_marks, because an unrated holding is the same
# class of problem: the book is running without the data the strategy needs.
UNRATED_HOLDINGS_JOB = "unrated_holdings"
SPLIT_REVIEW_JOB = "split_review"


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
        snap_timeout = timedelta(minutes=CONSENSUS_SNAPSHOT_TIMEOUT_MINUTES)
        count += reap_stale_job_runs(
            db,
            job_name=CONSENSUS_SNAPSHOT_JOB,
            stale_after=snap_timeout,
        )
        count += reap_stale_job_runs(
            db,
            job_name=EMPLOYEE_COUNTS_JOB,
            stale_after=timedelta(minutes=EMPLOYEE_COUNTS_TIMEOUT_MINUTES),
        )
        count += reap_stale_job_runs(
            db, job_name=DISCOVER_JOB, stale_after=timedelta(minutes=DISCOVER_TIMEOUT_MINUTES)
        )
        count += reap_stale_job_runs(
            db, job_name=COLLECT_JOB, stale_after=timedelta(minutes=COLLECT_TIMEOUT_MINUTES)
        )
        count += reap_stale_job_runs(
            db,
            job_name=DEEP_PRICE_JOB,
            stale_after=timedelta(minutes=DEEP_PRICE_TIMEOUT_MINUTES),
        )
        count += reap_stale_job_runs(
            db,
            job_name=CHALLENGE_PRICE_JOB,
            stale_after=timedelta(minutes=CHALLENGE_PRICE_TIMEOUT_MINUTES),
        )
        count += reap_stale_job_runs(
            db,
            job_name=WORKFORCE_IC_JOB,
            stale_after=timedelta(minutes=WORKFORCE_IC_TIMEOUT_MINUTES),
        )
        if count:
            log.error("Reaped %s stale scheduled-job run(s)", count)
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
    """Retired. The weekly book recap is no longer drafted or mailed."""
    log.info("weekly_review_draft retired")
    return {"skipped": "retired"}


def job_weekly_review_publish():
    """Retired. The weekly book recap is no longer drafted or mailed."""
    log.info("weekly_review_publish retired")
    return {"skipped": "retired"}


def job_market_note_prepare():
    """Open the coming week's Market Note row and nag if nothing is ready.

    Runs a couple of days before the Monday send so there is time to review it.
    The web app has the model draft the issue (web research takes a few
    minutes, hence the long timeout) and leaves it unconfirmed. It also decides
    whether to actually mail the reminder — a nag that fires whether or not
    the work is done is a nag people filter.
    """
    return _post_to_web_app(
        "/api/internal/market-note/prepare",
        "Market Note prepare",
        330.0,
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


def job_editorial_prepare():
    """Open the next market analysis and Wednesday spotlight and have the model draft both.

    Drafts are left unconfirmed for review; the send job skips anything a
    person has not confirmed.
    """
    return _post_to_web_app(
        "/api/internal/editorial/prepare",
        "Editorial prepare",
        630.0,
    )


def job_editorial_send():
    """Mail a confirmed analysis or spotlight when today is its send day."""
    return _post_to_web_app(
        "/api/internal/editorial/send",
        "Editorial send",
        600.0,
    )


def job_weekly_summary():
    """Retired alias. The Friday portfolio review is no longer mailed."""
    return job_weekly_review_publish()


def job_macro_refresh():
    """Pull Treasury yields and the coming week's US econ calendar.

    Sunday-only. Kept for `/ops/macro-brief` now that the week-ahead X thread
    it was written for is gone.
    """

    def _run(db: Session):
        fmp = _fmp()
        try:
            return refresh_macro(db, fmp)
        finally:
            fmp.close()

    return _track("macro_refresh", _run)


def job_news_refresh():
    """Pull recent headlines for held + top-rated non-held tickers.

    Feeds the editorial brief behind the market note, so a headline from this
    morning is available, not just whatever was still in the table.
    """

    def _run(db: Session):
        tickers = news_universe_tickers(db)
        if not tickers:
            return {"skipped": "no_tickers"}
        fmp = _fmp()
        try:
            inserted = refresh_news(db, fmp, tickers)
            return {"tickers": len(tickers), "inserted": inserted}
        finally:
            fmp.close()

    return _track("news_refresh", _run)


def job_income_statements_refresh():
    """Refresh every held name's income statements for the in-app visuals."""

    def _run(db: Session):
        from worker.services.income_statements import refresh_income_statements

        fmp = _fmp()
        try:
            return refresh_income_statements(db, fmp)
        finally:
            fmp.close()

    return _track("income_statements_refresh", _run)


def job_income_visuals_watch():
    """Store each new quarter as it lands, then let the web app draft for X.

    The draft call runs every tick, not only when something new was stored:
    the web app's drafting is idempotent and cheap, and a tick whose call
    failed would otherwise strand that print until it is no longer news.
    """

    def _run(db: Session):
        from worker.services.income_statements import watch_reporters

        fmp = _fmp()
        try:
            return watch_reporters(db, fmp)
        finally:
            fmp.close()

    try:
        watched = _track("income_visuals_watch", _run)
    except Exception as e:
        # Already recorded as a failed job_runs row; what earlier ticks
        # stored can still be drafted.
        watched = {"error": str(e)}
    drafted = _post_to_web_app(
        "/api/internal/x/income-visuals", "Income visual drafts", 120.0
    )
    return {"watched": watched, "drafted": drafted}


def job_x_thread_post():
    """Post every confirmed thread. Unconfirmed drafts are left alone.

    A thread makes public performance claims about a real book, so an unread
    draft going out on a schedule is strictly worse than a thread that misses
    its slot. The one exception is the income visual: no model, no claim about
    the book, held names refused — the web app confirms one per tick once its
    review window has passed.
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


def _record_snapshot_gaps(db: Session, missing: list) -> dict:
    """Write an error JobRun when a weekday vintage is missing.

    Dedupes on the exact detail string so a persistent hole does not mail
    every 5 minutes, and a newly missing day mails again.
    """
    if not missing:
        return {"missing": 0, "recorded": False}
    detail = (
        "Missing consensus snapshots on: "
        + ", ".join(d.isoformat() if hasattr(d, "isoformat") else str(d) for d in missing)
        + ". A hole in this table can never be reconstructed."
    )
    existing = (
        db.query(JobRun)
        .filter(
            JobRun.job_name == CONSENSUS_SNAPSHOT_GAP_JOB,
            JobRun.detail == detail,
        )
        .first()
    )
    if existing:
        return {"missing": len(missing), "recorded": False}
    now = datetime.now(timezone.utc)
    db.add(
        JobRun(
            job_name=CONSENSUS_SNAPSHOT_GAP_JOB,
            status="error",
            detail=detail,
            finished_at=now,
        )
    )
    db.commit()
    log.error("Recorded consensus_snapshot_gap incident:\n%s", detail)
    return {"missing": len(missing), "recorded": True}


def job_consensus_snapshot():
    """Daily full-universe analyst-estimates vintage. After the close, before marks.

    Every missed weekday is a permanent hole in the revisions window. Failures
    go through `_track` so the 5-minute alert sweep mails the admins; a gap
    discovered on a later run gets its own error JobRun.
    """

    def _run(db: Session):
        timeout_seconds = CONSENSUS_SNAPSHOT_TIMEOUT_MINUTES * 60
        deadline = JobDeadline.after(CONSENSUS_SNAPSHOT_JOB, timeout_seconds)
        as_of = today_et()
        gaps = _record_snapshot_gaps(db, missing_snapshot_weekdays(db, as_of))
        fmp = _fmp(deadline)
        try:
            probes = fmp.probe_backtest_endpoints()
            for name, probe in probes.items():
                if not probe.get("ok"):
                    log.warning(
                        "FMP backtest probe %s failed: %s",
                        name,
                        probe.get("error"),
                    )
            result = snapshot_consensus(db, fmp, as_of=as_of)
            result["fmp_probes"] = probes
            result["gap_alert"] = gaps
            return result
        finally:
            fmp.close()

    return _track(CONSENSUS_SNAPSHOT_JOB, _run)


def job_employee_counts_refresh():
    """Weekly: append new 10-K headcounts for the whole universe.

    Resumable, so the first load may take a few runs. An off-plan endpoint or
    a run of all-empty responses raises, which mails the admins through the
    normal job-failure sweep.
    """

    def _run(db: Session):
        deadline = JobDeadline.after(
            EMPLOYEE_COUNTS_JOB, EMPLOYEE_COUNTS_TIMEOUT_MINUTES * 60
        )
        fmp = _fmp(deadline)
        try:
            return refresh_employee_counts(db, fmp)
        finally:
            fmp.close()

    return _track(EMPLOYEE_COUNTS_JOB, _run)


def job_job_boards_discover():
    """Weekly: find which public job board, if any, belongs to each company."""

    def _run(db: Session):
        ats = AtsClient()
        try:
            return discover_boards(db, ats)
        finally:
            ats.close()

    return _track(DISCOVER_JOB, _run)


def job_job_openings_collect():
    """Weekday mornings: append today's open-posting count per company.

    History cannot be rebuilt, so a failure here mails the admins through the
    normal job-failure sweep rather than quietly leaving a hole.
    """

    def _run(db: Session):
        ats = AtsClient()
        try:
            return collect_openings(db, ats)
        finally:
            ats.close()

    return _track(COLLECT_JOB, _run)


def job_price_history_deep():
    """On demand: load five years of daily closes for factor studies.

    Writes `price_bars_deep`, never the live `price_bars`. Resumable (a ticker
    commits as it goes) and never scheduled.
    """

    def _run(db: Session):
        fmp = _fmp()
        try:
            return deep_price_history(db, fmp)
        finally:
            fmp.close()

    return _track(DEEP_PRICE_JOB, _run)


def job_challenge_prices():
    """Weeknights: adjusted closes for every ticker in a Beat the S&P entry.

    Today's bar is kept only once the session has closed (16:30 ET), so a
    manual run from ops mid-session never stores an intraday price as a close.
    Skips quietly until the web app has created the entry tables and someone
    has entered.
    """
    from zoneinfo import ZoneInfo

    def _run(db: Session):
        now = datetime.now(ZoneInfo("America/New_York"))
        today = now.date()
        if not is_trading_day(today):
            return {"skipped": "not_a_trading_day"}
        closed = (now.hour, now.minute) >= (16, 30)
        fmp = _fmp()
        try:
            return challenge_prices(
                db, fmp, today=today, cutoff=today + timedelta(days=1) if closed else today
            )
        finally:
            fmp.close()

    return _track(CHALLENGE_PRICE_JOB, _run)


def job_workforce_ic():
    """On demand: do the workforce factors rank forward returns? Read-only."""

    def _run(db: Session):
        # JSON, not a dict: `_track` stores str(result), and a Python repr
        # cannot be read back safely (nan, inf) or without eval-like parsing.
        return json.dumps(compute_workforce_ic(db), default=str, allow_nan=False)

    return _track(WORKFORCE_IC_JOB, _run)


def check_splits(db: Session, fmp: FMPClient, today: date) -> dict:
    """Apply recorded splits to every book before the day's marks land.

    Must run before `refresh_marks`: the live quote is post-split from the
    ex-date on, and against the old share count it reads as a loss the sell
    pass would act on. `hold_sells` is True when the check failed or a split
    is waiting for a human, and the caller then skips the daily sell pass.
    New review rows are written as an error JobRun so the alert sweep mails
    them. Never raises: a failed check must not stop the book being marked.
    """
    out: dict = {}
    try:
        out["recorded"] = record_splits(db, fmp, today)
    except Exception as e:
        log.exception("Split check failed; holding the daily sell pass")
        db.rollback()
        out["error"] = str(e)
    try:
        out.update(apply_position_splits(db, today))
    except Exception as e:
        log.exception("Applying splits failed; holding the daily sell pass")
        db.rollback()
        out["error"] = str(e)
        out.setdefault("open_reviews", [])
    if out.get("review"):
        db.add(
            JobRun(
                job_name=SPLIT_REVIEW_JOB,
                status="error",
                detail="Stock splits need a manual check. The daily sell pass is "
                "off until each review row in split_adjustments is resolved.\n\n"
                + "\n".join(out["review"]),
                finished_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    out["hold_sells"] = bool(out.get("error") or out.get("open_reviews"))
    return out


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
            splits = check_splits(db, fmp, today)
            n = refresh_marks(db, fmp)
            # After marks, so the post-split bar exists and the step shows.
            splits["prices"] = restate_price_bars(db, today)
            # Re-score every trading day, after marks so momentum sees today's
            # bar. Scoring is pure DB compute — compute_scores reads
            # Fundamentals/PriceBar/Stock and calls no FMP endpoint — so this
            # adds no API quota. It exists because a rating is published next to
            # every holding: scoring only on Saturday meant a subscriber
            # averaging into a name mid-week was reading a badge up to six days
            # old with nothing on screen saying so.
            s = score_universe(db)
            unrated = record_unrated_holdings(db)
            # Optional daily sells if enabled in params. Not on a day a split
            # could not be checked or is waiting for review: the marks for that
            # name may be against the wrong share count.
            if splits["hold_sells"]:
                log.error("Daily sell pass skipped: split check incomplete or awaiting review")
            else:
                run_evaluation(db, mode="daily", dry_run=False)
            # Backstop. Manual buys go through the ops form, which opens the
            # placeholder row itself but deliberately does not draft — and a
            # push that never landed leaves nothing behind to notice. This
            # sweep is what makes the pipeline self-healing rather than
            # dependent on every trigger having fired.
            drafts = sync_insight_drafts()
            return {
                "splits": splits,
                "marks": n,
                "scores": s,
                "unrated_holdings": unrated,
                "drafts": drafts,
            }
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
            splits = check_splits(db, fmp, date.today())
            deadline.check()
            u = refresh_universe(db, fmp)
            deadline.check()
            f = refresh_fundamentals(db, fmp)
            deadline.check()
            s = score_universe(db)
            deadline.check()
            m = refresh_marks(db, fmp)
            splits["prices"] = restate_price_bars(db, date.today())
            deadline.check()
            unrated = record_unrated_holdings(db)
            return {
                "splits": splits,
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


def job_extra_buy():
    """One-off second pick on today's already-executed evaluation.

    Not scheduled. Dry run unless EXTRA_BUY_COMMIT is set:

        RUN_JOB_ONCE=extra_buy EXTRA_BUY_TICKER=TPR python -m worker.main
        RUN_JOB_ONCE=extra_buy EXTRA_BUY_TICKER=TPR EXTRA_BUY_COMMIT=1 python -m worker.main

    Refreshes marks first so the fill is today's price, like the evaluation
    it joins. See app.services.extra_buy for what it will and will not do.
    """

    def _run(db: Session):
        from app.services.extra_buy import run_extra_buy

        ticker = os.environ.get("EXTRA_BUY_TICKER", "").strip()
        if not ticker:
            raise ValueError("EXTRA_BUY_TICKER is required")
        commit = bool(os.environ.get("EXTRA_BUY_COMMIT"))
        fmp = _fmp()
        try:
            refresh_marks(db, fmp)
        finally:
            fmp.close()
        result = run_extra_buy(db, ticker, commit=commit).to_dict()
        log.info("extra_buy %s: %s", "COMMITTED" if commit else "dry run", result)
        if commit and not result["already_done"]:
            result["drafts"] = sync_insight_drafts()
        return result

    return _track("extra_buy", _run)


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
