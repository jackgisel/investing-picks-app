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
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timezone

from sqlalchemy.orm import Session

from app.db.models import PriceBar, Trade
from app.services.portfolio import SHARE_EPSILON, split_factor, split_ratios, trade_shares

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
class LedgerEvent:
    """One trade, as the performance engine replays it.

    `kind` is "buy" (capital committed), "sell" (proceeds returned) or
    "withdraw" (a correction taking capital back out without a market outcome).
    `shares` is what the trade actually filled, so a lot is valued from its own
    fill price rather than from that day's close.
    """

    ticker: str
    when: date
    kind: str
    amount: float
    shares: float


@dataclass(frozen=True)
class CashFlow:
    """Capital committed to one pick."""

    ticker: str
    when: date
    amount: float


def _trade_date(t: Trade) -> date | None:
    """The trading day a trade belongs to, read in UTC.

    `timestamp.date()` alone uses whatever timezone the DB session hands back,
    so the same row could land on different days locally and in production.
    """
    if t.timestamp is None:
        return None
    ts = t.timestamp
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc)
    return ts.date()


def trade_ledger(db: Session, portfolio_id: int = 1) -> list[LedgerEvent]:
    """Every trade that moved capital into or out of a pick, in order.

    Each buy is its own lot. A conviction add (`double_buy`) is fresh capital on
    its own date at its own price; folding it into the original entry charted
    SEZL's September $1,000 at $60 in April.

    An open position's `entry_date` is authoritative for the FIRST buy of its
    current holding period. A trade's `timestamp` is when the ROW WAS WRITTEN,
    which for a hand-entered book is the day the admin typed it in, not the day
    the position was opened. Later lots are never dated before that entry.

    `manual_remove` restates the book rather than investing, so its ticker is
    dropped entirely, the same treatment `picks_return` gives it.
    `manual_adjust` moves capital without a market outcome: a buy-side
    adjustment commits capital, a sell-side one withdraws it.

    Share counts are in TODAY's share terms. Trade rows keep the shares and
    price they were filled at, so a trade dated before an applied split
    (`split_adjustments`) is scaled by that split's ratio here. Without it a
    4-for-1 makes every older lot read -75% against the post-split mark, and a
    post-split sale subtracts new-basis shares from old-basis holdings.
    """
    from app.db.models import Position

    splits = split_ratios(db, portfolio_id)

    positions = {
        p.ticker: p
        for p in db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    }
    trades = (
        db.query(Trade)
        .filter(Trade.portfolio_id == portfolio_id)
        .order_by(Trade.timestamp.asc(), Trade.id.asc())
        .all()
    )
    corrected = {t.ticker for t in trades if t.action == "manual_remove"}

    by_ticker: dict[str, list[Trade]] = {}
    for t in trades:
        if t.ticker in corrected or not t.notional or t.notional <= 0:
            continue
        if _trade_date(t) is None:
            continue
        by_ticker.setdefault(t.ticker, []).append(t)

    events: list[LedgerEvent] = []
    for ticker, rows in by_ticker.items():
        # Where the current holding period opens: the first buy after the last
        # time the name went flat. Only that buy takes the position's date.
        held = 0.0
        period_open = 0
        for i, t in enumerate(rows):
            if held <= SHARE_EPSILON and t.side == "buy":
                period_open = i
            qty = trade_shares(t, splits)
            held += qty if t.side == "buy" else -qty
        p = positions.get(ticker)
        entry = p.entry_date if p is not None and held > SHARE_EPSILON else None

        for i, t in enumerate(rows):
            when = _trade_date(t)
            if entry is not None and i >= period_open:
                when = entry if i == period_open else max(when, entry)
            shares = trade_shares(t, splits) or (
                t.notional / t.price * split_factor(t, splits) if t.price else 0.0
            )
            if t.side == "buy":
                kind = "buy"
            elif t.action == "manual_adjust":
                kind = "withdraw"
            else:
                kind = "sell"
            events.append(
                LedgerEvent(
                    ticker=ticker,
                    when=when,
                    kind=kind,
                    amount=float(t.notional),
                    shares=float(shares),
                )
            )

    # Open positions with no trade rows at all (a hand-entered book that never
    # wrote one) still committed capital on their entry date.
    for ticker, p in positions.items():
        if ticker in corrected or ticker in by_ticker or not p.entry_date:
            continue
        amount = p.initial_investment
        if amount is None or amount <= 0:
            # House money: the original stake was recovered, but the capital
            # was still committed on the entry date. Fall back to cost basis.
            amount = (p.avg_cost or 0.0) * (p.shares or 0.0)
        if amount <= 0 or not p.shares:
            continue
        events.append(
            LedgerEvent(
                ticker=ticker,
                when=p.entry_date,
                kind="buy",
                amount=float(amount),
                shares=float(p.shares),
            )
        )

    order = {"buy": 0, "withdraw": 1, "sell": 2}
    return sorted(events, key=lambda e: (e.when, order[e.kind], e.ticker))


def deployment_schedule(db: Session, portfolio_id: int = 1) -> list[CashFlow]:
    """When capital went into picks, and how much: one flow per buy."""
    return [
        CashFlow(ticker=e.ticker, when=e.when, amount=e.amount)
        for e in trade_ledger(db, portfolio_id)
        if e.kind == "buy"
    ]


#: Selectable chart windows: id -> (label, months, days). Exactly one of
#: months/days is non-zero, except year-to-date, whose start is a calendar date
#: rather than a duration (see `window_open`). `None` is since-inception, which
#: needs no arithmetic.
WINDOWS: dict[str, tuple[str, int, int]] = {
    "1w": ("1 week", 0, 7),
    "1m": ("1 month", 1, 0),
    "3m": ("3 months", 3, 0),
    "6m": ("6 months", 6, 0),
    "ytd": ("Year to date", 0, 0),
    "1y": ("1 year", 12, 0),
}


def window_open(anchor: date, window: str) -> date:
    """The first date `window` covers when the latest session is `anchor`.

    Year-to-date opens on January 1st. `window_events` prices a holding "on or
    before" the start, so every line is re-entered at the prior year's final
    close — the same base a published YTD figure uses.
    """
    if window == "ytd":
        return date(anchor.year, 1, 1)
    _, months, days = WINDOWS[window]
    return shift_back(anchor, months, days)


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
    start = window_open(anchor, window)
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




def _closes(db: Session, ticker: str) -> dict[date, float]:
    rows = db.query(PriceBar).filter(PriceBar.ticker == ticker).all()
    return {r.date: r.close for r in rows if r.close and r.close > 0}


def _price_on_or_before(closes: dict[date, float], sessions: list[date], when: date) -> float | None:
    """The close on `when`, or the last session before it.

    A pick entered on a day the benchmark has no bar (a data gap, or an entry
    dated to a holiday before the calendar fix) must still be comparable.
    """
    if when in closes:
        return closes[when]
    i = bisect_right(sessions, when)
    return closes[sessions[i - 1]] if i else None


class _Prices:
    """Closes per ticker, loaded once, with an on-or-before lookup."""

    def __init__(self, db: Session):
        self._db = db
        self._closes: dict[str, dict[date, float]] = {}
        self._sessions: dict[str, list[date]] = {}

    def closes(self, ticker: str) -> dict[date, float]:
        if ticker not in self._closes:
            self._closes[ticker] = _closes(self._db, ticker)
            self._sessions[ticker] = sorted(self._closes[ticker])
        return self._closes[ticker]

    def on_or_before(self, ticker: str, when: date) -> float | None:
        closes = self.closes(ticker)
        return _price_on_or_before(closes, self._sessions[ticker], when)


def window_events(
    db: Session,
    events: list[LedgerEvent],
    start: date | None,
    prices: _Prices | None = None,
) -> list[LedgerEvent]:
    """Re-express the ledger as if the window were the whole book.

    A pick held when the window opens is re-entered AT the window start, for
    what it was worth that day. That is the only construction under which every
    line, picks and each benchmark, starts at 0% on the same date and still
    answers the same question: given these dollars, on these dates, which did
    better *over this window*.

    Slicing the cumulative series instead would carry each pick's
    since-inception gain into the window's first point, so a +40% pick would
    open a one-week chart at +40%.

    Trades before the window are folded into what is held at its open. A pick
    closed before the window is gone: its proceeds are cash the window never put
    at risk. One closed INSIDE the window stays, which is what keeps the window
    free of survivorship bias.
    """
    if start is None:
        return events
    prices = prices or _Prices(db)

    held: dict[str, float] = {}
    for e in events:
        if e.when >= start:
            break
        if e.kind == "buy":
            held[e.ticker] = held.get(e.ticker, 0.0) + e.shares
        else:
            held[e.ticker] = held.get(e.ticker, 0.0) - e.shares

    opening: list[LedgerEvent] = []
    skipped: set[str] = set()
    for ticker, shares in sorted(held.items()):
        if shares <= SHARE_EPSILON:
            continue
        mark = prices.on_or_before(ticker, start)
        if not mark:
            # No price to reprice the holding with. Carrying it at cost would
            # open the window with a position marked months ago.
            log.warning("No %s price to rebase onto %s; dropping it", ticker, start)
            skipped.add(ticker)
            continue
        opening.append(
            LedgerEvent(ticker=ticker, when=start, kind="buy", amount=shares * mark, shares=shares)
        )
    inside = [e for e in events if e.when >= start and e.ticker not in skipped]
    # A sell inside the window for a name not held at its open and not bought
    # inside it has nothing to sell; that only happens on a broken ledger.
    return opening + inside


@dataclass
class _Book:
    """Running state of one replay: picks, or one benchmark's shadow of them."""

    deployed: float = 0.0
    cash: float = 0.0
    units: dict[str, float] = field(default_factory=dict)
    cost: dict[str, float] = field(default_factory=dict)


def _replay(
    events: list[LedgerEvent],
    sessions: list[date],
    prices: _Prices,
    benchmark: str | None,
) -> list[dict]:
    """Return on deployed capital, session by session.

        (proceeds already returned + value of what is still held) / deployed - 1

    For the picks, `units` are the shares each trade actually filled. For a
    benchmark, each buy's dollars buy the benchmark at that day's close instead,
    and a sell of a fraction of a pick's shares sells the same fraction of its
    shadow units. Both sides then hold the market for exactly the same time with
    exactly the same money, and a sale freezes both at what came back.
    """
    book = _Book()
    picks_held: dict[str, float] = {}
    rows: list[dict] = []
    i = 0
    for session in sessions:
        while i < len(events) and events[i].when <= session:
            e = events[i]
            i += 1
            held_before = picks_held.get(e.ticker, 0.0)
            if e.kind == "buy":
                picks_held[e.ticker] = held_before + e.shares
                book.deployed += e.amount
                book.cost[e.ticker] = book.cost.get(e.ticker, 0.0) + e.amount
                if benchmark is None:
                    units = e.shares
                else:
                    px = prices.on_or_before(benchmark, e.when)
                    units = e.amount / px if px else 0.0
                book.units[e.ticker] = book.units.get(e.ticker, 0.0) + units
                continue

            fraction = min(1.0, e.shares / held_before) if held_before > SHARE_EPSILON else 1.0
            picks_held[e.ticker] = max(0.0, held_before - e.shares)
            sold = book.units.get(e.ticker, 0.0) * fraction
            book.units[e.ticker] = book.units.get(e.ticker, 0.0) - sold
            cost_out = book.cost.get(e.ticker, 0.0) * fraction
            book.cost[e.ticker] = book.cost.get(e.ticker, 0.0) - cost_out
            if e.kind == "withdraw":
                # A correction: the capital leaves, nothing was earned on it.
                book.deployed -= e.amount
                continue
            if benchmark is None:
                book.cash += e.amount
            else:
                px = prices.on_or_before(benchmark, e.when)
                book.cash += sold * px if px else 0.0

        if book.deployed <= 0:
            continue
        value = book.cash
        for ticker, units in book.units.items():
            if units <= SHARE_EPSILON:
                continue
            mark = prices.on_or_before(benchmark or ticker, session)
            if mark is None:
                # Without a price we cannot mark it; carry it at cost rather
                # than dropping it, which would shrink the numerator.
                value += book.cost.get(ticker, 0.0)
                continue
            value += units * mark
        rows.append(
            {
                "date": session.isoformat(),
                "return_pct": round((value / book.deployed - 1) * 100, 2),
            }
        )
    return rows


def _picks_sessions(
    db: Session, events: list[LedgerEvent], prices: _Prices, first: date
) -> list[date]:
    """SPY's trading calendar, or the picks' own bars where SPY has none."""
    sessions = _benchmark_sessions(db)
    if not sessions:
        sessions = sorted(
            {d for t in {e.ticker for e in events} for d in prices.closes(t)}
        )
    return [s for s in sessions if s >= first]


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
    re-entered at what it was worth then; see `window_events`. The benchmarks
    receive the SAME dollars on the SAME dates, inside the window too.
    """
    tickers = tickers or BENCHMARKS
    prices = _Prices(db)
    events = window_events(db, trade_ledger(db, portfolio_id), start, prices)
    buys = [e for e in events if e.kind == "buy"]
    if not buys:
        return {"labels": {}, "series": {}, "deployed": 0.0}

    first = min(e.when for e in buys)
    out_series: dict[str, list[dict]] = {}
    labels: dict[str, str] = {}
    for ticker, label in tickers.items():
        closes = prices.closes(ticker)
        if len(closes) < 2:
            log.warning("No usable price history for benchmark %s; omitting", ticker)
            continue
        # A handful of recent daily marks is enough to pass the check above but
        # not enough to price an April entry. QQQ shipped that way and printed
        # -100%, so a benchmark that cannot price the first flow is omitted.
        if prices.on_or_before(ticker, first) is None:
            log.warning(
                "Benchmark %s has no price on or before first pick %s; omitting",
                ticker,
                first,
            )
            continue
        sessions = [s for s in sorted(closes) if s >= (start or first)]
        rows = _replay(events, sessions, prices, ticker)
        if rows:
            out_series[ticker] = rows
            labels[ticker] = label

    return {
        "labels": labels,
        "series": out_series,
        "deployed": round(sum(e.amount for e in buys), 2),
    }


def picks_series(
    db: Session, portfolio_id: int = 1, start: date | None = None
) -> list[dict]:
    """The picks' own return on deployed capital, day by day.

    Same denominator as the benchmarks, capital committed as of that date, so
    the lines are directly comparable rather than measuring different things.
    Each lot is valued from the shares it actually filled, which is the same
    basis the headline (`picks_return`) uses, so the last point lands on it.

    `start` restricts it to a window; see `window_events`. A pick sold inside
    the window freezes at its proceeds from the sale onward: the money came back
    as cash and stopped tracking the stock.
    """
    prices = _Prices(db)
    events = window_events(db, trade_ledger(db, portfolio_id), start, prices)
    buys = [e for e in events if e.kind == "buy"]
    if not buys:
        return []
    first = start or min(e.when for e in buys)
    rows = _replay(events, _picks_sessions(db, events, prices, first), prices, None)

    # Anchor the final point to the live headline. With the ledger and the
    # positions in agreement this is a no-op; a gap means they disagree, which
    # is worth hearing about rather than silently splicing over.
    if rows and start is None:
        from app.db.models import Portfolio
        from app.services.portfolio import picks_return_pct

        portfolio = db.get(Portfolio, portfolio_id)
        headline = picks_return_pct(db, portfolio) if portfolio else None
        if headline is not None:
            gap = abs(rows[-1]["return_pct"] - headline)
            if gap > 0.05:
                log.warning(
                    "Picks series ends at %.2f but the headline is %.2f; the trade "
                    "ledger and positions disagree",
                    rows[-1]["return_pct"],
                    headline,
                )
            rows[-1]["return_pct"] = headline
    return rows


def picks_growth_index(db: Session, portfolio_id: int = 1) -> list[dict]:
    """Growth of $1 in the picks, time-weighted, session by session.

    The money-weighted series answers "what did the capital earn"; it is the
    wrong curve for a drawdown, because each new buy changes its base. A book
    up 50% on $5,000 that adds $10,000 flat reads +17% the next day without a
    single price moving. This index chains each session's return on what was
    held, so buys and sells are flows, not performance, and its peak-to-trough
    is the picks' real drawdown.

    A buy joins at that day's close, so what was already held earns the day's
    move and the new lot starts from there; its fill-to-close move on the buy
    day is left out. A sale counts at its own price.
    """
    prices = _Prices(db)
    events = trade_ledger(db, portfolio_id)
    buys = [e for e in events if e.kind == "buy"]
    if not buys:
        return []
    sessions = _picks_sessions(db, events, prices, min(e.when for e in buys))

    held: dict[str, float] = {}
    base = 0.0  # value of what was held at the previous close
    index = 1.0
    rows: list[dict] = []
    i = 0

    def mark(ticker: str, session: date) -> float:
        px = prices.on_or_before(ticker, session)
        return px if px is not None else 0.0

    def value(book: dict[str, float], session: date) -> float:
        return sum(n * mark(t, session) for t, n in book.items() if n > SHARE_EPSILON)

    for session in sessions:
        new: dict[str, float] = {}
        sold = 0.0
        while i < len(events) and events[i].when <= session:
            e = events[i]
            i += 1
            if e.kind == "buy":
                new[e.ticker] = new.get(e.ticker, 0.0) + e.shares
            else:
                held[e.ticker] = max(0.0, held.get(e.ticker, 0.0) - e.shares)
                sold += e.amount
        if base > 0:
            index *= (value(held, session) + sold) / base
        for ticker, n in new.items():
            held[ticker] = held.get(ticker, 0.0) + n
        base = value(held, session)
        rows.append({"date": session.isoformat(), "index": round(index, 6)})
    return rows


def picks_drawdown(db: Session, portfolio_id: int = 1) -> dict:
    """How far the time-weighted picks index sits below its high."""
    rows = picks_growth_index(db, portfolio_id)
    if len(rows) < 2:
        return {"drawdown_pct": None, "peak_date": None}
    peak = max(rows, key=lambda r: r["index"])
    latest = rows[-1]["index"]
    return {
        "drawdown_pct": round(max(0.0, (1 - latest / peak["index"]) * 100), 2),
        "peak_date": peak["date"],
    }


def open_lots(db: Session, portfolio_id: int = 1) -> dict[str, list[dict]]:
    """Each open position's buys in its current holding period, as lots.

    A conviction add is reported as its own position: its own entry date, and
    its own return from its own fill. One blended row on average cost hid both
    halves of SEZL, a first lot that had nearly doubled and an add that was
    down. A trim scales every lot by the same fraction, so the lots always sum
    to what is held.

    `share` is the lot's fraction of the position's shares, which is also its
    fraction of the position's market value, since every lot marks at the same
    price. No prices or dollar amounts: these go into public payloads.
    """
    by_ticker: dict[str, list[LedgerEvent]] = {}
    for e in trade_ledger(db, portfolio_id):
        by_ticker.setdefault(e.ticker, []).append(e)

    out: dict[str, list[dict]] = {}
    for ticker, events in by_ticker.items():
        lots: list[list] = []  # [when, shares, cost per share]
        for e in events:
            held = sum(lot[1] for lot in lots)
            if e.kind == "buy":
                if held <= SHARE_EPSILON:
                    lots = []
                if e.shares > 0:
                    lots.append([e.when, e.shares, e.amount / e.shares])
                continue
            keep = max(0.0, 1 - e.shares / held) if held > SHARE_EPSILON else 0.0
            for lot in lots:
                lot[1] *= keep
        total = sum(lot[1] for lot in lots)
        if total <= SHARE_EPSILON:
            continue
        out[ticker] = [
            {
                "lot": i + 1,
                "kind": "entry" if i == 0 else "add",
                "entry_date": when.isoformat(),
                "share": round(shares / total, 6),
                "cost_per_share": cost,
            }
            for i, (when, shares, cost) in enumerate(lots)
        ]
    return out


def public_lots(lots: list[dict] | None, mark: float | None) -> list[dict]:
    """`open_lots` rows with a return on each lot and the cost basis removed."""
    rows = []
    for lot in lots or []:
        cost = lot["cost_per_share"]
        rows.append(
            {
                "lot": lot["lot"],
                "kind": lot["kind"],
                "entry_date": lot["entry_date"],
                "share": lot["share"],
                "pnl_pct": round((mark / cost - 1) * 100, 2) if mark and cost else None,
            }
        )
    return rows
