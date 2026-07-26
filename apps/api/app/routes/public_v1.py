"""Public dollar-free API (v1) — compatible with Outpick proxies."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from outpick_strategy import quant_to_signal

from app.db.models import (
    CompositeScore,
    Portfolio,
    PortfolioSnapshot,
    Position,
    Trade,
)
from app.db.session import get_db
from app.services.benchmarks import benchmark_series, picks_series
from app.services.portfolio import (
    params_from_portfolio,
    picks_return,
    portfolio_equity,
    total_return_pct,
)

router = APIRouter(prefix="/api/v1", tags=["public"])

#: Shortest live window we will annualize. Below this, extrapolating to a year
#: is arithmetic rather than evidence — a 26.81% return over one day annualizes
#: to something like 10^100%, which is why the landing page's CAGR used to be a
#: bare em-dash. One quarter is the conventional floor for quoting an annualized
#: figure, and this is a public performance claim on an investing product, so we
#: would rather show nothing than something unjustifiable.
MIN_CAGR_WINDOW_DAYS = 90

#: How much of the book's life must actually be covered by daily snapshots
#: before we annualize. The return itself comes from live positions and trades,
#: but a CAGR quoted next to a two-point chart is not a track record anyone can
#: check, and the two elapsed-time notions must agree.
MIN_HISTORY_COVERAGE = 0.8


def annualize_return(
    total_return_pct_value: float | None,
    days_live: int | None,
    days_recorded: int | None,
) -> dict:
    """Annualize a since-inception return, or explain why we won't.

    `days_live` — wall-clock days since inception — is the ONLY correct
    denominator here, because `total_return_pct_value` is itself a
    since-inception number. Annualizing it over the length of the snapshot
    window instead is what produced the original bug: the card claimed "Day 115"
    beside a CAGR computed over the 1 day of history the table happened to hold.

    `days_recorded` is not a denominator. It is a credibility check: if the
    daily history does not substantially cover the book's life, the chart cannot
    corroborate the claim and we decline to make it.

    Always returns a `status`, never a bare null, so the UI can say *why* the
    number is missing rather than rendering an unexplained em-dash.
    """
    out = {
        "annualized_return_pct": None,
        "annualized_status": "unavailable",
        "days_live": days_live,
        "days_recorded": days_recorded,
        "min_window_days": MIN_CAGR_WINDOW_DAYS,
        "min_history_coverage": MIN_HISTORY_COVERAGE,
    }
    if total_return_pct_value is None or days_live is None or days_live <= 0:
        return out

    if days_live < MIN_CAGR_WINDOW_DAYS:
        out["annualized_status"] = "window_too_short"
        return out

    if days_recorded is None or days_recorded < MIN_HISTORY_COVERAGE * days_live:
        out["annualized_status"] = "insufficient_history"
        return out

    multiple = 1 + total_return_pct_value / 100
    if multiple <= 0:
        # A total wipeout has no finite annualized rate.
        out["annualized_status"] = "not_meaningful"
        return out

    out["annualized_return_pct"] = round((multiple ** (365 / days_live) - 1) * 100, 2)
    out["annualized_status"] = "ok"
    return out


def _inception_date(portfolio: Portfolio | None, snaps: list[PortfolioSnapshot]) -> date | None:
    """When the live track record began.

    The configured inception wins; the first snapshot is the fallback so a book
    with no configured date still reports a window rather than nothing.
    """
    configured = getattr(portfolio, "inception_date", None) if portfolio else None
    if configured:
        return configured
    return snaps[0].date if snaps else None


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


def _latest_ratings(db: Session) -> dict[str, float]:
    """Quant rating per ticker from the most recent scoring date.

    Scoped to a single `as_of` so a name that dropped out of the latest run
    cannot be shown with a rating from an earlier one — an unscored holding must
    read as unrated, not as stale-but-confident.
    """
    latest = db.query(func.max(CompositeScore.as_of)).scalar()
    if latest is None:
        return {}
    return {
        row.ticker: row.quant_rating
        for row in db.query(CompositeScore).filter(CompositeScore.as_of == latest).all()
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
        ratings = _latest_ratings(db)
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all():
            rating = ratings.get(p.ticker)
            picks.append(
                {
                    "ticker": p.ticker,
                    "status": "active",
                    "entry_date": p.entry_date.isoformat() if p.entry_date else None,
                    "pnl_pct": _pnl_pct(p.avg_cost, p.current_price),
                    "exit_date": None,
                    "exit_reason": None,
                    "blog_slug": None,
                    # The strategy's current read on a name we already hold.
                    # None when the universe is unscored — better to show
                    # nothing than to imply a rating we do not stand behind.
                    "quant_rating": round(rating, 3) if rating is not None else None,
                    "signal": quant_to_signal(rating) if rating is not None else None,
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
    # Same equity-based number as /strategy, so the chart's own series agrees
    # with it instead of contradicting it.
    live_return = total_return_pct(db, portfolio) if portfolio else None

    # The CAGR must annualize whatever the site actually headlines, which is the
    # return on capital deployed into picks — not the equity return. Annualizing
    # a different base than the one displayed put "+26.81% total return" beside
    # a CAGR derived from 2.14%, two numbers that cannot both describe the same
    # book. Outpick sells research, so the picks return is the headline and the
    # CAGR follows it.
    annualized_base = (
        picks_return(db, portfolio).get("return_pct") if portfolio else None
    )
    if annualized_base is None:
        annualized_base = live_return

    today = date.today()
    inception = _inception_date(portfolio, snaps)
    days_live = (today - inception).days if inception else None
    days_recorded = (snaps[-1].date - snaps[0].date).days if snaps else 0

    if not snaps:
        return {
            "series": [],
            "summary": {
                "position_count": len(positions),
                "total_return_pct": live_return,
                "inception_date": inception.isoformat() if inception else None,
                "snapshots": 0,
                **annualize_return(annualized_base, days_live, 0),
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
    headline = live_return if live_return is not None else last

    # Money-weighted comparison: the same dollars, committed on the same dates,
    # into each index. Plotting book equity against a fully invested index is
    # not a like-for-like comparison — the book is mostly cash, so the index
    # wins regardless of how the picks did, which contradicts the headline
    # sitting directly above the chart.
    bench = benchmark_series(db, portfolio_id=1)
    picks_line = picks_series(db, portfolio_id=1)

    return {
        "series": series,
        "picks_series": picks_line,
        "benchmarks": bench,
        "summary": {
            "start_date": snaps[0].date.isoformat(),
            "latest_date": snaps[-1].date.isoformat(),
            # The book's own age. `start_date`/`latest_date` describe the data
            # window, which is a different thing and must not be used to
            # annualize a since-inception return — see `annualize_return`.
            "inception_date": inception.isoformat() if inception else None,
            "total_return_pct": headline,
            "snapshot_return_pct": last,
            "position_count": snaps[-1].position_count if snaps else len(positions),
            "snapshots": len(snaps),
            **annualize_return(annualized_base, days_live, days_recorded),
        },
    }


@router.get("/chart")
def get_chart(db: Session = Depends(get_db)):
    """Alias for performance (legacy frontend hook)."""
    return get_performance(db)
