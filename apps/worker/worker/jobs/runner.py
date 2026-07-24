"""Scheduled job runners."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import JobRun
from app.db.session import SessionLocal
from app.services.portfolio import ensure_default_portfolio, run_evaluation
from worker.services.fmp import FMPClient
from worker.services.ingest import refresh_fundamentals, refresh_marks, refresh_universe
from worker.services.scoring import score_universe

log = logging.getLogger(__name__)


def _fmp() -> FMPClient:
    s = get_settings()
    return FMPClient(s.fmp_api_key, s.fmp_base_url)


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
        fmp = _fmp()
        try:
            ensure_default_portfolio(db, get_settings().initial_cash)
            n = refresh_marks(db, fmp)
            # Optional daily sells if enabled in params
            run_evaluation(db, mode="daily", dry_run=False)
            return {"marks": n}
        finally:
            fmp.close()

    return _track("daily_marks", _run)


def job_weekly_refresh():
    def _run(db: Session):
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


def job_biweekly_evaluate():
    def _run(db: Session):
        fmp = _fmp()
        try:
            refresh_marks(db, fmp)
            ev = run_evaluation(db, mode="biweekly", dry_run=False)
            return {"evaluation_id": ev.id, "signal_count": len(ev.signals)}
        finally:
            fmp.close()

    return _track("biweekly_evaluate", _run)
