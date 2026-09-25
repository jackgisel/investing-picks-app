"""Replay the Run 118 engine over the scores and prices this database has seen.

This is the harness every strategy change is measured against before it
reaches the live book. It walks the evaluation Fridays in a date range, loads
the composite scores that existed on each one (`load_scores_as_of`), runs the
pure `evaluate()` exactly as `run_evaluation` does, and fills the resulting
signals in memory against `price_bars`. Nothing here writes to the database.

Delisted holdings are force-exited at the last close on or before
`delistings.date` (booked on the next evaluation, or at `end` if none remains).
Without that, `_mark` would keep a bar-less name at its last price forever.

What it is
----------
A replay of *our own* scoring history. `composite_scores` is written every
trading day and `price_bars` daily for held and top-rated names, so from the
first scoring date onward the engine can be re-run with different parameters,
a different fill assumption, or different code, and the trades compared with
what the live book actually did (`ReplayResult.diff_against_ledger`).

What it is not
--------------
A historical backtest. Scores only exist from the day the worker first ran,
and the fundamentals behind them are stamped with their ingest date and carry
FMP's current restated values (see BUG-P4 in docs/BUG_REPORT.md). Nothing in
this module can manufacture a 2019 score. It is sufficient for testing every
portfolio-mechanics change (exits, sizing, double-buy rules, stops, fill
timing) on real data, and insufficient for re-deriving the factor model.

Fill model
----------
The live executor fills at the mark `refresh_marks` wrote minutes before the
11:00 ET evaluation, with no slippage (`apply_signals`). `FillModel` defaults
to the closest thing this table can offer, the close on the evaluation date,
so the parity check against the ledger is fair. `next_close` fills at the
following session's close, which is what a subscriber mirroring the book by
hand can actually get.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import func
from sqlalchemy.orm import Session

from outpick_strategy import (
    Action,
    PortfolioState,
    RUN118_PARAMS,
    ScoreSnapshot,
    Signal,
    StrategyParams,
    evaluate,
)
from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import CompositeScore, Delisting, Portfolio, PriceBar, Trade
from app.services.portfolio import (
    CORRECTION_ACTIONS,
    SHARE_EPSILON,
    _position_to_state,
    load_scores_as_of,
    ranked_candidates,
    return_series_for,
)

# Same execution order as `apply_signals`: free cash before spending it.
_EXECUTION_ORDER = [
    Action.FULL_SELL,
    Action.PARTIAL_SELL,
    Action.TRIM,
    Action.RECYCLE_TRIM,
    Action.BUY,
    Action.DOUBLE_BUY,
]
_SELL_ACTIONS = {Action.FULL_SELL, Action.PARTIAL_SELL, Action.TRIM, Action.RECYCLE_TRIM}
_BUY_ACTIONS = {Action.BUY, Action.DOUBLE_BUY}

# Ledger rows the engine did not write. `manual_buy` is the ops seeding route;
# the corrections are admin edits. None of them can be reproduced by replay and
# the diff reports them separately rather than as mismatches.
MANUAL_ACTIONS = ("manual_buy", *CORRECTION_ACTIONS)


# ---------------------------------------------------------------------------
# In-memory book
# ---------------------------------------------------------------------------


@dataclass
class ReplayPosition:
    """Mirror of `app.db.models.Position` without the ORM.

    Field names match `Position` exactly so `_position_to_state` — the one
    place the house-money sentinel is translated for the engine — works on
    both without a second copy of that rule.
    """

    ticker: str
    shares: float
    avg_cost: float
    current_price: float = 0.0
    entry_date: date | None = None
    initial_investment: float | None = None
    is_house_money: bool = False
    sector: str | None = None

    @property
    def market_value(self) -> float:
        return self.shares * (self.current_price or 0.0)


@dataclass
class ReplayBook:
    cash: float
    positions: dict[str, ReplayPosition] = field(default_factory=dict)
    peak_equity: float | None = None
    is_drawdown_halted: bool = False

    @property
    def invested(self) -> float:
        return sum(p.market_value for p in self.positions.values())

    @property
    def equity(self) -> float:
        return self.cash + self.invested

    def to_state(self, as_of: date) -> PortfolioState:
        return PortfolioState(
            cash=self.cash,
            positions={t: _position_to_state(p) for t, p in self.positions.items()},
            peak_equity=self.peak_equity,
            is_drawdown_halted=self.is_drawdown_halted,
            as_of=as_of,
        )

    def snapshot(self) -> dict:
        return {
            "cash": round(self.cash, 2),
            "invested": round(self.invested, 2),
            "equity": round(self.equity, 2),
            "position_count": len(self.positions),
            "positions": {
                t: {
                    "shares": round(p.shares, 6),
                    "avg_cost": round(p.avg_cost, 4),
                    "current_price": round(p.current_price, 4),
                    "is_house_money": p.is_house_money,
                }
                for t, p in sorted(self.positions.items())
            },
        }


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FillModel:
    price: Literal["same_close", "next_close"] = "same_close"
    slippage_bps: float = 0.0

    def buy_price(self, close: float) -> float:
        return close * (1 + self.slippage_bps / 10_000)

    def sell_price(self, close: float) -> float:
        return close * (1 - self.slippage_bps / 10_000)


@dataclass
class ReplayTrade:
    eval_date: date
    fill_date: date
    ticker: str
    side: str
    action: str
    shares: float
    price: float
    notional: float
    reason: str

    def to_dict(self) -> dict:
        d = asdict(self)
        d["eval_date"] = self.eval_date.isoformat()
        d["fill_date"] = self.fill_date.isoformat()
        for k in ("shares", "price", "notional"):
            d[k] = round(d[k], 6)
        return d


@dataclass
class ReplayEvaluation:
    as_of: date
    fill_date: date | None
    signals: list[Signal]
    trades: list[ReplayTrade]
    skipped: list[str]
    before: dict
    after: dict

    def to_dict(self) -> dict:
        return {
            "as_of": self.as_of.isoformat(),
            "fill_date": self.fill_date.isoformat() if self.fill_date else None,
            "signals": [s.to_dict() for s in self.signals],
            "trades": [t.to_dict() for t in self.trades],
            "skipped": self.skipped,
            "before": self.before,
            "after": self.after,
        }


@dataclass
class ReplayResult:
    params_version: str
    params: dict
    fill: FillModel
    start: date
    end: date
    evaluations: list[ReplayEvaluation]
    equity_curve: list[dict]
    final: ReplayBook
    warnings: list[str] = field(default_factory=list)
    # Force-exits that landed after the last evaluation Friday (still in `end`).
    forced_exits: list[ReplayTrade] = field(default_factory=list)

    @property
    def trades(self) -> list[ReplayTrade]:
        return [t for ev in self.evaluations for t in ev.trades] + list(self.forced_exits)

    def summary(self) -> dict:
        first = self.equity_curve[0]["equity"] if self.equity_curve else None
        last = self.equity_curve[-1]["equity"] if self.equity_curve else None
        by_action: dict[str, int] = defaultdict(int)
        for t in self.trades:
            by_action[t.action] += 1
        return {
            "params_version": self.params_version,
            "fill": asdict(self.fill),
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "evaluations": len(self.evaluations),
            "trades": len(self.trades),
            "trades_by_action": dict(sorted(by_action.items())),
            "starting_equity": round(first, 2) if first is not None else None,
            "ending_equity": round(last, 2) if last is not None else None,
            "return_pct": (
                round((last / first - 1) * 100, 2) if first and last is not None else None
            ),
            "max_drawdown_pct": _max_drawdown_pct(self.equity_curve),
            "forced_exits": len(self.forced_exits)
            + sum(
                1
                for ev in self.evaluations
                for t in ev.trades
                if t.reason.startswith("delisted")
            ),
            "warnings": self.warnings,
        }

    def to_dict(self) -> dict:
        return {
            "summary": self.summary(),
            "params": self.params,
            "evaluations": [ev.to_dict() for ev in self.evaluations],
            "equity_curve": self.equity_curve,
            "final": self.final.snapshot(),
            "forced_exits": [t.to_dict() for t in self.forced_exits],
        }

    def diff_against_ledger(self, db: Session, portfolio_id: int) -> dict:
        """Compare replayed trades with the live book's `trades` table.

        Keys are (date, ticker, side, action). Manual rows — seeding and admin
        corrections — cannot come out of a replay and are listed separately so
        the interesting number, engine trades that differ, is not buried.
        Prices are reported but not compared: the live fill is the 11:00 ET
        quote, the replay fill is the close, and that gap is a property of the
        data, not a disagreement about what to do.
        """
        rows = (
            db.query(Trade)
            .filter(Trade.portfolio_id == portfolio_id)
            .order_by(Trade.timestamp.asc(), Trade.id.asc())
            .all()
        )
        ledger: dict[tuple, dict] = {}
        manual: list[dict] = []
        for t in rows:
            if t.timestamp is None:
                continue
            day = t.timestamp.date()
            if day < self.start or day > self.end:
                continue
            row = {
                "date": day.isoformat(),
                "ticker": t.ticker,
                "side": t.side,
                "action": t.action,
                "shares": round(t.shares or 0.0, 6),
                "price": round(t.price or 0.0, 4),
                "notional": round(t.notional or 0.0, 2),
            }
            if t.action in MANUAL_ACTIONS or (t.evaluation_id is None and t.signal_id is None):
                manual.append(row)
                continue
            ledger[(day, t.ticker, t.side, t.action)] = row

        replayed: dict[tuple, dict] = {}
        for t in self.trades:
            replayed[(t.fill_date, t.ticker, t.side, t.action)] = t.to_dict()

        matched = []
        for key in sorted(ledger.keys() & replayed.keys()):
            matched.append({"ledger": ledger[key], "replay": replayed[key]})
        only_ledger = [ledger[k] for k in sorted(ledger.keys() - replayed.keys())]
        only_replay = [replayed[k] for k in sorted(replayed.keys() - ledger.keys())]
        return {
            "matched": matched,
            "only_in_ledger": only_ledger,
            "only_in_replay": only_replay,
            "manual_ignored": manual,
            "parity": not only_ledger and not only_replay,
        }


def _max_drawdown_pct(curve: list[dict]) -> float | None:
    peak = None
    worst = 0.0
    for point in curve:
        eq = point["equity"]
        if peak is None or eq > peak:
            peak = eq
        if peak and peak > 0:
            dd = (eq - peak) / peak
            worst = min(worst, dd)
    return round(worst * 100, 2) if peak is not None else None


# ---------------------------------------------------------------------------
# Price access
# ---------------------------------------------------------------------------


class _Prices:
    """Close lookups over `price_bars` with per-date and per-ticker caches."""

    def __init__(self, db: Session, start: date, end: date):
        self.db = db
        self.start = start
        self.end = end
        self._by_date: dict[date, dict[str, float]] = {}
        self._series: dict[str, dict[date, float]] = {}
        self._dates: list[date] | None = None

    def trading_dates(self) -> list[date]:
        """Every date with at least one bar in the window (plus a lead-in)."""
        if self._dates is None:
            rows = (
                self.db.query(PriceBar.date)
                .filter(
                    PriceBar.date >= self.start - timedelta(days=10),
                    PriceBar.date <= self.end + timedelta(days=10),
                )
                .distinct()
                .order_by(PriceBar.date.asc())
                .all()
            )
            self._dates = [r[0] for r in rows]
        return self._dates

    def last_trading_day_on_or_before(self, d: date) -> date | None:
        out = None
        for td in self.trading_dates():
            if td <= d:
                out = td
            else:
                break
        return out

    def next_trading_day_after(self, d: date) -> date | None:
        for td in self.trading_dates():
            if td > d:
                return td
        return None

    def closes_on(self, d: date) -> dict[str, float]:
        if d not in self._by_date:
            rows = (
                self.db.query(PriceBar.ticker, PriceBar.close)
                .filter(PriceBar.date == d)
                .all()
            )
            self._by_date[d] = {t: float(c) for t, c in rows if c is not None and c > 0}
        return self._by_date[d]

    def series(self, ticker: str) -> dict[date, float]:
        if ticker not in self._series:
            rows = (
                self.db.query(PriceBar.date, PriceBar.close)
                .filter(
                    PriceBar.ticker == ticker,
                    PriceBar.date >= self.start - timedelta(days=10),
                    PriceBar.date <= self.end + timedelta(days=10),
                )
                .all()
            )
            self._series[ticker] = {d: float(c) for d, c in rows if c is not None and c > 0}
        return self._series[ticker]

    def close(self, ticker: str, d: date) -> float | None:
        return self.series(ticker).get(d)

    def last_close_on_or_before(self, ticker: str, d: date) -> tuple[date, float] | None:
        """Last positive close at or before `d`, even outside the replay window."""
        cached = self.series(ticker)
        best: tuple[date, float] | None = None
        for day, close in cached.items():
            if day <= d and (best is None or day > best[0]):
                best = (day, close)
        if best is not None:
            return best
        row = (
            self.db.query(PriceBar.date, PriceBar.close)
            .filter(PriceBar.ticker == ticker, PriceBar.date <= d, PriceBar.close > 0)
            .order_by(PriceBar.date.desc())
            .first()
        )
        if row is None:
            return None
        return row[0], float(row[1])


# ---------------------------------------------------------------------------
# Book reconstruction
# ---------------------------------------------------------------------------


def reconstruct_book(db: Session, portfolio: Portfolio, as_of: date) -> ReplayBook:
    """The live book as it stood at the close of `as_of`, rebuilt from trades.

    Starting cash is inferred: today's cash plus every dollar spent minus every
    dollar received across the whole ledger is what the book began with. Trades
    dated on or before `as_of` are then applied in order under the same
    average-cost rules `apply_signals` uses. `is_house_money` is inferred from a
    Winners Circle `partial_sell` and cleared by any later buy, matching the
    executor.

    Admin edits that settled cash without a trade row (BUG-A1) are invisible
    here, so a book that was hand-corrected will not reconcile to the cent. The
    diff compares actions, not dollars, for exactly that reason.
    """
    trades = (
        db.query(Trade)
        .filter(Trade.portfolio_id == portfolio.id)
        .order_by(Trade.timestamp.asc(), Trade.id.asc())
        .all()
    )
    starting_cash = float(portfolio.cash or 0.0)
    for t in trades:
        notional = float(t.notional or 0.0)
        if t.side == "buy":
            starting_cash += notional
        elif t.side == "sell":
            starting_cash -= notional

    book = ReplayBook(cash=starting_cash)
    for t in trades:
        if t.timestamp is None or t.timestamp.date() > as_of:
            continue
        _apply_ledger_trade(book, t)
    return book


def _apply_ledger_trade(book: ReplayBook, t: Trade) -> None:
    qty = float(t.shares or 0.0)
    notional = float(t.notional or 0.0)
    price = float(t.price or 0.0)
    pos = book.positions.get(t.ticker)
    if t.side == "buy":
        book.cash -= notional
        if pos is None:
            book.positions[t.ticker] = ReplayPosition(
                ticker=t.ticker,
                shares=qty,
                avg_cost=price,
                current_price=price,
                entry_date=t.timestamp.date(),
                initial_investment=notional,
            )
        else:
            new_shares = pos.shares + qty
            pos.avg_cost = (
                (pos.avg_cost * pos.shares + price * qty) / new_shares if new_shares > 0 else price
            )
            pos.shares = new_shares
            pos.current_price = price
            pos.initial_investment = (pos.initial_investment or 0.0) + notional
            pos.is_house_money = False
        return

    # sell or correction
    book.cash += notional
    if pos is None:
        return
    pos.shares -= qty
    if pos.shares <= SHARE_EPSILON or t.action == Action.FULL_SELL.value:
        book.positions.pop(t.ticker, None)
    elif t.action == Action.PARTIAL_SELL.value:
        pos.is_house_money = True


# ---------------------------------------------------------------------------
# Core loop
# ---------------------------------------------------------------------------


def replay(
    db: Session,
    params: StrategyParams | None,
    start: date,
    end: date,
    *,
    fill: FillModel | None = None,
    initial_book: ReplayBook | None = None,
    initial_cash: float | None = None,
    eval_dates: list[date] | None = None,
    equity_curve: bool = True,
) -> ReplayResult:
    """Run `evaluate()` on every evaluation Friday in [start, end] and fill in memory.

    Provide exactly one of `initial_book` (usually `reconstruct_book`) or
    `initial_cash` (a fresh book). Evaluation dates default to the 1st/3rd
    Fridays, each moved back to the last date that has any price bar, which is
    how the worker's holiday handling lands too. Pass `eval_dates` to override.
    """
    params = params or RUN118_PARAMS
    fill = fill or FillModel()
    if initial_book is None and initial_cash is None:
        raise ValueError("replay needs initial_book or initial_cash")
    book = initial_book if initial_book is not None else ReplayBook(cash=float(initial_cash))
    prices = _Prices(db, start, end)
    delistings = _load_delistings(db)
    warnings: list[str] = []

    if eval_dates is None:
        eval_dates = []
        for friday in evaluation_fridays_between(start, end):
            session = prices.last_trading_day_on_or_before(friday)
            if session is None or session < start:
                warnings.append(f"{friday}: no price bars on or before this Friday; skipped")
                continue
            if session not in eval_dates:
                eval_dates.append(session)

    evaluations: list[ReplayEvaluation] = []
    for as_of in eval_dates:
        evaluations.append(
            _run_one(db, book, params, as_of, fill, prices, delistings, warnings)
        )

    late_exits = _force_exit_delisted(
        book, prices, delistings, as_of=end, eval_date=end, skipped=[]
    )
    if late_exits:
        for t in late_exits:
            warnings.append(
                f"{t.ticker}: delisted holding force-exited after last evaluation"
            )

    extra = late_exits
    curve = (
        _equity_curve(book, evaluations, prices, start, end, extra_fills=extra)
        if equity_curve
        else []
    )

    return ReplayResult(
        params_version=params.version_hash(),
        params=params.to_dict(),
        fill=fill,
        start=start,
        end=end,
        evaluations=evaluations,
        equity_curve=curve,
        final=book,
        warnings=warnings,
        forced_exits=late_exits,
    )


def _mark(book: ReplayBook, closes: dict[str, float], skipped: list[str], as_of: date) -> None:
    for pos in book.positions.values():
        close = closes.get(pos.ticker)
        if close:
            pos.current_price = close
        else:
            skipped.append(f"{pos.ticker}: no bar on {as_of}, marked at last known price")


def _load_delistings(db: Session) -> dict[str, date]:
    return {row.ticker: row.date for row in db.query(Delisting).all()}


def _force_exit_delisted(
    book: ReplayBook,
    prices: _Prices,
    delistings: dict[str, date],
    *,
    as_of: date,
    eval_date: date,
    skipped: list[str],
) -> list[ReplayTrade]:
    """Sell any holding whose `delistings.date` is on or before `as_of`.

    Price is the last close on or before the delisting date (0 bps — this is a
    corporate action, not a strategy fill). The trade is booked on `eval_date`
    so the replay loop and equity curve stay aligned; without the exit the
    name would sit at its last mark forever.
    """
    if not delistings or not book.positions:
        return []
    trades: list[ReplayTrade] = []
    for ticker in list(book.positions):
        ddate = delistings.get(ticker)
        if ddate is None or ddate > as_of:
            continue
        pos = book.positions[ticker]
        last = prices.last_close_on_or_before(ticker, ddate)
        if last is None:
            close = pos.current_price or 0.0
            price_date = ddate
            skipped.append(f"{ticker}: delisted {ddate.isoformat()}, no last close")
        else:
            price_date, close = last
        price = float(close or 0.0)
        shares = pos.shares
        notional = shares * price
        book.cash += notional
        book.positions.pop(ticker, None)
        reason = (
            f"delisted {ddate.isoformat()}; force-exited at last close "
            f"on {price_date.isoformat()}"
        )
        trades.append(
            ReplayTrade(
                eval_date,
                eval_date,
                ticker,
                "sell",
                Action.FULL_SELL.value,
                shares,
                price,
                notional,
                reason,
            )
        )
    return trades


def _run_one(
    db: Session,
    book: ReplayBook,
    params: StrategyParams,
    as_of: date,
    fill: FillModel,
    prices: _Prices,
    delistings: dict[str, date],
    warnings: list[str],
) -> ReplayEvaluation:
    skipped: list[str] = []
    closes = prices.closes_on(as_of)
    _mark(book, closes, skipped, as_of)
    before = book.snapshot()
    forced = _force_exit_delisted(
        book, prices, delistings, as_of=as_of, eval_date=as_of, skipped=skipped
    )

    scores = load_scores_as_of(db, as_of)
    if not scores:
        warnings.append(f"{as_of}: no composite scores on or before this date")
    ranked = ranked_candidates(scores, params)
    state = book.to_state(as_of)
    signals = evaluate(
        state,
        scores,
        ranked,
        params,
        as_of=as_of,
        return_series=return_series_for(db, state, scores, params, as_of),
    )

    if fill.price == "next_close":
        fill_date = prices.next_trading_day_after(as_of)
        if fill_date is None:
            skipped.append(f"no session after {as_of} to fill next_close; nothing filled")
            return ReplayEvaluation(
                as_of, None, signals, forced, skipped, before, book.snapshot()
            )
        fill_closes = prices.closes_on(fill_date)
    else:
        fill_date = as_of
        fill_closes = closes

    trades = forced + _fill(book, signals, scores, fill, fill_date, fill_closes, skipped, as_of)

    # Peak equity, as apply_signals does after the fills.
    equity = book.equity
    if book.peak_equity is None or equity > book.peak_equity:
        book.peak_equity = equity
    # The drawdown breaker's halted flag is engine state the live path stores on
    # the Portfolio row; mirror the rule so a replay with the breaker enabled
    # behaves the same way.
    if params.enable_drawdown_circuit_breaker and book.peak_equity:
        dd = (equity - book.peak_equity) / book.peak_equity
        if book.is_drawdown_halted and dd > params.drawdown_resume_pct:
            book.is_drawdown_halted = False
        elif not book.is_drawdown_halted and dd < params.drawdown_halt_pct:
            book.is_drawdown_halted = True

    return ReplayEvaluation(as_of, fill_date, signals, trades, skipped, before, book.snapshot())


def _fill(
    book: ReplayBook,
    signals: list[Signal],
    scores: dict[str, ScoreSnapshot],
    fill: FillModel,
    fill_date: date,
    closes: dict[str, float],
    skipped: list[str],
    eval_date: date,
) -> list[ReplayTrade]:
    """`apply_signals`, without the ORM."""
    trades: list[ReplayTrade] = []
    ordered = sorted(
        signals,
        key=lambda s: _EXECUTION_ORDER.index(s.action) if s.action in _EXECUTION_ORDER else 99,
    )
    for sig in ordered:
        if sig.action in _SELL_ACTIONS:
            pos = book.positions.get(sig.ticker)
            if pos is None:
                continue
            close = closes.get(sig.ticker) or pos.current_price
            if not close or close <= 0:
                skipped.append(f"{sig.ticker}: no fill price for {sig.action.value}")
                continue
            price = fill.sell_price(close)
            shares = pos.shares if sig.action == Action.FULL_SELL else min(pos.shares, sig.sell_shares or 0.0)
            if shares <= 0:
                continue
            notional = shares * price
            book.cash += notional
            trades.append(
                ReplayTrade(eval_date, fill_date, sig.ticker, "sell", sig.action.value, shares, price, notional, sig.reason)
            )
            if sig.action == Action.FULL_SELL or shares >= pos.shares - 1e-9:
                book.positions.pop(sig.ticker, None)
            else:
                pos.shares -= shares
                pos.current_price = close
                if sig.action == Action.PARTIAL_SELL:
                    pos.is_house_money = True

        elif sig.action in _BUY_ACTIONS:
            target = float(sig.metadata.get("target_notional") or 0.0)
            pos = book.positions.get(sig.ticker)
            close = closes.get(sig.ticker) or (pos.current_price if pos else None)
            if not close or close <= 0 or target <= 0:
                skipped.append(f"{sig.ticker}: no fill price for {sig.action.value}")
                continue
            price = fill.buy_price(close)
            shares = target / price
            notional = shares * price
            if notional > book.cash:
                shares = book.cash / price
                notional = shares * price
                skipped.append(
                    f"{sig.ticker}: {sig.action.value} clamped to cash "
                    f"({notional:.2f} of {target:.2f})"
                )
            if shares <= 0 or notional <= 0:
                continue
            book.cash -= notional
            trades.append(
                ReplayTrade(eval_date, fill_date, sig.ticker, "buy", sig.action.value, shares, price, notional, sig.reason)
            )
            if pos is not None:
                new_shares = pos.shares + shares
                pos.avg_cost = (pos.avg_cost * pos.shares + price * shares) / new_shares
                pos.shares = new_shares
                pos.current_price = close
                pos.initial_investment = (pos.initial_investment or 0.0) + notional
                pos.is_house_money = False
            else:
                score = scores.get(sig.ticker)
                book.positions[sig.ticker] = ReplayPosition(
                    ticker=sig.ticker,
                    shares=shares,
                    avg_cost=price,
                    current_price=close,
                    entry_date=fill_date,
                    initial_investment=notional,
                    sector=score.sector if score else None,
                )
    return trades


def _equity_curve(
    book: ReplayBook,
    evaluations: list[ReplayEvaluation],
    prices: _Prices,
    start: date,
    end: date,
    extra_fills: list[ReplayTrade] | None = None,
) -> list[dict]:
    """Daily equity by re-walking the fills over every session in the window.

    The book passed in is the *final* state; the walk starts from the state
    before the first evaluation (its `before` snapshot) and applies each
    evaluation's trades on their fill dates, so the curve reflects what was
    held on each day rather than today's holdings priced historically.
    """
    if not evaluations:
        return []
    # Rebuild the opening book from the first evaluation's snapshot.
    first = evaluations[0].before
    holdings: dict[str, float] = {t: p["shares"] for t, p in first["positions"].items()}
    cash = first["cash"]
    fills_by_date: dict[date, list[ReplayTrade]] = defaultdict(list)
    for ev in evaluations:
        for t in ev.trades:
            fills_by_date[t.fill_date].append(t)
    for t in extra_fills or []:
        fills_by_date[t.fill_date].append(t)

    last_price: dict[str, float] = {
        t: p["current_price"] for t, p in first["positions"].items()
    }
    curve: list[dict] = []
    for d in prices.trading_dates():
        if d < evaluations[0].as_of or d > end:
            continue
        for t in fills_by_date.get(d, []):
            if t.side == "buy":
                cash -= t.notional
                holdings[t.ticker] = holdings.get(t.ticker, 0.0) + t.shares
            else:
                cash += t.notional
                holdings[t.ticker] = holdings.get(t.ticker, 0.0) - t.shares
                if holdings[t.ticker] <= SHARE_EPSILON:
                    holdings.pop(t.ticker, None)
        invested = 0.0
        for ticker, shares in holdings.items():
            close = prices.close(ticker, d)
            if close:
                last_price[ticker] = close
            invested += shares * last_price.get(ticker, 0.0)
        curve.append(
            {
                "date": d.isoformat(),
                "cash": round(cash, 2),
                "invested": round(invested, 2),
                "equity": round(cash + invested, 2),
                "position_count": len(holdings),
            }
        )
    return curve
    """Daily equity by re-walking the fills over every session in the window.

    The book passed in is the *final* state; the walk starts from the state
    before the first evaluation (its `before` snapshot) and applies each
    evaluation's trades on their fill dates, so the curve reflects what was
    held on each day rather than today's holdings priced historically.
    """
    if not evaluations:
        return []
    # Rebuild the opening book from the first evaluation's snapshot.
    first = evaluations[0].before
    holdings: dict[str, float] = {t: p["shares"] for t, p in first["positions"].items()}
    cash = first["cash"]
    fills_by_date: dict[date, list[ReplayTrade]] = defaultdict(list)
    for ev in evaluations:
        for t in ev.trades:
            fills_by_date[t.fill_date].append(t)

    last_price: dict[str, float] = {
        t: p["current_price"] for t, p in first["positions"].items()
    }
    curve: list[dict] = []
    for d in prices.trading_dates():
        if d < evaluations[0].as_of or d > end:
            continue
        for t in fills_by_date.get(d, []):
            if t.side == "buy":
                cash -= t.notional
                holdings[t.ticker] = holdings.get(t.ticker, 0.0) + t.shares
            else:
                cash += t.notional
                holdings[t.ticker] = holdings.get(t.ticker, 0.0) - t.shares
                if holdings[t.ticker] <= SHARE_EPSILON:
                    holdings.pop(t.ticker, None)
        invested = 0.0
        for ticker, shares in holdings.items():
            close = prices.close(ticker, d)
            if close:
                last_price[ticker] = close
            invested += shares * last_price.get(ticker, 0.0)
        curve.append(
            {
                "date": d.isoformat(),
                "cash": round(cash, 2),
                "invested": round(invested, 2),
                "equity": round(cash + invested, 2),
                "position_count": len(holdings),
            }
        )
    return curve


def score_history_range(db: Session) -> tuple[date | None, date | None]:
    """First and last dates a replay can reach."""
    row = db.query(func.min(CompositeScore.as_of), func.max(CompositeScore.as_of)).one()
    return row[0], row[1]
