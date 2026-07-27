"""Ops API — full virtual book + decision ledger + dry-run."""

from __future__ import annotations

import dataclasses
import hmac
import logging
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.config import assert_ops_key_configured, get_settings
from app.db.models import Evaluation, JobRun, Portfolio, Position, SignalRow, Stock, Trade
from app.db.session import get_db
from app.services.portfolio import (
    ensure_default_portfolio,
    load_latest_scores,
    load_portfolio_state,
    params_from_portfolio,
    ranked_candidates,
    run_evaluation,
)
from outpick_strategy import (
    evaluate,
    grade_meets_minimum,
    next_evaluation_friday,
    RUN118_PARAMS,
)

# Refuse to start when the ops key would fail open. This module is imported by
# app.main, so a misconfigured deployment never comes up at all.
assert_ops_key_configured()

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ops", tags=["ops"])

# A weekly_refresh that died mid-flight leaves its JobRun on "running" forever.
# Without an expiry that row would block every future manual refresh, so treat
# anything older than this as dead rather than in progress.
STALE_JOB_AFTER = timedelta(hours=2)

# Rounding tolerance for cash comparisons (floats).
CASH_EPSILON = 1e-6


def require_ops_key(x_ops_key: str | None = Header(default=None)):
    settings = get_settings()
    if settings.ops_key_config_error:
        # Defense in depth: even if startup validation were bypassed, never
        # serve ops data with an unusable key.
        raise HTTPException(status_code=503, detail="Ops API is not configured")
    expected = settings.effective_ops_key
    if not expected or not x_ops_key:
        raise HTTPException(status_code=401, detail="Invalid ops key")
    if not hmac.compare_digest(x_ops_key, expected):
        raise HTTPException(status_code=401, detail="Invalid ops key")


_schema_checked = False


def ensure_portfolio_columns(db: Session) -> None:
    """Additive, idempotent column backfill for pre-existing databases.

    `Base.metadata.create_all` only creates missing tables, so a database that
    predates `portfolios.inception_date` would otherwise error on every read.
    """
    global _schema_checked
    if _schema_checked:
        return
    try:
        db.execute(text("ALTER TABLE portfolios ADD COLUMN inception_date DATE"))
        db.commit()
    except Exception:
        db.rollback()  # already exists (or table not created yet) — fine
    _schema_checked = True


def _position_dict(p: Position) -> dict:
    return {
        "id": p.id,
        "ticker": p.ticker,
        "shares": p.shares,
        "avg_cost": p.avg_cost,
        "current_price": p.current_price,
        "market_value": p.market_value,
        "pnl_pct": round((p.current_price / p.avg_cost - 1) * 100, 2)
        if p.avg_cost
        else None,
        "entry_date": p.entry_date.isoformat() if p.entry_date else None,
        "initial_investment": p.initial_investment,
        "is_house_money": p.is_house_money,
        "sector": p.sector,
    }


@router.get("/portfolio", dependencies=[Depends(require_ops_key)])
def ops_portfolio(db: Session = Depends(get_db)):
    ensure_portfolio_columns(db)
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    invested = sum(p.market_value for p in positions)
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "cash": portfolio.cash,
        "invested": invested,
        "equity": portfolio.cash + invested,
        "peak_equity": portfolio.peak_equity,
        "is_drawdown_halted": portfolio.is_drawdown_halted,
        "inception_date": portfolio.inception_date.isoformat()
        if portfolio.inception_date
        else None,
        "params_version": params_from_portfolio(portfolio).version_hash(),
        "params": params_from_portfolio(portfolio).to_dict(),
        "run118_hash": RUN118_PARAMS.version_hash(),
        "positions": [_position_dict(p) for p in positions],
    }


@router.get("/portfolio/meta", dependencies=[Depends(require_ops_key)])
def ops_portfolio_meta(db: Session = Depends(get_db)):
    """Non-sensitive book metadata (no dollars) — safe to surface publicly."""
    ensure_portfolio_columns(db)
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    return {
        "name": portfolio.name,
        "inception_date": portfolio.inception_date.isoformat()
        if portfolio.inception_date
        else None,
    }


class PortfolioPatch(BaseModel):
    inception_date: date | None = None
    clear_inception_date: bool = False


@router.patch("/portfolio", dependencies=[Depends(require_ops_key)])
def update_portfolio(payload: PortfolioPatch, db: Session = Depends(get_db)):
    ensure_portfolio_columns(db)
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    if payload.clear_inception_date:
        portfolio.inception_date = None
    elif payload.inception_date is not None:
        portfolio.inception_date = payload.inception_date
    db.commit()
    db.refresh(portfolio)
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "inception_date": portfolio.inception_date.isoformat()
        if portfolio.inception_date
        else None,
    }


# --- Manual position entry -------------------------------------------------
#
# The production book starts empty and is seeded by hand. These endpoints keep
# cash coherent: adding a position spends cash at the stated entry price,
# editing settles the difference, deleting refunds the cost basis. Cash is
# never allowed to go negative.


class PositionCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    entry_price: float = Field(gt=0)
    entry_date: date | None = None
    shares: float | None = Field(default=None, gt=0)
    notional: float | None = Field(default=None, gt=0)
    sector: str | None = Field(default=None, max_length=64)
    current_price: float | None = Field(default=None, gt=0)


class PositionUpdate(BaseModel):
    entry_price: float | None = Field(default=None, gt=0)
    entry_date: date | None = None
    shares: float | None = Field(default=None, gt=0)
    notional: float | None = Field(default=None, gt=0)
    sector: str | None = Field(default=None, max_length=64)
    current_price: float | None = Field(default=None, gt=0)


def _resolve_shares(shares: float | None, notional: float | None, price: float) -> float:
    """Quantity may be given as share count or dollar notional — exactly one."""
    if (shares is None) == (notional is None):
        raise HTTPException(
            status_code=422,
            detail="Provide exactly one of 'shares' or 'notional'.",
        )
    resolved = shares if shares is not None else (notional or 0.0) / price
    if resolved <= 0:
        raise HTTPException(status_code=422, detail="Quantity must be greater than zero.")
    return resolved


def _spend_cash(portfolio: Portfolio, amount: float) -> None:
    """Move `amount` out of cash (negative refunds). Never goes below zero."""
    if amount > portfolio.cash + CASH_EPSILON:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient cash: this needs ${amount:,.2f} but only "
                f"${portfolio.cash:,.2f} is available."
            ),
        )
    portfolio.cash = round(portfolio.cash - amount, 6)
    if portfolio.cash < 0:
        portfolio.cash = 0.0


def _bump_peak_equity(db: Session, portfolio: Portfolio) -> None:
    invested = sum(
        p.shares * (p.current_price or 0.0)
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    )
    equity = portfolio.cash + invested
    if portfolio.peak_equity is None or equity > portfolio.peak_equity:
        portfolio.peak_equity = equity


@router.post("/positions", dependencies=[Depends(require_ops_key)], status_code=201)
def create_position(payload: PositionCreate, db: Session = Depends(get_db)):
    ensure_portfolio_columns(db)
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    ticker = payload.ticker.strip().upper()

    existing = (
        db.query(Position)
        .filter(Position.portfolio_id == portfolio.id, Position.ticker == ticker)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"{ticker} is already in the book — edit it instead.",
        )

    shares = _resolve_shares(payload.shares, payload.notional, payload.entry_price)
    cost = shares * payload.entry_price
    _spend_cash(portfolio, cost)

    sector = payload.sector
    if sector is None:
        stock = db.get(Stock, ticker)
        sector = stock.sector if stock else None

    pos = Position(
        portfolio_id=portfolio.id,
        ticker=ticker,
        shares=shares,
        avg_cost=payload.entry_price,
        current_price=payload.current_price or payload.entry_price,
        entry_date=payload.entry_date or date.today(),
        initial_investment=cost,
        sector=sector,
    )
    db.add(pos)
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="buy",
            shares=shares,
            price=payload.entry_price,
            notional=cost,
            reason="Manual entry (admin)",
            action="manual_buy",
            # Stamp the trade with when the position was OPENED, not when the
            # row was written. The server default is now(), which dated every
            # hand-entered historical pick to the day it was typed in and
            # collapsed the benchmark comparison to a single point.
            timestamp=datetime.combine(
                pos.entry_date, time.min, tzinfo=timezone.utc
            ),
        )
    )
    db.flush()
    _bump_peak_equity(db, portfolio)
    db.commit()
    db.refresh(pos)
    return {"position": _position_dict(pos), "cash": portfolio.cash}


@router.patch("/positions/{ticker}", dependencies=[Depends(require_ops_key)])
def update_position(ticker: str, payload: PositionUpdate, db: Session = Depends(get_db)):
    ensure_portfolio_columns(db)
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    symbol = ticker.strip().upper()
    pos = (
        db.query(Position)
        .filter(Position.portfolio_id == portfolio.id, Position.ticker == symbol)
        .first()
    )
    if not pos:
        raise HTTPException(status_code=404, detail=f"{symbol} is not in the book.")

    new_price = payload.entry_price if payload.entry_price is not None else pos.avg_cost
    if new_price <= 0:
        raise HTTPException(status_code=422, detail="Entry price must be greater than zero.")

    if payload.shares is None and payload.notional is None:
        new_shares = pos.shares
    else:
        new_shares = _resolve_shares(payload.shares, payload.notional, new_price)

    old_cost = pos.shares * (pos.avg_cost or 0.0)
    new_cost = new_shares * new_price
    _spend_cash(portfolio, new_cost - old_cost)

    pos.shares = new_shares
    pos.avg_cost = new_price
    pos.initial_investment = new_cost
    if payload.entry_date is not None:
        pos.entry_date = payload.entry_date
    if payload.sector is not None:
        pos.sector = payload.sector or None
    if payload.current_price is not None:
        pos.current_price = payload.current_price
    elif not pos.current_price:
        pos.current_price = new_price

    db.flush()
    _bump_peak_equity(db, portfolio)
    db.commit()
    db.refresh(pos)
    return {"position": _position_dict(pos), "cash": portfolio.cash}


@router.delete("/positions/{ticker}", dependencies=[Depends(require_ops_key)])
def delete_position(ticker: str, db: Session = Depends(get_db)):
    ensure_portfolio_columns(db)
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    symbol = ticker.strip().upper()
    pos = (
        db.query(Position)
        .filter(Position.portfolio_id == portfolio.id, Position.ticker == symbol)
        .first()
    )
    if not pos:
        raise HTTPException(status_code=404, detail=f"{symbol} is not in the book.")

    # Refund the cost basis — this is an admin correction, not a market sale.
    refund = pos.shares * (pos.avg_cost or 0.0)
    shares = pos.shares
    price = pos.avg_cost or 0.0
    portfolio.cash = round(portfolio.cash + refund, 6)
    db.delete(pos)
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=symbol,
            side="sell",
            shares=shares,
            price=price,
            notional=refund,
            reason="Manual removal (admin)",
            action="manual_remove",
        )
    )
    db.flush()
    _bump_peak_equity(db, portfolio)
    db.commit()
    return {"deleted": symbol, "cash_returned": refund, "cash": portfolio.cash}


@router.get("/evaluations", dependencies=[Depends(require_ops_key)])
def list_evaluations(db: Session = Depends(get_db), limit: int = 50):
    rows = (
        db.query(Evaluation)
        .order_by(Evaluation.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "evaluations": [
            {
                "id": e.id,
                "mode": e.mode,
                "params_version": e.params_version,
                "executed": e.executed,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "portfolio_snapshot": e.portfolio_snapshot,
                "signal_count": len(e.signals) if e.signals else 0,
            }
            for e in rows
        ]
    }


@router.get("/evaluations/{evaluation_id}", dependencies=[Depends(require_ops_key)])
def get_evaluation(evaluation_id: int, db: Session = Depends(get_db)):
    ev = (
        db.query(Evaluation)
        .options(joinedload(Evaluation.signals).joinedload(SignalRow.reasons))
        .filter(Evaluation.id == evaluation_id)
        .first()
    )
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    return {
        "id": ev.id,
        "mode": ev.mode,
        "params_version": ev.params_version,
        "params": ev.params_json,
        "portfolio_snapshot": ev.portfolio_snapshot,
        "executed": ev.executed,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
        "signals": [
            {
                "id": s.id,
                "ticker": s.ticker,
                "action": s.action,
                "reason": s.reason,
                "sell_shares": s.sell_shares,
                "keep_shares": s.keep_shares,
                "score": s.score_json,
                "metadata": s.metadata_json,
                "executed": s.executed,
                "rules": [
                    {
                        "rule_id": r.rule_id,
                        "passed": r.passed,
                        "inputs": r.inputs,
                        "threshold": r.threshold,
                        "message": r.message,
                    }
                    for r in s.reasons
                ],
            }
            for s in ev.signals
        ],
    }


@router.post("/evaluate", dependencies=[Depends(require_ops_key)])
def trigger_evaluate(dry_run: bool = True, mode: str = "biweekly", db: Session = Depends(get_db)):
    ensure_default_portfolio(db, get_settings().initial_cash)
    ev = run_evaluation(db, portfolio_id=1, mode=mode, dry_run=dry_run)
    return {"evaluation_id": ev.id, "mode": ev.mode, "executed": ev.executed}


def _universe_diagnosis(db: Session, scored: int) -> dict:
    """Why is the universe unscored? Distinguish the three real causes.

    "Check that weekly_refresh has run" is the wrong advice when it HAS run and
    every ticker was rejected by the factor-coverage floor — which is the
    expected state on a database whose fundamentals only span a single date,
    because estimate revisions need two snapshots to exist at all.
    """
    if scored:
        return {"state": "scored"}

    from app.db.models import Fundamentals

    dates = [
        row[0]
        for row in db.query(Fundamentals.as_of)
        .distinct()
        .order_by(Fundamentals.as_of.desc())
        .limit(2)
        .all()
    ]
    if not dates:
        return {
            "state": "no_fundamentals",
            "detail": "No fundamentals have been ingested. Run a universe refresh.",
        }
    if len(dates) < 2:
        return {
            "state": "awaiting_second_snapshot",
            "snapshot_dates": [d.isoformat() for d in dates],
            "detail": (
                "Fundamentals exist for one date only. Estimate revisions are "
                "measured between two snapshots, so the revisions factor cannot "
                "be computed yet and every ticker fails the factor-coverage "
                "floor. This clears on the next refresh dated after "
                f"{dates[0].isoformat()}."
            ),
        }
    # Name the factor rather than sending the operator to the worker log. The
    # log is on a different service, rotates, and the answer here is a single
    # number per factor that we can just compute. `momentum` in particular
    # points at price history: `backfill_prices` is deliberately unscheduled,
    # so a database that never had it run fails coverage on every ticker
    # forever with nothing in the UI saying why.
    breakdown: dict[str, int] = {}
    considered = 0
    try:
        from worker.services.scoring import preview_scores

        portfolio = db.get(Portfolio, 1)
        params = params_from_portfolio(portfolio) if portfolio else RUN118_PARAMS
        _snapshots, breakdown, considered = preview_scores(db, params, date.today())
    except Exception as e:  # pragma: no cover - diagnostic must never 500
        log.warning("Could not compute missing-factor breakdown: %s", e)

    absent = sorted(
        (name for name, n in breakdown.items() if n >= considered > 0),
    )
    detail = (
        "Fundamentals span multiple dates but no ticker cleared the "
        "factor-coverage floor."
    )
    if absent:
        detail += (
            f" {', '.join(absent)} is missing for EVERY ticker considered "
            f"({considered}). "
        )
        if "momentum" in absent:
            detail += (
                "Momentum needs ~12 months of daily closes; run the "
                "backfill_prices job, which is not on any schedule."
            )
        elif "revisions" in absent:
            detail += (
                "Revisions need two fundamentals snapshots spanning the "
                "lookback; another refresh will clear it."
            )
    return {
        "state": "coverage_floor",
        "snapshot_dates": [d.isoformat() for d in dates],
        "considered": considered,
        "missing_by_factor": breakdown,
        "absent_factors": absent,
        "detail": detail,
    }


def _simulation_params(params, missing: dict[str, int], considered: int):
    """Relax ONLY the rules a genuinely absent factor makes unanswerable.

    A factor with no data for the entire universe is not evidence that every
    company is bad at it, so leaving it to grade F and veto every buy tells the
    operator nothing. Waive those, keep every other Run 118 rule intact, and
    report exactly what was waived.
    """
    absent = {name for name, count in missing.items() if count >= considered > 0}
    waived: list[str] = []
    criteria = params.buy_criteria
    if "revisions" in absent:
        criteria = dataclasses.replace(criteria, min_revisions_grade="F")
        waived.append("min_revisions_grade")
    if "growth" in absent:
        criteria = dataclasses.replace(criteria, min_growth_grade="F")
        waived.append("min_growth_grade")

    weights = params.factor_weights()
    total = sum(weights.values()) or 1.0
    present = total - sum(weights.get(name, 0.0) for name in absent)
    sim = params.with_overrides(
        min_factor_coverage=min(params.min_factor_coverage, present / total),
        buy_criteria=criteria,
    )
    if absent:
        waived.append(f"factor_coverage({', '.join(sorted(absent))} absent)")
    return sim, waived, sorted(absent)


@router.get("/dry-run", dependencies=[Depends(require_ops_key)])
def dry_run_preview(simulate: bool = False, db: Session = Depends(get_db)):
    """What would we do next eval? Does not persist trades.

    `simulate=true` re-scores the universe in memory with the rules that a
    universe-wide missing factor makes unanswerable waived, so an operator can
    still see which name the strategy favours today. It is NOT a Run 118
    decision and never writes.
    """
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    params = params_from_portfolio(portfolio)
    state = load_portfolio_state(db, portfolio)

    simulation: dict | None = None
    if simulate:
        from worker.services.scoring import preview_scores

        as_of = date.today()
        _, missing, considered = preview_scores(db, params, as_of)
        params, waived, absent = _simulation_params(params, missing, considered)
        scores, _, _ = preview_scores(db, params, as_of)
        simulation = {
            "enabled": True,
            "waived_rules": waived,
            "absent_factors": absent,
            "considered": considered,
        }
    else:
        scores = load_latest_scores(db)

    ranked = ranked_candidates(scores)
    signals = evaluate(state, scores, ranked, params)
    # Without these counts an empty `signals` list is ambiguous: it reads as
    # "the strategy considered the universe and chose to do nothing" when it can
    # equally mean "there was no universe to consider". `_removal_signals` skips
    # any holding with no score and `_buy_signals` iterates the ranked list, so
    # an unscored universe yields zero signals and zero explanation.
    scored_held = sum(1 for t in state.positions if t in scores)
    return {
        "diagnosis": _universe_diagnosis(db, len(scores)),
        "simulation": simulation,
        "target_notional": params.target_notional(state.equity),
        "params_version": params.version_hash(),
        "portfolio": {
            "cash": state.cash,
            "equity": state.equity,
            "position_count": state.position_count(),
        },
        "universe": {
            "scored_tickers": len(scores),
            "ranked_candidates": len(ranked),
            "held_with_scores": scored_held,
            # Estimate revisions need two fundamentals snapshots spanning the
            # lookback, so on a fresh database this factor is null for the whole
            # universe, grades "F", and fails min_revisions_grade — blocking
            # every buy. That is deliberate (see compute_estimate_revisions),
            # but without a number here it is indistinguishable from a strategy
            # that simply found nothing worth buying.
            "revisions_gate": params.buy_criteria.min_revisions_grade,
            "passing_revisions_gate": sum(
                1
                for s in scores.values()
                if grade_meets_minimum(
                    s.revisions_grade, params.buy_criteria.min_revisions_grade
                )
            ),
        },
        "signals": [s.to_dict() for s in signals],
    }


@router.get("/trades", dependencies=[Depends(require_ops_key)])
def ops_trades(db: Session = Depends(get_db), limit: int = 100):
    rows = (
        db.query(Trade)
        .filter(Trade.portfolio_id == 1)
        .order_by(Trade.timestamp.desc())
        .limit(limit)
        .all()
    )
    return {
        "trades": [
            {
                "id": t.id,
                "ticker": t.ticker,
                "side": t.side,
                "action": t.action,
                "shares": t.shares,
                "price": t.price,
                "notional": t.notional,
                "reason": t.reason,
                "evaluation_id": t.evaluation_id,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            }
            for t in rows
        ]
    }


def _run_weekly_refresh_task() -> None:
    """Run the worker's weekly_refresh in a background thread.

    The worker package is imported lazily and inside the task: it is only on the
    API image's PYTHONPATH for this endpoint's sake, and an import error at
    module scope would take down the whole ops API rather than this one route.
    """
    try:
        from worker.jobs.runner import job_weekly_refresh

        job_weekly_refresh()
    except Exception:
        # job_weekly_refresh records its own failure through _track; this is the
        # last resort for an import error or a failure to even open a session.
        log.exception("Manual weekly_refresh failed")


@router.post("/refresh", dependencies=[Depends(require_ops_key)])
def trigger_refresh(background: BackgroundTasks, db: Session = Depends(get_db)):
    """Kick off universe → fundamentals → score → marks out of band.

    The full pass takes many minutes (FMP is throttled per request), far longer
    than a request should live, so this returns 202 immediately and the caller
    watches /jobs for the outcome.
    """
    cutoff = datetime.now(timezone.utc) - STALE_JOB_AFTER
    running = (
        db.query(JobRun)
        .filter(JobRun.job_name == "weekly_refresh", JobRun.status == "running")
        .order_by(JobRun.started_at.desc())
        .first()
    )
    if running is not None:
        started = running.started_at
        if started is not None and started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        if started is None or started > cutoff:
            raise HTTPException(
                status_code=409,
                detail="A refresh is already running; watch /api/ops/jobs.",
            )

    background.add_task(_run_weekly_refresh_task)
    return {"started": True, "job_name": "weekly_refresh"}


@router.get("/jobs", dependencies=[Depends(require_ops_key)])
def list_jobs(db: Session = Depends(get_db), limit: int = 30):
    rows = db.query(JobRun).order_by(JobRun.started_at.desc()).limit(limit).all()
    return {
        "jobs": [
            {
                "id": j.id,
                "job_name": j.job_name,
                "status": j.status,
                "detail": j.detail,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            }
            for j in rows
        ],
        "next_evaluation": _next_evaluation(db),
    }


def _next_evaluation(db: Session) -> dict:
    """Operator view of the evaluation cycle.

    `target` is the nominal Friday and is what subscribers are shown. `runs_on`
    is the session it will actually execute on, which moves EARLIER when the
    Friday is a market holiday — the scheduler fires all week and
    `is_effective_run_day` picks the day. Reporting only the Friday would make a
    correctly-early run look like a missed cycle.
    """
    from worker.services.market_calendar import last_trading_day_on_or_before

    today = date.today()
    target = next_evaluation_friday(today)
    runs_on = last_trading_day_on_or_before(target)
    if runs_on < today:
        # This cycle's session has already passed; the next one is the
        # following Friday's.
        target = next_evaluation_friday(target + timedelta(days=1))
        runs_on = last_trading_day_on_or_before(target)

    last = (
        db.query(JobRun)
        .filter(JobRun.job_name == "biweekly_evaluate")
        .order_by(JobRun.started_at.desc())
        .first()
    )
    return {
        "target": target.isoformat(),
        "runs_on": runs_on.isoformat(),
        "moved_for_holiday": runs_on != target,
        "last_run": {
            "status": last.status,
            "detail": last.detail,
            "started_at": last.started_at.isoformat() if last.started_at else None,
        }
        if last
        else None,
    }


@router.get("/health")
def ops_health():
    return {"ok": True}
