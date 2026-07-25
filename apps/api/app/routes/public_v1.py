"""Public dollar-free API (v1) — compatible with Outpick proxies."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.models import Portfolio, PortfolioSnapshot, Position, Trade
from app.db.session import get_db
from app.services.portfolio import (
    params_from_portfolio,
    picks_return,
    portfolio_equity,
    total_return_pct,
)

router = APIRouter(prefix="/api/v1", tags=["public"])


def _pnl_pct(entry: float | None, current: float | None) -> float | None:
    if not entry or not current or entry <= 0:
        return None
    return round((current - entry) / entry * 100, 2)


@router.get("/strategy")
def get_strategy(db: Session = Depends(get_db)):
    portfolio = db.get(Portfolio, 1)
    if not portfolio:
        return {
            "strategy": {
                "name": "AP Strategy",
                "description": "Run 118 growth + revisions with conviction adds and active recycling",
                "evaluation_frequency": "biweekly",
                "max_positions": 50,
            },
            "portfolio": {
                "position_count": 0,
                "picks_return_pct": None,
                "total_return_pct": None,
                "tickers": [],
            },
            "holdings": [],
            "params_version": None,
            "params": None,
            "name": "AP Strategy",
            "evaluation_frequency": "biweekly",
            "max_positions": 50,
            "position_count": 0,
        }
    params = params_from_portfolio(portfolio)
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    _cash, value, equity = portfolio_equity(db, portfolio)
    # Equity-based: (cash + holdings) / initial capital - 1. Counts cash and all
    # realized P&L, and is immune to house-money positions.
    total_return = total_return_pct(db, portfolio)
    picks = picks_return(db, portfolio)
    holdings = [
        {
            "ticker": p.ticker,
            "entry_date": p.entry_date.isoformat() if p.entry_date else None,
            # avg_cost is preserved through Winners Circle partial sells now, so
            # house-money holdings report their real gain instead of a flat 0%.
            "pnl_pct": _pnl_pct(p.avg_cost, p.current_price) or 0,
            "is_house_money": bool(p.is_house_money),
            "weight_pct": round(p.market_value / equity * 100, 2) if equity else 0,
            "sector": p.sector,
        }
        for p in positions
    ]
    return {
        # Legacy Outpick shape
        "strategy": {
            "name": portfolio.name,
            "description": "Run 118 growth + revisions with conviction adds and active recycling",
            "evaluation_frequency": params.eval_frequency,
            "max_positions": params.max_positions,
        },
        "portfolio": {
            "position_count": len(positions),
            # Return on capital deployed into picks — the research product's
            # headline. Excludes idle cash; includes closed picks.
            "picks_return_pct": picks.get("return_pct"),
            "picks": picks,
            # Whole-book equity return, cash drag included. Kept because it is
            # the honest portfolio-level number and the chart indexes off it.
            "total_return_pct": total_return,
            "tickers": sorted(p.ticker for p in positions),
        },
        "holdings": holdings,
        # Extended fields for ops / new strategy page
        "name": portfolio.name,
        "evaluation_frequency": params.eval_frequency,
        "max_positions": params.max_positions,
        "position_count": len(positions),
        "params_version": params.version_hash(),
        "params": params.to_dict(),
    }


@router.get("/picks")
def get_picks(
    status: str = Query("all"),
    db: Session = Depends(get_db),
):
    portfolio = db.get(Portfolio, 1)
    if not portfolio:
        return {"count": 0, "picks": []}
    picks = []
    if status in ("all", "active"):
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all():
            picks.append(
                {
                    "ticker": p.ticker,
                    "status": "active",
                    "entry_date": p.entry_date.isoformat() if p.entry_date else None,
                    "pnl_pct": _pnl_pct(p.avg_cost, p.current_price),
                    "exit_date": None,
                    "exit_reason": None,
                    "blog_slug": None,
                }
            )
    if status in ("all", "closed"):
        sells = (
            db.query(Trade)
            .filter(Trade.portfolio_id == portfolio.id, Trade.side == "sell", Trade.action == "full_sell")
            .order_by(Trade.timestamp.desc())
            .all()
        )
        for t in sells:
            buy = (
                db.query(Trade)
                .filter(
                    Trade.portfolio_id == portfolio.id,
                    Trade.ticker == t.ticker,
                    Trade.side == "buy",
                    Trade.timestamp < t.timestamp,
                )
                .order_by(Trade.timestamp.desc())
                .first()
            )
            picks.append(
                {
                    "ticker": t.ticker,
                    "status": "closed",
                    "entry_date": buy.timestamp.date().isoformat() if buy and buy.timestamp else None,
                    "pnl_pct": _pnl_pct(buy.price if buy else None, t.price),
                    "exit_date": t.timestamp.date().isoformat() if t.timestamp else None,
                    "exit_reason": t.reason,
                    "blog_slug": None,
                }
            )
    return {"status": status, "count": len(picks), "picks": picks}


@router.get("/trades")
def get_trades(db: Session = Depends(get_db), limit: int = 100):
    rows = (
        db.query(Trade)
        .filter(Trade.portfolio_id == 1)
        .order_by(Trade.timestamp.desc())
        .limit(limit)
        .all()
    )
    return {
        "count": len(rows),
        "trades": [
            {
                "ticker": t.ticker,
                "side": t.side,
                "action": t.action,
                "date": t.timestamp.date().isoformat() if t.timestamp else None,
                "reason": t.reason,
                "evaluation_id": t.evaluation_id,
            }
            for t in rows
        ],
    }


@router.get("/performance")
def get_performance(db: Session = Depends(get_db)):
    snaps = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == 1)
        .order_by(PortfolioSnapshot.date.asc())
        .all()
    )
    positions = db.query(Position).filter(Position.portfolio_id == 1).all()
    portfolio = db.get(Portfolio, 1)
    # Same equity-based number as /strategy, so the headline agrees with the
    # last point of the chart below instead of contradicting it.
    live_return = total_return_pct(db, portfolio) if portfolio else None

    if not snaps:
        return {
            "series": [],
            "summary": {
                "position_count": len(positions),
                "total_return_pct": live_return,
            },
        }

    base = snaps[0].total_value or 1
    spy_base = snaps[0].spy_value
    series = []
    for s in snaps:
        ret = (s.total_value / base - 1) * 100 if base else 0
        spy_ret = None
        if s.spy_value and spy_base:
            spy_ret = (s.spy_value / spy_base - 1) * 100
        series.append(
            {
                "date": s.date.isoformat(),
                "return_pct": round(ret, 2),
                "portfolio_pct": round(ret, 4),
                "spy_return_pct": round(spy_ret, 2) if spy_ret is not None else None,
                "benchmark_pct": round(spy_ret, 4) if spy_ret is not None else None,
            }
        )
    last = series[-1]["return_pct"] if series else 0
    return {
        "series": series,
        "summary": {
            "start_date": snaps[0].date.isoformat(),
            "latest_date": snaps[-1].date.isoformat(),
            "total_return_pct": live_return if live_return is not None else last,
            "snapshot_return_pct": last,
            "position_count": snaps[-1].position_count if snaps else len(positions),
            "snapshots": len(snaps),
        },
    }


@router.get("/chart")
def get_chart(db: Session = Depends(get_db)):
    """Alias for performance (legacy frontend hook)."""
    return get_performance(db)
