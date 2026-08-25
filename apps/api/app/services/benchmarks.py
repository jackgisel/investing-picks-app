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


#: Selectable chart windows: id -> (label, months, days). Exactly one of
#: months/days is non-zero. `None` is since-inception, which needs no arithmetic.
WINDOWS: dict[str, tuple[str, int, int]] = {
    "1w": ("1 week", 0, 7),
    "1m": ("1 month", 1, 0),
    "6m": ("6 months", 6, 0),
    "1y": ("1 year", 12, 0),
}


def shift_back(anchor: date, months: int, days: int) -> date:
    """`anchor` minus a calendar duration.

    Month arithmetic clamps the day rather than rolling over: one month before
    the 31st of March is the 28th of February, not the 3rd of March. Rolling
    over would make the window one day SHORTER than asked for, and on a
    month-end anchor it silently picks the wrong month entirely.
    """
    if days:
        return date.fromordinal(anchor.toordinal() - days)
    total = anchor.year * 12 + (anchor.month - 1) - months
    year, month = divmod(total, 12)
    month += 1
    last_day = _days_in_month(year, month)
    return date(year, month, min(anchor.day, last_day))


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    first = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    return (nxt - first).days


def latest_session(db: Session) -> date | None:
    """The most recent trading day we hold benchmark prices for.

    The anchor for every window. `date.today()` is the wrong one: over a
    weekend it sits two days past the last close, which turns "1 week" into
    five days of data under a seven-day label.
    """
    sessions = _benchmark_sessions(db)
    return sessions[-1] if sessions else None


def window_start(db: Session, window: str | None, portfolio_id: int = 1) -> date | None:
    """The first date a windowed series covers, or None for since-inception.

    Anchored on the latest session we actually hold prices for, not on
    `date.today()`: over a weekend those differ by two days, which would slide
    a "1 week" window into a six-day one.

    Returns None — meaning the full history — when the window reaches back
    further than the book goes. A window that starts before the first pick
    covers exactly the same data as since-inception, and normalising it here is
    what stops the two publishing DIFFERENT numbers off it: the full-history
    series anchors its last point to the live headline, and a "window" that
    merely happened to span everything would skip that and land a few basis
    points away from the figure printed beside it.

    Whether a range is honestly offerable at all — a five-month-old book cannot
    show a year — is a labelling question the API answers separately, via
    `window_options`.
    """
    if not window or window not in WINDOWS:
        return None
    anchor = latest_session(db)
    if anchor is None:
        return None
    _, months, days = WINDOWS[window]
    start = shift_back(anchor, months, days)
    flows = deployment_schedule(db, portfolio_id)
    if not flows or start <= min(f.when for f in flows):
        return None
    return start


def _benchmark_sessions(db: Session) -> list[date]:
    """The trading calendar, as SPY's bars record it."""
    rows = (
        db.query(PriceBar.date)
        .filter(PriceBar.ticker == CALENDAR_BENCHMARK)
        .order_by(PriceBar.date.asc())
        .all()
    )
    return [r[0] for r in rows]


@dataclass(frozen=True)
class Exit:
    """A pick sold out of the book entirely."""

    ticker: str
    when: date
    proceeds: float


def exit_schedule(db: Session, portfolio_id: int = 1) -> dict[str, Exit]:
    """Closed picks: when they were sold and what came back.

    Only tickers with no open position — a name trimmed but still held has not
    exited, and a name sold and re-bought is open again, so neither belongs
    here. Proceeds are the sum of every sell, which is what `picks_return`
    counts as realized.

    Correction actions are excluded: `manual_remove` restates the book rather
    than selling anything, and treating it as proceeds would credit the window
    with money the market never paid.
    """
    from app.db.models import Position

    held = {
        p.ticker
        for p in db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    }
    out: dict[str, Exit] = {}
    for t in db.query(Trade).filter(Trade.portfolio_id == portfolio_id).all():
        if t.side != "sell" or t.ticker in held:
            continue
        if t.action in ("manual_remove", "manual_adjust"):
            continue
        when = t.timestamp.date() if t.timestamp else None
        if when is None or not t.notional:
            continue
        prior = out.get(t.ticker)
        out[t.ticker] = Exit(
            ticker=t.ticker,
            when=max(when, prior.when) if prior else when,
            proceeds=(prior.proceeds if prior else 0.0) + float(t.notional),
        )
    return out


def rebase_flows(
    db: Session,
    flows: list[CashFlow],
    exits: dict[str, Exit],
    start: date | None,
) -> list[CashFlow]:
    """Re-express the deployment schedule as if the window were the whole book.

    A pick already open when the window opened is re-entered AT the window
    start, for what it was worth that day. That is the only construction under
    which every line — picks and each benchmark — starts at 0% on the same date
    and still answers the same question: given these dollars, on these dates,
    which did better *over this window*.

    Naively slicing the cumulative series instead would carry each pick's
    since-inception gain into the window's first point, so a +40% pick would
    open a one-week chart at +40%.

    A pick closed BEFORE the window opened is dropped: it has no return inside
    the window, and its proceeds are cash that the window never put at risk.
    That is not survivorship bias — a pick closed DURING the window stays, and
    freezes at its exit proceeds (see `picks_series`).
    """
    if start is None:
        return flows

    out: list[CashFlow] = []
    for f in flows:
        gone = exits.get(f.ticker)
        if gone and gone.when <= start:
            continue
        if f.when >= start:
            out.append(f)
            continue
        closes = _closes(db, f.ticker)
        if not closes:
            continue
        sessions = sorted(closes)
        entry_price = _price_on_or_before(closes, sessions, f.when)
        opening_price = _price_on_or_before(closes, sessions, start)
        if not entry_price or not opening_price or entry_price <= 0:
            # No price to reprice the lot with. Carrying it at cost would open
            # the window with a position marked at a price from months ago.
            log.warning(
                "No %s price to rebase onto %s; dropping it from the window",
                f.ticker,
                start,
            )
            continue
        out.append(
            CashFlow(
                ticker=f.ticker,
                when=start,
                amount=(f.amount / entry_price) * opening_price,
            )
        )
    return sorted(out, key=lambda f: (f.when, f.ticker))


def _closes(db: Session, ticker: str) -> dict[date, float]:
    rows = db.query(PriceBar).filter(PriceBar.ticker == ticker).all()
    return {r.date: r.close for r in rows if r.close and r.close > 0}


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
    start: date | None = None,
) -> dict:
    """Percent-return series per benchmark, on the picks' own cash flows.

    Returns `{"labels": {...}, "series": {ticker: [{date, return_pct}, ...]}}`.
    A benchmark with no usable price history is omitted rather than emitted
    flat, since a zero-volatility line would read as a real comparison.

    `start` restricts it to a window, with every pick open on that date
    re-entered at what it was worth then — see `rebase_flows`. The benchmarks
    receive the SAME rebased dollars on the SAME dates, which is the whole
    point: the comparison has to be like-for-like inside the window too.
    """
    tickers = tickers or BENCHMARKS
    flows = rebase_flows(
        db, deployment_schedule(db, portfolio_id), exit_schedule(db, portfolio_id), start
    )
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
        first_flow = min(f.when for f in flows)
        # A handful of recent daily marks is enough to pass `len(closes) >= 2`
        # but not enough to price an April entry. QQQ shipped that way: units
        # stayed 0 while the denominator was the full book, so Nasdaq-100
        # printed -100% (then -90.91% the day a new pick finally mapped).
        if _price_on_or_before(closes, sessions, first_flow) is None:
            log.warning(
                "Benchmark %s has no price on or before first pick %s; omitting",
                ticker,
                first_flow,
            )
            continue

        # Convert each cash flow into benchmark units bought at that date's close.
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


def _realized_share(
    flow: CashFlow, flows: list[CashFlow], gone: Exit
) -> float:
    """The part of a closed pick's proceeds that belongs to one cash flow.

    A pick bought in two lots has two flows and one exit. Splitting the
    proceeds by each lot's share of the committed capital keeps the sum equal
    to what actually came back, which crediting every lot with the full
    proceeds would not.
    """
    committed = sum(f.amount for f in flows if f.ticker == flow.ticker)
    if committed <= 0:
        return 0.0
    return gone.proceeds * (flow.amount / committed)


def picks_series(
    db: Session, portfolio_id: int = 1, start: date | None = None
) -> list[dict]:
    """The picks' own return on deployed capital, day by day.

    Same denominator as the benchmarks — capital committed as of that date — so
    the lines are directly comparable rather than measuring different things.

    `start` restricts it to a window on the rebased schedule; see
    `rebase_flows`. A pick sold inside the window freezes at its exit proceeds
    from the sale onward: the money came back as cash and stopped tracking the
    stock, so marking it at the live price would keep crediting the window with
    moves the book was no longer exposed to.
    """
    from app.db.models import Position

    exits = exit_schedule(db, portfolio_id)
    flows = rebase_flows(db, deployment_schedule(db, portfolio_id), exits, start)
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
        if start is not None and session < start:
            continue
        deployed = 0.0
        value = 0.0
        for f in flows:
            if f.when > session:
                continue
            deployed += f.amount
            gone = exits.get(f.ticker)
            if gone and gone.when <= session:
                # Sold. Its contribution is the cash that came back, held flat.
                value += _realized_share(f, flows, gone)
                continue
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
    if rows and positions and start is None:
        from app.db.models import Portfolio
        from app.services.portfolio import picks_return_pct

        portfolio = db.get(Portfolio, portfolio_id)
        headline = picks_return_pct(db, portfolio) if portfolio else None
        if headline is not None:
            rows[-1]["return_pct"] = headline
    return rows
