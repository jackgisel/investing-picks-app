"""Scheduled job runners."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

import httpx

from sqlalchemy.orm import Session

from outpick_strategy.cadence import is_evaluation_friday

from app.config import get_settings
from app.db.models import JobRun
from app.db.session import SessionLocal
from app.services.portfolio import ensure_default_portfolio, run_evaluation
from worker.services.fmp import FMPClient
from worker.services.market_calendar import is_effective_run_day, is_trading_day
from worker.services.ingest import (
    backfill_price_history,
    refresh_fundamentals,
    refresh_marks,
    refresh_universe,
)
from worker.services.scoring import score_universe

log = logging.getLogger(__name__)


def _fmp() -> FMPClient:
    s = get_settings()
    return FMPClient(s.fmp_api_key, s.fmp_base_url, rate_limit=s.fmp_rate_limit)


def sync_insight_drafts() -> dict:
    """Ask the web app to open and draft research notes for any unwritten pick.

    The only outbound call this service makes to the web app. Everything else
    between the two goes through the shared Postgres, but research notes are
    web-owned — the content, the editor, the renderer and the Anthropic client
    all live there — and reaching across to write them from here would put a
    second writer on a table with no shared model.

    Best-effort by design. The endpoint it calls is a reconciliation sweep, so a
    firing that never lands is picked up by the next one; failing the whole
    evaluation job because a draft could not be written would be much worse
    than a note arriving a day late.

    The timeout is minutes because the sweep drafts sequentially and each note
    is a model call.
    """
    settings = get_settings()
    base = (getattr(settings, "web_app_url", "") or "").strip().rstrip("/")
    secret = getattr(settings, "internal_api_secret", "") or ""
    if not base or not secret:
        log.info("WEB_APP_URL or INTERNAL_API_SECRET unset; skipping draft sync")
        return {"skipped": "not_configured"}

    # Railway's UI hands you a bare hostname ("web.railway.internal"), and httpx
    # rejects a URL with no scheme outright. Internal traffic is plain HTTP, so
    # filling it in is unambiguous — and this is exactly the value someone will
    # paste next time.
    if "://" not in base:
        base = f"http://{base}"

    try:
        with httpx.Client(timeout=httpx.Timeout(600.0, connect=10.0)) as client:
            res = client.post(
                f"{base}/api/internal/insights/sync",
                headers={"Authorization": f"Bearer {secret}"},
            )
            res.raise_for_status()
            body = res.json()
            log.info("Insight draft sync: %s", body)
            return body
    except Exception as e:
        log.exception("Insight draft sync failed")
        return {"error": str(e)}


def _track(job_name: str, fn):
    db = SessionLocal()
    run = JobRun(job_name=job_name, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    try:
        result = fn(db)
        run.status = "ok"
        run.detail = str(result) if result is not None else None
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return result
    except Exception as e:
        log.exception("%s failed", job_name)
        # The failure usually leaves the session's transaction in a failed
        # state (e.g. an IntegrityError). Committing the error row on it would
        # raise PendingRollbackError and mask the original exception, so the one
        # failure you most need to see would leave no trace. Roll back first.
        try:
            db.rollback()
            run.status = "error"
            run.detail = str(e)
            run.finished_at = datetime.now(timezone.utc)
            db.add(run)
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
            # Optional daily sells if enabled in params
            run_evaluation(db, mode="daily", dry_run=False)
            # Backstop. Manual buys go through the ops form, which opens the
            # placeholder row itself but deliberately does not draft — and a
            # push that never landed leaves nothing behind to notice. This
            # sweep is what makes the pipeline self-healing rather than
            # dependent on every trigger having fired.
            drafts = sync_insight_drafts()
            return {"marks": n, "scores": s, "drafts": drafts}
        finally:
            fmp.close()

    return _track("daily_marks", _run)


def job_weekly_refresh():
    def _run(db: Session):
        # Schema upkeep FIRST. There is no Alembic here; ensure_schema is the
        # migration hook, and it previously only ran via refresh_marks — the
        # last step. Anything earlier in the job that depends on a new index
        # (the fundamentals (ticker, as_of) uniqueness) would run against a
        # table that had not been migrated yet.
        ensure_default_portfolio(db, get_settings().initial_cash)
        fmp = _fmp()
        try:
            u = refresh_universe(db, fmp)
            f = refresh_fundamentals(db, fmp)
            s = score_universe(db)
            m = refresh_marks(db, fmp)
            return {"universe": u, "fundamentals": f, "scores": s, "marks": m}
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
