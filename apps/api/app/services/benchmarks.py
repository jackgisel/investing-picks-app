"""Money-weighted benchmark comparison.

Outpick sells research, so the honest question is not "did the book beat the
index" — the book is mostly cash and a fully invested index beats a 92%-cash
portfolio essentially always, however good the picks are. The question is:

    Given the same dollars committed on the same dates, did the picks beat
    simply buying the index?

So each benchmark is simulated with the pick's own cash flows: SEZL's $1,000 on
2026-04-10 becomes $1,000 of SPY bought at SPY's 2026-04-10 close. Both series
are then a return on identically-timed deployed capital, both start at 0%, and
the comparison is like-for-like.

This also indexes every pick from its own entry date, so a position added last
week is not penalised against an index measured from inception.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.db.models import PriceBar, Trade

log = logging.getLogger(__name__)

#: Ticker -> display label. These are real, quotable ETFs rather than baskets
#: we invented. MAGS is Roundhill's Magnificent Seven ETF (not a market-cap
#: Mag 7 index); QQQ is the liquid Nasdaq-100 comparison.
#:
#: SPY also drives the trading calendar in the snapshot backfill. Every ticker
#: here must be included in daily marks AND the weekly price backfill — leaving
#: MAGS/VTI off those jobs froze their series at the last snapshot-backfill
#: date and made Mag 7 look like it had stopped trading.
CALENDAR_BENCHMARK = "SPY"

BENCHMARKS: dict[str, str] = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq-100",
    "VTI": "Total Market",
    "MAGS": "Mag 7",
}


@dataclass(frozen=True)
class CashFlow:
    """Capital committed to one pick."""

    ticker: str
    when: date
    amount: float


def deployment_schedule(db: Session, portfolio_id: int = 1) -> list[CashFlow]:
    """When capital went into picks, and how much.

    An open position's `entry_date` is authoritative. A trade's `timestamp` is
    when the ROW WAS WRITTEN, which for a hand-entered book is the day the
    admin typed it in, not the day the position was opened — so reading it
    would date every historical pick to today and collapse the comparison to a
    single point.

    Buy trades still supply the schedule for tickers no longer held (closed
    picks), which have no position row to read. `manual_remove` is an admin
    correction rather than an investment, so its ticker is dropped entirely —
    the same treatment `picks_return` gives it.
    """
    from app.db.models import Position

    positions = (
        db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    )
    trades = (
        db.query(Trade)
        .filter(Trade.portfolio_id == portfolio_id)
        .order_by(Trade.timestamp.asc())
        .all()
    )
    corrected = {t.ticker for t in trades if t.action == "manual_remove"}

    flows: list[CashFlow] = []
    open_tickers: set[str] = set()
    for p in positions:
        if p.ticker in corrected or not p.entry_date:
            continue
        amount = p.initial_investment
        if amount is None or amount <= 0:
            # House money: the original stake was recovered, but the capital
            # was still committed on the entry date. Fall back to cost basis.
            amount = (p.avg_cost or 0.0) * (p.shares or 0.0)
        if amount <= 0:
            continue
        open_tickers.add(p.ticker)
        flows.append(
            CashFlow(ticker=p.ticker, when=p.entry_date, amount=float(amount))
        )

    for t in trades:
        if t.side != "buy" or t.ticker in corrected or t.ticker in open_tickers:
            continue
        when = t.timestamp.date() if t.timestamp else None
        if when is None or not t.notional:
            continue
        flows.append(CashFlow(ticker=t.ticker, when=when, amount=float(t.notional)))

    return sorted(flows, key=lambda f: (f.when, f.ticker))


def _closes(db: Session, ticker: str) -> dict[date, float]:
    rows = db.query(PriceBar).filter(PriceBar.ticker == ticker).all()
    return {r.date: r.close for r in rows if r.close}


def _price_on_or_before(closes: dict[date, float], sessions: list[date], when: date) -> float | None:
    """The benchmark close on `when`, or the last session before it.

    A pick entered on a day the benchmark has no bar (a data gap, or an entry
    dated to a holiday before the calendar fix) must still be comparable.
    """
    if when in closes:
        return closes[when]
    prior = [s for s in sessions if s <= when]
    return closes.get(prior[-1]) if prior else None


def benchmark_series(
    db: Session,
    portfolio_id: int = 1,
    tickers: dict[str, str] | None = None,
) -> dict:
    """Percent-return series per benchmark, on the picks' own cash flows.

    Returns `{"labels": {...}, "series": {ticker: [{date, return_pct}, ...]}}`.
    A benchmark with no usable price history is omitted rather than emitted
    flat, since a zero-volatility line would read as a real comparison.
    """
    tickers = tickers or BENCHMARKS
    flows = deployment_schedule(db, portfolio_id)
    if not flows:
        return {"labels": {}, "series": {}, "deployed": 0.0}

    out_series: dict[str, list[dict]] = {}
    labels: dict[str, str] = {}

    for ticker, label in tickers.items():
        closes = _closes(db, ticker)
        if len(closes) < 2:
            log.warning("No usable price history for benchmark %s; omitting", ticker)
            continue
        sessions = sorted(closes)

        # Convert each cash flow into benchmark units bought at that date's close.
        units = 0.0
        committed = 0.0
        lots: list[tuple[date, float]] = []  # (entry, units)
        for f in flows:
            entry_price = _price_on_or_before(closes, sessions, f.when)
            if not entry_price or entry_price <= 0:
                log.warning(
                    "No %s price on or before %s; skipping %s cash flow",
                    ticker,
                    f.when,
                    f.ticker,
                )
                continue
            lots.append((f.when, f.amount / entry_price))
            committed += f.amount

        if not lots or committed <= 0:
            continue

        rows: list[dict] = []
        first_flow = min(f.when for f in flows)
        for session in sessions:
            if session < first_flow:
                continue
            units = sum(u for when, u in lots if when <= session)
            deployed = sum(
                f.amount for f in flows if f.when <= session
            )
            if deployed <= 0:
                continue
            value = units * closes[session]
            rows.append(
                {
                    "date": session.isoformat(),
                    "return_pct": round((value / deployed - 1) * 100, 2),
                }
            )

        if rows:
            out_series[ticker] = rows
            labels[ticker] = label

    return {
        "labels": labels,
        "series": out_series,
        "deployed": round(sum(f.amount for f in flows), 2),
    }


def picks_series(db: Session, portfolio_id: int = 1) -> list[dict]:
    """The picks' own return on deployed capital, day by day.

    Same denominator as the benchmarks — capital committed as of that date — so
    the lines are directly comparable rather than measuring different things.
    """
    from app.db.models import Position

    flows = deployment_schedule(db, portfolio_id)
    if not flows:
        return []

    positions = {
        p.ticker: p
        for p in db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    }

    # Shares per ticker, from the cash flow and the pick's own entry price.
    closes_by_ticker = {f.ticker: _closes(db, f.ticker) for f in flows}
    sessions = sorted(
        {d for closes in closes_by_ticker.values() for d in closes}
    )

    rows: list[dict] = []
    for session in sessions:
        deployed = 0.0
        value = 0.0
        for f in flows:
            if f.when > session:
                continue
            deployed += f.amount
            closes = closes_by_ticker.get(f.ticker) or {}
            entry_price = _price_on_or_before(closes, sorted(closes), f.when)
            mark = _price_on_or_before(closes, sorted(closes), session)
            if not entry_price or not mark or entry_price <= 0:
                # Without a price we cannot mark it; carry it at cost rather
                # than dropping it, which would shrink the denominator and
                # flatter the result.
                value += f.amount
                continue
            value += (f.amount / entry_price) * mark
        if deployed > 0:
            rows.append(
                {
                    "date": session.isoformat(),
                    "return_pct": round((value / deployed - 1) * 100, 2),
                }
            )

    # Anchor the final point to the live book so the chart's last value agrees
    # with the headline instead of drifting from it. That means the headline
    # itself: dividing the market value of OPEN positions by capital deployed
    # into ALL picks dropped every closed pick's proceeds from the numerator
    # while leaving its capital in the denominator, so one open pick at +10%
    # beside one closed at +20% put a -45% final point under a +15% headline.
    if rows and positions:
        from app.db.models import Portfolio
        from app.services.portfolio import picks_return_pct

        portfolio = db.get(Portfolio, portfolio_id)
        headline = picks_return_pct(db, portfolio) if portfolio else None
        if headline is not None:
            rows[-1]["return_pct"] = headline
    return rows
