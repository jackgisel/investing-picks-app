"""Ops API — full virtual book + decision ledger + dry-run."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.db.models import Evaluation, JobRun, Portfolio, Position, SignalRow, Trade
from app.db.session import get_db
from app.services.portfolio import (
    ensure_default_portfolio,
    load_latest_scores,
    load_portfolio_state,
    params_from_portfolio,
    ranked_candidates,
    run_evaluation,
)
from outpick_strategy import evaluate, RUN118_PARAMS

router = APIRouter(prefix="/api/ops", tags=["ops"])


def require_ops_key(x_ops_key: str | None = Header(default=None)):
    settings = get_settings()
    if x_ops_key != settings.ops_api_key:
        raise HTTPException(status_code=401, detail="Invalid ops key")


@router.get("/portfolio", dependencies=[Depends(require_ops_key)])
def ops_portfolio(db: Session = Depends(get_db)):
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
        "params_version": params_from_portfolio(portfolio).version_hash(),
        "params": params_from_portfolio(portfolio).to_dict(),
        "run118_hash": RUN118_PARAMS.version_hash(),
        "positions": [
            {
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
                "is_house_money": p.initial_investment is not None
                and p.initial_investment <= 0,
                "sector": p.sector,
            }
            for p in positions
        ],
    }


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


@router.get("/dry-run", dependencies=[Depends(require_ops_key)])
def dry_run_preview(db: Session = Depends(get_db)):
    """What would we do next eval? Does not persist trades."""
    portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
    params = params_from_portfolio(portfolio)
    state = load_portfolio_state(db, portfolio)
    scores = load_latest_scores(db)
    ranked = ranked_candidates(scores)
    signals = evaluate(state, scores, ranked, params)
    return {
        "params_version": params.version_hash(),
        "portfolio": {
            "cash": state.cash,
            "equity": state.equity,
            "position_count": state.position_count(),
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
        ]
    }


@router.get("/health")
def ops_health():
    return {"ok": True}
