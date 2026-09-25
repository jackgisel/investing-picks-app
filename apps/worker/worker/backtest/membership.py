"""Eligible-universe membership on each evaluation Friday."""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import (
    ConsensusSnapshot,
    MarketCapHistory,
    PriceBar,
    Stock,
    UniverseMembership,
)
from worker.backtest.store import bulk_insert
from worker.services.market_calendar import last_trading_day_on_or_before

log = logging.getLogger(__name__)

MIN_REVISION_PAIR_DAYS = 5


def _scope_for_friday(db: Session, friday: date) -> str:
    """`full` once a 5-day consensus vintage exists; else Segment A label."""
    first = db.query(func.min(ConsensusSnapshot.as_of)).scalar()
    if first is None:
        return "top400_live"
    return "full" if (friday - first).days >= MIN_REVISION_PAIR_DAYS else "top400_live"


def _mcap_on_or_before(db: Session, ticker: str, as_of: date) -> float | None:
    row = (
        db.query(MarketCapHistory)
        .filter(MarketCapHistory.ticker == ticker, MarketCapHistory.date <= as_of)
        .order_by(MarketCapHistory.date.desc())
        .first()
    )
    return None if row is None else row.market_cap


def write_universe_membership(
    db: Session,
    start: date,
    end: date,
    params: StrategyParams | None = None,
    *,
    dates: list[date] | None = None,
) -> int:
    """Rewrite membership for every evaluation Friday in [start, end].

    Membership on d: has a bar on the session, market cap ≥ $300M on d,
    close ≥ $5, not ETF. Segment A Fridays keep only the top 400 by cap
    (the live scoring width) and are labelled `top400_live`.

    `dates` replaces the 1st/3rd-Friday list. The weekly research replay
    passes every Friday. The live scheduler does not.
    """
    params = params or RUN118_PARAMS
    fridays = list(dates) if dates is not None else evaluation_fridays_between(start, end)
    etf = {
        t
        for (t,) in db.query(Stock.ticker).filter(Stock.is_etf == True).all()  # noqa: E712
    }
    written = 0
    for friday in fridays:
        session = last_trading_day_on_or_before(friday)
        scope = _scope_for_friday(db, friday)
        bars = (
            db.query(PriceBar)
            .filter(PriceBar.date == session, PriceBar.close >= params.min_share_price)
            .all()
        )
        rows: list[dict] = []
        for bar in bars:
            if bar.ticker in etf:
                continue
            cap = _mcap_on_or_before(db, bar.ticker, session)
            if cap is None or cap < params.min_universe_market_cap:
                continue
            rows.append(
                {
                    "as_of": friday,
                    "ticker": bar.ticker,
                    "universe_scope": scope,
                    "market_cap": cap,
                    "close": bar.close,
                }
            )
        rows.sort(key=lambda r: (-(r["market_cap"] or 0), r["ticker"]))
        if scope == "top400_live":
            rows = rows[:400]
        # Replace this Friday so a rerun with new prices is not stuck with
        # the previous membership (ON CONFLICT DO NOTHING would freeze it).
        db.query(UniverseMembership).filter(UniverseMembership.as_of == friday).delete()
        db.commit()
        written += bulk_insert(
            db, UniverseMembership.__table__, rows, ["as_of", "ticker"]
        )
        log.info(
            "Universe %s %s: %s names", friday.isoformat(), scope, len(rows)
        )
    return written
