"""Public dollar-free API (v1) — compatible with Outpick proxies."""

from __future__ import annotations

import logging
import math
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from outpick_strategy import next_evaluation_friday, quant_to_signal

from app.db.models import (
    CompositeScore,
    Fundamentals,
    Portfolio,
    PortfolioSnapshot,
    Position,
    Stock,
    Trade,
)
from app.db.session import get_db
from app.services.benchmarks import benchmark_series, picks_series
from app.services.portfolio import (
    exit_basis,
    params_from_portfolio,
    picks_return,
    portfolio_equity,
    total_return_pct,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["public"])

_INTERNAL_TRADE_REASON_LABELS = {
    "Manual entry (admin)": "Added to the live portfolio",
    "Manual edit (admin)": "Position record adjusted",
    "Manual removal (admin)": "Removed from the live portfolio",
}


def _public_trade_reason(reason: str | None) -> str | None:
    """Keep operational ledger labels out of the subscriber-facing API."""
    if reason is None:
        return None
    return _INTERNAL_TRADE_REASON_LABELS.get(reason, reason)

#: What `/performance`'s `total_return_pct` — and the CAGR derived from it —
#: measure. Published so the two figures cannot be read against the wrong base.
RETURN_BASIS = "portfolio_equity"

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
    prefix: str = "",
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

    `prefix` namespaces the output keys so one payload can carry the same
    calculation on two different bases without either overwriting the other.
    The window fields (`days_live`, `days_recorded`, the thresholds) describe
    the book rather than the base and are deliberately NOT prefixed — they are
    identical for every basis, and duplicating them would invite the two copies
    to drift.
    """
    out = {
        f"{prefix}annualized_return_pct": None,
        f"{prefix}annualized_status": "unavailable",
        "days_live": days_live,
        "days_recorded": days_recorded,
        "min_window_days": MIN_CAGR_WINDOW_DAYS,
        "min_history_coverage": MIN_HISTORY_COVERAGE,
    }
    if total_return_pct_value is None or days_live is None or days_live <= 0:
        return out

    if days_live < MIN_CAGR_WINDOW_DAYS:
        out[f"{prefix}annualized_status"] = "window_too_short"
        return out

    if days_recorded is None or days_recorded < MIN_HISTORY_COVERAGE * days_live:
        out[f"{prefix}annualized_status"] = "insufficient_history"
        return out

    multiple = 1 + total_return_pct_value / 100
    if multiple <= 0:
        # A total wipeout has no finite annualized rate.
        out[f"{prefix}annualized_status"] = "not_meaningful"
        return out

    out[f"{prefix}annualized_return_pct"] = round(
        (multiple ** (365 / days_live) - 1) * 100, 2
    )
    out[f"{prefix}annualized_status"] = "ok"
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
    """Percent P&L, or None when it is genuinely unknown.

    `current` is checked against None rather than tested for truth: a holding
    marked at $0 is a real -100%, and rejecting it as falsy published a delisted
    position worth nothing as a flat 0.00%. A missing basis still returns None,
    and callers must publish that None — see the holdings table below.
    """
    if entry is None or current is None or entry <= 0:
        return None
    return round((current - entry) / entry * 100, 2)


def _finite_number(value) -> float | None:
    """A JSON-safe finite float, or null for absent/malformed provider data."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    number = float(value)
    return number if math.isfinite(number) else None



def _with_live_mark(facts: dict | None, mark: float | None) -> dict | None:
    """Stamp the holding's live mark onto company fundamentals when present."""
    if facts is None:
        return None
    live = _finite_number(mark)
    if live is None:
        return facts
    return {**facts, "mark": live}


def _latest_fundamentals_by_ticker(
    db: Session, tickers: list[str]
) -> dict[str, dict]:
    """Public company facts from the newest point-in-time row per ticker.

    The worker stores decimals (0.12 == 12%); this API names and returns actual
    percentage values so every consumer formats the same number. Only reported
    growth and consensus facts cross this boundary — no factor grades, weights,
    thresholds, or other strategy rules.
    """
    if not tickers:
        return {}

    latest = (
        db.query(
            Fundamentals.ticker.label("ticker"),
            func.max(Fundamentals.as_of).label("as_of"),
        )
        .filter(Fundamentals.ticker.in_(tickers))
        .group_by(Fundamentals.ticker)
        .subquery()
    )
    rows = (
        db.query(Fundamentals)
        .join(
            latest,
            and_(
                Fundamentals.ticker == latest.c.ticker,
                Fundamentals.as_of == latest.c.as_of,
            ),
        )
        .all()
    )

    def pct(data: dict, key: str) -> float | None:
        value = _finite_number(data.get(key))
        return round(value * 100, 2) if value is not None else None

    def surprise(data: dict, actual_key: str, estimate_key: str) -> float | None:
        actual = _finite_number(data.get(actual_key))
        estimate = _finite_number(data.get(estimate_key))
        if actual is None or estimate is None or estimate == 0:
            return None
        return round((actual - estimate) / abs(estimate) * 100, 2)

    marks = {
        ticker: last_price
        for ticker, last_price in db.query(Stock.ticker, Stock.last_price)
        .filter(Stock.ticker.in_(tickers))
        .all()
    }

    result: dict[str, dict] = {}
    for row in rows:
        data = row.data or {}
        result[row.ticker] = {
            "as_of": row.as_of.isoformat(),
            "growth_basis_period": data.get("growthBasisPeriod"),
            "estimate_period": data.get("estimatePeriod"),
            "revenue_growth_ttm_pct": pct(data, "revenueGrowthTTM"),
            "eps_growth_ttm_pct": pct(data, "epsGrowthTTM"),
            "revenue_estimate": _finite_number(data.get("revenueEstimateAvg")),
            "eps_estimate": _finite_number(data.get("epsEstimateAvg")),
            "revenue_revision_pct": pct(data, "revenueRevisionPct"),
            "eps_revision_pct": pct(data, "epsRevisionPct"),
            "earnings_report_date": data.get("earningsReportDate"),
            "revenue_actual": _finite_number(data.get("revenueActual")),
            "revenue_report_estimate": _finite_number(data.get("revenueEstimated")),
            "revenue_surprise_pct": surprise(
                data, "revenueActual", "revenueEstimated"
            ),
            "eps_actual": _finite_number(data.get("epsActual")),
            "eps_report_estimate": _finite_number(data.get("epsEstimated")),
            "eps_surprise_pct": surprise(data, "epsActual", "epsEstimated"),
            # Street price-target consensus vs the latest mark. Display context
            # only — never an Outpick target.
            "mark": _finite_number(marks.get(row.ticker)),
            "price_target_low": _finite_number(data.get("priceTargetLow")),
            "price_target_mean": _finite_number(data.get("priceTargetMean")),
            "price_target_high": _finite_number(data.get("priceTargetHigh")),
            "price_target_analyst_count": _finite_number(
                data.get("priceTargetAnalystCount")
            ),
        }
    return result


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
            "next_evaluation_date": next_evaluation_friday(date.today()).isoformat(),
        }
    params = params_from_portfolio(portfolio)
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    _cash, value, equity = portfolio_equity(db, portfolio)
    # Equity-based: (cash + holdings) / initial capital - 1. Counts cash and all
    # realized P&L, and is immune to house-money positions.
    total_return = total_return_pct(db, portfolio)
    picks = picks_return(db, portfolio)
    sectors = _sector_by_ticker(db, [p.ticker for p in positions])
    names = _name_by_ticker(db, [p.ticker for p in positions])
    fundamentals = _latest_fundamentals_by_ticker(
        db, [p.ticker for p in positions]
    )
    holdings = [
        {
            "ticker": p.ticker,
            "entry_date": p.entry_date.isoformat() if p.entry_date else None,
            # avg_cost is preserved through Winners Circle partial sells now, so
            # house-money holdings report their real gain instead of a flat 0%.
            # Published as null when unknown, never coerced to 0: `or 0` turned
            # a position whose basis could not be rebuilt — the case
            # _recover_avg_cost_from_trades logs as "P&L will read as
            # unavailable" — into a confident 0.00%, which is a claim.
            "pnl_pct": _pnl_pct(p.avg_cost, p.current_price),
            "is_house_money": bool(p.is_house_money),
            "weight_pct": round(p.market_value / equity * 100, 2) if equity else 0,
            "sector": p.sector or sectors.get(p.ticker),
            "name": names.get(p.ticker),
            "fundamentals": _with_live_mark(fundamentals.get(p.ticker), p.current_price),
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
        # public_dict(), never to_dict(): the latter carries the factor
        # weights and every rating threshold, i.e. the model. See
        # StrategyParams.PUBLIC_FIELDS.
        "params": params.public_dict(),
        # When the book is next re-evaluated. Published because the cadence is
        # otherwise invisible: a subscriber watching a static holdings table has
        # no way to tell a strategy that decided to do nothing from one that is
        # simply between cycles.
        "next_evaluation_date": next_evaluation_friday(date.today()).isoformat(),
    }


def _name_by_ticker(db: Session, tickers: list[str]) -> dict[str, str | None]:
    """Company name from the `stocks` reference table, keyed by ticker.

    Same read-time-fallback reasoning as `_sector_by_ticker`: `stocks` is the
    canonical reference and is refreshed from the FMP profile on every ingest.
    Carried on holdings so the marketing side can label a position with a name
    rather than a bare ticker — the reader we are pitching owns index funds and
    does not necessarily know what AVGO is.
    """
    if not tickers:
        return {}
    rows = db.query(Stock.ticker, Stock.name).filter(Stock.ticker.in_(tickers)).all()
    return {ticker: name for ticker, name in rows}


def _sector_by_ticker(db: Session, tickers: list[str]) -> dict[str, str | None]:
    """Sector from the `stocks` reference table, keyed by ticker.

    `Position.sector` is stamped at buy time from the score snapshot, so every
    position opened by the engine has one. The live book was seeded by hand and
    those rows have NULL — which rendered the entire portfolio as
    "Unclassified" on the dashboard even though `stocks` has the real sector,
    refreshed from the FMP profile on every ingest.

    Read-time fallback rather than a backfill migration: `stocks` is the
    canonical reference and stays current, so this also heals any future row
    whose sector was missing at entry.

    Note this is display only. The strategy's own sector-concentration cap
    reads `CompositeScore.sector` first (signals.py), so it was never affected.
    """
    if not tickers:
        return {}
    rows = db.query(Stock.ticker, Stock.sector).filter(Stock.ticker.in_(tickers)).all()
    return {ticker: sector for ticker, sector in rows}


def _latest_ratings(db: Session) -> tuple[dict[str, float], date | None]:
    """Quant ratings from the most recent scoring date, and that date.

    Scoped to a single `as_of` so a name that dropped out of the latest run
    cannot be shown with a rating from an earlier one — an unscored holding must
    read as unrated, not as stale-but-confident.

    The date is returned rather than left implicit because the UI publishes
    these ratings next to holdings a subscriber may be buying into. Scoring can
    fall behind (a failed worker run, a coverage-floor rejection), and a badge
    with no date on it reads as today's view regardless of when it was struck.
    """
    latest = db.query(func.max(CompositeScore.as_of)).scalar()
    if latest is None:
        return {}, None
    return {
        row.ticker: row.quant_rating
        for row in db.query(CompositeScore).filter(CompositeScore.as_of == latest).all()
    }, latest


@router.get("/picks")
def get_picks(
    status: str = Query("all"),
    db: Session = Depends(get_db),
):
    portfolio = db.get(Portfolio, 1)
    if not portfolio:
        return {"count": 0, "picks": []}
    picks = []
    rating_as_of: date | None = None
    if status in ("all", "active"):
        ratings, rating_as_of = _latest_ratings(db)
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
        # Average cost of the WHOLE position at each exit, not the price of the
        # single most recent buy before it. Pricing an exit off the last lot
        # discarded every earlier one: buy 100 @ $10, add 100 @ $30, sell 200 @
        # $25 is +25% and published as -16.67%. `allow_double_buy` is on in Run
        # 118, and this field is what the web app's closedWinRate() classifies
        # win/loss from — so a real winner was being counted as a loss.
        basis = exit_basis(
            db.query(Trade).filter(Trade.portfolio_id == portfolio.id).all()
        )
        sells = (
            db.query(Trade)
            .filter(Trade.portfolio_id == portfolio.id, Trade.side == "sell", Trade.action == "full_sell")
            .order_by(Trade.timestamp.desc())
            .all()
        )
        for t in sells:
            lot = basis.get(t.id) or {}
            opened = lot.get("opened")
            picks.append(
                {
                    "ticker": t.ticker,
                    "status": "closed",
                    # When the round trip was OPENED, for the same reason: the
                    # last buy is the second lot, not the entry.
                    "entry_date": opened.date().isoformat() if opened else None,
                    "pnl_pct": _pnl_pct(lot.get("avg_cost"), t.price),
                    "exit_date": t.timestamp.date().isoformat() if t.timestamp else None,
                    "exit_reason": t.reason,
                    "blog_slug": None,
                }
            )
    return {
        "status": status,
        "count": len(picks),
        "picks": picks,
        # The scoring date every `signal` on this payload was struck from. Null
        # when nothing is scored. Consumers must show it beside the badge.
        "rating_as_of": rating_as_of.isoformat() if rating_as_of else None,
    }


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
                "reason": _public_trade_reason(t.reason),
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
    # And the same picks number /strategy publishes, so a surface leading with
    # the picks return can annualize the figure it actually shows.
    picks_headline = (
        picks_return(db, portfolio).get("return_pct") if portfolio else None
    )
    if not isinstance(picks_headline, (int, float)):
        picks_headline = None

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
                "return_basis": RETURN_BASIS,
                "inception_date": inception.isoformat() if inception else None,
                "snapshots": 0,
                **annualize_return(live_return, days_live, 0),
                "picks_return_pct": picks_headline,
                **annualize_return(picks_headline, days_live, 0, prefix="picks_"),
            },
        }

    # A $0 first snapshot is no base at all. `or 1` turned it into a $1 book and
    # published every later point as a multi-million-percent return (a $100k
    # second day read as +9,999,900%). Withhold the series instead of inventing
    # a base for it.
    base = snaps[0].total_value
    if not base or base <= 0:
        log.warning(
            "First snapshot for portfolio 1 (%s) has no value; withholding the "
            "indexed equity curve rather than publishing a return off a $0 base.",
            snaps[0].date,
        )
        base = None
    spy_base = snaps[0].spy_value
    series = []
    for s in snaps:
        ret = (s.total_value / base - 1) * 100 if base else None
        spy_ret = None
        if s.spy_value and spy_base:
            spy_ret = (s.spy_value / spy_base - 1) * 100
        series.append(
            {
                "date": s.date.isoformat(),
                "return_pct": round(ret, 2) if ret is not None else None,
                "portfolio_pct": round(ret, 4) if ret is not None else None,
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
            # Names the base of BOTH numbers below. `total_return_pct` is the
            # whole-book equity return and `annualized_return_pct` is now that
            # same number annualized — previously the CAGR came off
            # `picks_return`, a different base entirely, so the summary could
            # publish total_return_pct -6.5 beside annualized_return_pct 109.59
            # with nothing in the payload saying they measured different things.
            # The picks return is published on /api/v1/strategy, where it sits
            # beside its own chart.
            "return_basis": RETURN_BASIS,
            "snapshot_return_pct": last,
            "position_count": snaps[-1].position_count if snaps else len(positions),
            "snapshots": len(snaps),
            **annualize_return(headline, days_live, days_recorded),
            # The picks basis, carried alongside so a surface that leads with
            # the picks return can annualize the SAME number it displays.
            # Publishing only the equity pair is what let the landing page show
            # a picks total return beside an equity-derived CAGR — the same
            # class of mismatch the comment above describes, one layer up.
            # Both pairs are self-consistent; a caller must not mix them.
            "picks_return_pct": picks_headline,
            **annualize_return(
                picks_headline, days_live, days_recorded, prefix="picks_"
            ),
        },
    }


@router.get("/chart")
def get_chart(db: Session = Depends(get_db)):
    """Alias for performance (legacy frontend hook)."""
    return get_performance(db)
