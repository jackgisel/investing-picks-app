"""Calendar-period returns: today, week to date, month to date.

The cumulative since-inception number answers "was the strategy right"; it
cannot answer "what is happening this week". These are the short-horizon
counterparts, on the same data the equity curve already runs on.

Two deliberate choices run through this module.

**Anchors are the last session BEFORE the period opens, not the first session
inside it.** Week to date measured from Monday's close silently discards
Monday's own move, which on a gap-up Monday is most of the week. So the WTD
anchor is the Friday close, the MTD anchor is the last session of the previous
month, and today's anchor is the previous session's close. This is what a
brokerage means by the same words.

**Sessions come from the data, never from the calendar.** The set of dates
present in `portfolio_snapshots` / `price_bars` IS the trading calendar as this
system knows it: holidays, half days and ingestion gaps are all already
accounted for. Deriving anchors from `timedelta` arithmetic instead would point
at a Saturday, find nothing, and publish a null on a day the market traded.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Iterable, Sequence

from sqlalchemy.orm import Session

from app.db.models import PortfolioSnapshot, Position, PriceBar, Stock

log = logging.getLogger(__name__)

#: Period ids, in the order every surface should present them.
PERIODS = ("day", "week", "month")

PERIOD_LABELS = {"day": "Today", "week": "Week to date", "month": "Month to date"}


@dataclass(frozen=True)
class Anchors:
    """The session each period is measured FROM, plus the session it ends on.

    Any of the three anchors is None when the data does not reach back far
    enough — a book in its first week has no month anchor. None means unknown
    and must stay unknown; it is never 0%.
    """

    latest: date | None
    day: date | None
    week: date | None
    month: date | None

    def anchor_for(self, period: str) -> date | None:
        return getattr(self, period, None)


def _week_start(d: date) -> date:
    """The Monday of `d`'s week."""
    return date.fromordinal(d.toordinal() - d.weekday())


def resolve_anchors(sessions: Sequence[date]) -> Anchors:
    """Pick the anchor session for each period from a sorted session list.

    `sessions` must be ascending and deduplicated. The last entry is the
    reporting date; every anchor is the latest session strictly before the
    boundary that opens the period.
    """
    if not sessions:
        return Anchors(None, None, None, None)

    latest = sessions[-1]
    prior = sessions[:-1]

    def last_before(boundary: date) -> date | None:
        for d in reversed(prior):
            if d < boundary:
                return d
        return None

    return Anchors(
        latest=latest,
        # The previous session — "since yesterday's close", where yesterday
        # means the last day the market was open, not the last calendar day.
        day=prior[-1] if prior else None,
        week=last_before(_week_start(latest)),
        month=last_before(latest.replace(day=1)),
    )


def _pct(start: float | None, end: float | None) -> float | None:
    """Percent change, or None when it cannot be computed honestly.

    A non-positive base is not a 0% period, it is an unusable one: dividing by
    it is what turned a $0 first snapshot into a nine-figure return elsewhere in
    this codebase.
    """
    if start is None or end is None:
        return None
    if start <= 0:
        return None
    return round((end / start - 1) * 100, 2)


def _closes_by_ticker(
    db: Session, tickers: Iterable[str], since: date | None
) -> dict[str, dict[date, float]]:
    tickers = list(tickers)
    if not tickers:
        return {}
    q = db.query(PriceBar.ticker, PriceBar.date, PriceBar.close).filter(
        PriceBar.ticker.in_(tickers)
    )
    if since is not None:
        q = q.filter(PriceBar.date >= since)
    out: dict[str, dict[date, float]] = {}
    for ticker, bar_date, close in q.all():
        out.setdefault(ticker, {})[bar_date] = close
    return out


def _mark_on_or_before(closes: dict[date, float], when: date | None) -> float | None:
    """The close on `when`, else the most recent close before it.

    A ticker can miss a session — a failed quote, a halt — while the book's own
    snapshot for that day exists. Falling back to the prior close carries the
    position at its last known mark instead of dropping it out of an aggregate,
    which would quietly change the aggregate's composition.
    """
    if when is None or not closes:
        return None
    if when in closes:
        return closes[when]
    earlier = [d for d in closes if d < when]
    return closes[max(earlier)] if earlier else None


def book_period_returns(
    db: Session, portfolio_id: int = 1
) -> tuple[Anchors, dict[str, dict]]:
    """Whole-book equity return and SPY, per period.

    `total_value` is cash + holdings on a book that takes no deposits or
    withdrawals, so a plain end/start ratio IS the period return — no
    flow adjustment is needed or wanted here. (The DCA books DO take weekly
    contributions; they are not portfolio 1 and must not be measured this way.)
    """
    snaps = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == portfolio_id)
        .order_by(PortfolioSnapshot.date.asc())
        .all()
    )
    by_date = {s.date: s for s in snaps}
    anchors = resolve_anchors([s.date for s in snaps])
    latest = by_date.get(anchors.latest) if anchors.latest else None

    out: dict[str, dict] = {}
    for period in PERIODS:
        anchor_date = anchors.anchor_for(period)
        anchor = by_date.get(anchor_date) if anchor_date else None
        out[period] = {
            "from_date": anchor_date.isoformat() if anchor_date else None,
            "book_return_pct": _pct(
                anchor.total_value if anchor else None,
                latest.total_value if latest else None,
            ),
            "spy_return_pct": _pct(
                anchor.spy_value if anchor else None,
                latest.spy_value if latest else None,
            ),
        }
    return anchors, out


def _stocks_by_ticker(db: Session, tickers: Iterable[str]) -> dict[str, Stock]:
    tickers = list(tickers)
    if not tickers:
        return {}
    rows = db.query(Stock).filter(Stock.ticker.in_(tickers)).all()
    return {s.ticker: s for s in rows}


def _live_mark(
    stock: Stock | None, closes: dict[date, float], latest: date | None
) -> float | None:
    """The current mark: `Stock.last_price`, else the newest bar we hold.

    `refresh_marks` writes the two together, but a hand-entered position can be
    marked before its first bar lands.
    """
    if stock is not None and stock.last_price:
        return stock.last_price
    return _mark_on_or_before(closes, latest)


def position_period_returns(
    db: Session, anchors: Anchors, portfolio_id: int = 1
) -> list[dict]:
    """Per-open-position price return over each period.

    Price return only: this is what the SHARES did, so it is unaffected by
    trimming a winner or by the Winners Circle flag, and it agrees with what the
    reader sees on any quote screen.

    A position entered mid-period has no price of ours to measure from at the
    anchor, so it is measured from its entry-date close and marked `partial`.
    That is a different statement from a full-period return — "up 4% since we
    bought it on the 12th" is not "up 4% this month" — and the flag exists so a
    surface can say which one it is showing rather than blending them.
    """
    positions = (
        db.query(Position)
        .filter(Position.portfolio_id == portfolio_id)
        .order_by(Position.ticker.asc())
        .all()
    )
    if not positions or anchors.latest is None:
        return []

    earliest = min([a for a in (anchors.month, anchors.week, anchors.day) if a] or [anchors.latest])
    # Entry-date closes for mid-period entries can predate every anchor.
    entry_dates = [p.entry_date for p in positions if p.entry_date]
    if entry_dates:
        earliest = min(earliest, min(entry_dates))
    closes = _closes_by_ticker(db, [p.ticker for p in positions], earliest)
    stocks = _stocks_by_ticker(db, [p.ticker for p in positions])

    rows: list[dict] = []
    for pos in positions:
        ticker_closes = closes.get(pos.ticker, {})
        stock = stocks.get(pos.ticker)
        end = _live_mark(stock, ticker_closes, anchors.latest)

        periods: dict[str, dict] = {}
        for period in PERIODS:
            anchor_date = anchors.anchor_for(period)
            from_date = anchor_date
            partial = False
            if (
                anchor_date is not None
                and pos.entry_date is not None
                and pos.entry_date > anchor_date
            ):
                from_date = pos.entry_date
                partial = True
            start = _mark_on_or_before(ticker_closes, from_date)
            # An entry-date close we never ingested would otherwise be answered
            # by the fallback with a PRE-entry price, quietly crediting the
            # position with a move it was not in. `_mark_on_or_before` cannot
            # tell the two cases apart, so refuse the partial case explicitly.
            if partial and from_date not in ticker_closes:
                start = pos.avg_cost or None
            periods[period] = {
                "return_pct": _pct(start, end),
                "from_date": from_date.isoformat() if from_date else None,
                "partial": partial,
            }

        rows.append(
            {
                "ticker": pos.ticker,
                "entry_date": pos.entry_date.isoformat() if pos.entry_date else None,
                # `Position.sector` is only set for positions the evaluator
                # opened; hand-entered ones carry none, and `stocks` is where
                # every sector actually lives. Reading the position alone is
                # what rendered most of the book "Unclassified" on a table
                # whose neighbouring column had the sector right there.
                "sector": pos.sector or (stock.sector if stock else None),
                "periods": periods,
            }
        )
    return rows


def open_picks_period_returns(
    db: Session, anchors: Anchors, rows: Sequence[dict], portfolio_id: int = 1
) -> dict[str, dict]:
    """What the stocks we hold today did over each period, as one number.

    Value-weighted with TODAY's share counts held constant on both sides, which
    is what makes it a return rather than a mixture of a return and the trading
    we did inside the window.

    Positions entered mid-period are excluded, not folded in at their entry
    price: a name bought on Tuesday has no Friday-close value, and inventing one
    would put the money in the denominator for days it was not at risk. The
    count of what was left out is published so the number can be read for what
    it is — the return of the continuously-held sleeve.
    """
    positions = {
        p.ticker: p
        for p in db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    }
    if not positions:
        return {p: {"return_pct": None, "positions": 0, "excluded_new": 0} for p in PERIODS}

    closes = _closes_by_ticker(
        db,
        list(positions),
        min([a for a in (anchors.month, anchors.week, anchors.day) if a] or [anchors.latest])
        if anchors.latest
        else None,
    )
    stocks = _stocks_by_ticker(db, list(positions))

    out: dict[str, dict] = {}
    for period in PERIODS:
        anchor_date = anchors.anchor_for(period)
        start_value = 0.0
        end_value = 0.0
        counted = 0
        excluded = 0
        for row in rows:
            pos = positions.get(row["ticker"])
            if pos is None:
                continue
            if row["periods"][period]["partial"]:
                excluded += 1
                continue
            ticker_closes = closes.get(pos.ticker, {})
            start = _mark_on_or_before(ticker_closes, anchor_date)
            end = _live_mark(stocks.get(pos.ticker), ticker_closes, anchors.latest)
            if start is None or end is None or start <= 0:
                excluded += 1
                continue
            start_value += pos.shares * start
            end_value += pos.shares * end
            counted += 1
        out[period] = {
            "return_pct": _pct(start_value, end_value) if counted else None,
            "positions": counted,
            "excluded_new": excluded,
        }
    return out


def period_returns_payload(db: Session, portfolio_id: int = 1) -> dict:
    """The whole surface: anchors, book, held sleeve, and every position."""
    anchors, book = book_period_returns(db, portfolio_id)
    rows = position_period_returns(db, anchors, portfolio_id)
    sleeve = open_picks_period_returns(db, anchors, rows, portfolio_id)

    return {
        "as_of": anchors.latest.isoformat() if anchors.latest else None,
        "periods": [
            {
                "id": period,
                "label": PERIOD_LABELS[period],
                "from_date": book[period]["from_date"],
                "book_return_pct": book[period]["book_return_pct"],
                "spy_return_pct": book[period]["spy_return_pct"],
                "open_picks_return_pct": sleeve[period]["return_pct"],
                "open_picks_positions": sleeve[period]["positions"],
                "open_picks_excluded_new": sleeve[period]["excluded_new"],
            }
            for period in PERIODS
        ],
        "positions": rows,
    }
