"""Reconstruct the daily equity curve from inception using historical EOD prices.

WHY THIS EXISTS
---------------
`portfolio_snapshots` only starts accruing rows when the worker's `refresh_marks`
first runs. The live book was hand-entered long after its nominal inception, so
the table held two rows while the landing page claimed "Day 115". Every
window-derived statistic (the chart, the annualized return) was therefore
computed over a ~1 day window, and the CAGR collapsed to an em-dash.

This module rebuilds the missing history from data we already have: each
`Position` carries `entry_date`, `shares` and `avg_cost`, `Trade` records the
closed picks, and FMP exposes historical end-of-day closes.


MODELLING ASSUMPTION — READ THIS BEFORE TRUSTING THE OUTPUT
-----------------------------------------------------------
The book has no external deposits or withdrawals, so total equity is a closed
system and can be walked backwards from today:

    equity(D) = cash(D) + Σ shares_i × close_i(D)   over lots open on D

    cash(D)   = cash_today
                + Σ cost_i      for every lot OPENED after D
                − Σ proceeds_i  for every lot CLOSED after D

**Capital was uninvested before a position was entered, not absent.** A lot
contributes exactly ZERO market value before its `entry_date`; its cost basis
sits in cash instead. Equity is therefore continuous across the entry: on the
day before entry the cash line carries `cost`, and on the entry day that cash is
swapped for `shares × close(entry_date)`. The resulting day-one move for a
position is its fill-to-close P&L, which is real and is not smoothed away.

The reconstruction does NOT invent a return before inception and it does NOT
back-date a position into a period it was not held. If you see a rising curve
before a pick's entry date, something is wrong — that is the failure mode this
whole module is written to avoid, because for an investing product a fabricated
track record is the worst possible bug.

Known limits, stated rather than hidden:

* **Intraday fills are unknown.** Entry-day P&L is measured fill → close. It is
  not possible to do better without tick data.
* **Partial sells** (Winners Circle house-money trims) are not replayed: a
  ticker with an open `Position` is reconstructed from that position alone, so
  the trimmed proceeds are modelled as having been in cash the whole time. This
  understates the early curve slightly. Affected tickers are logged by name.
* **Admin corrections** (`manual_remove`) are not sales. Tickers whose only exit
  is a correction are dropped entirely — they were never really held.
* **Cash is assumed flat between events.** No interest is accrued on idle cash.
* Prices are FMP's `adjClose` where the endpoint supplies it and the raw
  `close` otherwise (`ingest.CLOSE_FIELDS`). Under adjClose the curve is a
  total-return series for splits but not for cash dividends; if FMP turns out
  to omit adjClose on this endpoint the series is unadjusted and a split
  inside the window would step the reconstructed market value by the split
  ratio. `backfill_price_history` logs which of the two you actually got.
"""

from __future__ import annotations

import bisect
import logging
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.db.models import Portfolio, PortfolioSnapshot, Position, Trade
from app.services.benchmarks import BENCHMARKS, CALENDAR_BENCHMARK

from worker.services.ingest import CLOSE_FIELDS, first_present, upsert_price_bar

log = logging.getLogger(__name__)

#: `manual_remove` refunds a cost basis after a typo; it is an admin correction,
#: not a market exit. Mirrors `app.services.portfolio.CORRECTION_ACTIONS`.
CORRECTION_ACTIONS = ("manual_remove",)

#: The benchmark series drawn beside the book on the landing chart.
#: Imported from `app.services.benchmarks` so a ticker added there is fetched
#: here without a second edit. SPY still drives the trading calendar; the rest
#: are best-effort — a missing one is logged and omitted from the chart rather
#: than aborting the backfill.
BENCHMARK_TICKER = CALENDAR_BENCHMARK
EXTRA_BENCHMARKS = tuple(t for t in BENCHMARKS if t != BENCHMARK_TICKER)


@dataclass
class Lot:
    """One round trip (or still-open leg) of capital.

    `cost` leaves cash on `open_date`; `proceeds` returns to cash on
    `close_date`. Between those dates the lot is marked to market.
    """

    ticker: str
    shares: float
    cost: float
    open_date: date
    close_date: date | None = None
    proceeds: float = 0.0

    def is_open_on(self, day: date) -> bool:
        if day < self.open_date:
            return False
        return self.close_date is None or day < self.close_date


@dataclass
class BackfillPlan:
    """What the backfill would write, before anything is committed."""

    portfolio_id: int
    start: date
    end: date
    lots: list[Lot] = field(default_factory=list)
    rows: list[dict] = field(default_factory=list)
    price_bars: list[tuple[str, date, float]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def tickers(self) -> list[str]:
        return sorted({lot.ticker for lot in self.lots})


class BackfillError(RuntimeError):
    """The reconstruction cannot be trusted, so nothing is written.

    Raised rather than degraded: a partial equity curve published as a track
    record is worse than no curve at all.
    """


# ---------------------------------------------------------------------------
# Lot construction
# ---------------------------------------------------------------------------


def _position_lot(pos: Position, fallback_open: date) -> Lot:
    cost = pos.initial_investment
    if not cost or cost <= 0:
        cost = (pos.shares or 0.0) * (pos.avg_cost or 0.0)
    return Lot(
        ticker=pos.ticker.upper(),
        shares=pos.shares or 0.0,
        cost=float(cost or 0.0),
        open_date=pos.entry_date or fallback_open,
    )


def _closed_lots(
    db: Session, portfolio_id: int, open_tickers: set[str], warnings: list[str]
) -> list[Lot]:
    """Round trips for tickers no longer in the book, rebuilt from trades.

    Deliberately skipped for tickers that still have an open `Position`: the
    admin position editor writes BOTH a `Position` and a `manual_buy` `Trade`,
    so replaying trades for those names would double-count the capital.
    """
    trades = (
        db.query(Trade)
        .filter(Trade.portfolio_id == portfolio_id)
        .order_by(Trade.timestamp.asc())
        .all()
    )
    by_ticker: dict[str, list[Trade]] = {}
    for t in trades:
        by_ticker.setdefault((t.ticker or "").upper(), []).append(t)

    lots: list[Lot] = []
    for ticker, rows in sorted(by_ticker.items()):
        if not ticker:
            continue
        if ticker in open_tickers:
            if any(r.side == "sell" and r.action not in CORRECTION_ACTIONS for r in rows):
                warnings.append(
                    f"{ticker} has a partial sell and an open position; the trimmed "
                    f"proceeds are modelled as cash from inception"
                )
            continue

        buys = [r for r in rows if r.side == "buy" and r.action not in CORRECTION_ACTIONS]
        sells = [r for r in rows if r.side == "sell"]
        corrections = [r for r in sells if r.action in CORRECTION_ACTIONS]
        real_sells = [r for r in sells if r.action not in CORRECTION_ACTIONS]

        if not buys:
            continue
        if corrections and not real_sells:
            # Mistyped entry, later deleted. It was never held.
            warnings.append(f"{ticker} was an admin correction, not a pick — excluded")
            continue
        if not real_sells:
            # Bought and never sold, yet no open Position row. The book and the
            # trade log disagree; refuse to guess.
            warnings.append(
                f"{ticker} has buys but neither an open position nor a sell — excluded"
            )
            continue

        shares = sum(r.shares or 0.0 for r in buys)
        cost = sum(r.notional or 0.0 for r in buys)
        proceeds = sum(r.notional or 0.0 for r in real_sells)
        open_date = min(r.timestamp.date() for r in buys if r.timestamp)
        close_date = max(r.timestamp.date() for r in real_sells if r.timestamp)
        if close_date <= open_date:
            warnings.append(f"{ticker} opened and closed on the same day — excluded")
            continue
        lots.append(
            Lot(
                ticker=ticker,
                shares=shares,
                cost=float(cost),
                open_date=open_date,
                close_date=close_date,
                proceeds=float(proceeds),
            )
        )
    return lots


def build_lots(
    db: Session, portfolio: Portfolio, inception: date, warnings: list[str]
) -> list[Lot]:
    positions = (
        db.query(Position)
        .filter(Position.portfolio_id == portfolio.id)
        .order_by(Position.ticker.asc())
        .all()
    )
    open_tickers = {(p.ticker or "").upper() for p in positions}
    lots = []
    for pos in positions:
        if not pos.entry_date:
            warnings.append(
                f"{pos.ticker} has no entry_date; assuming it was held from "
                f"inception ({inception.isoformat()})"
            )
        lots.append(_position_lot(pos, inception))
    lots.extend(_closed_lots(db, portfolio.id, open_tickers, warnings))
    return lots


# ---------------------------------------------------------------------------
# Prices
# ---------------------------------------------------------------------------


class PriceSeries:
    """Sorted closes for one ticker, with as-of lookup.

    `at()` returns the most recent close on or before a date. That is a
    forward-fill, but it only ever runs on days the *calendar* says were trading
    days, so it fills a halted or thinly-quoted name across a real session
    rather than manufacturing weekend and holiday bars.
    """

    def __init__(self, ticker: str, closes: dict[date, float]):
        self.ticker = ticker
        self.dates = sorted(closes)
        self.closes = closes

    def __bool__(self) -> bool:
        return bool(self.dates)

    def at(self, day: date) -> float | None:
        idx = bisect.bisect_right(self.dates, day) - 1
        if idx < 0:
            return None
        return self.closes[self.dates[idx]]

    def items(self) -> list[tuple[date, float]]:
        return [(d, self.closes[d]) for d in self.dates]


def _parse_series(ticker: str, rows: list[dict]) -> PriceSeries:
    """Normalise FMP `/stable/historical-price-eod/full` rows.

    `/stable` returns a bare list whose rows include at least
    `{"symbol", "date", "close"}`; the retired `/api/v3` nested them under
    `"historical"` (already unwrapped by `FMPClient.historical_prices`). That
    sentence is about the LIST vs NESTED shape only — it is not a statement that
    adjClose is absent, and nothing in this repo records a real payload either
    way, so both fields are handled.

    Field priority is `ingest.CLOSE_FIELDS`, imported rather than restated.
    This function used to read `close` first while `backfill_price_history` read
    `adjClose` first, and both write the same `price_bars` table through
    `upsert_price_bar`, which OVERWRITES on conflict — so a split-affected
    ticker's series jumped by the split ratio wherever the two jobs' date ranges
    met. Sharing the constant is what makes them agree; two independent
    ordered-lookup expressions would just drift apart again.
    """
    closes: dict[date, float] = {}
    for row in rows or []:
        raw_date = row.get("date")
        raw_close = first_present(row, *CLOSE_FIELDS)
        if not raw_date or raw_close is None:
            continue
        try:
            day = date.fromisoformat(str(raw_date)[:10])
            close = float(raw_close)
        except (TypeError, ValueError):
            continue
        if close <= 0:
            continue
        closes[day] = close
    return PriceSeries(ticker, closes)


def fetch_prices(fmp, tickers: list[str], start: date) -> dict[str, PriceSeries]:
    """One request per symbol.

    `batch-quote` is 402 Restricted on this plan and the client throttles to 60
    req/min with 429 backoff. A book of a few dozen names plus SPY is well
    inside a minute or two; do not raise the limit to speed this up.
    """
    out: dict[str, PriceSeries] = {}
    for ticker in tickers:
        rows = fmp.historical_prices(ticker, start)
        series = _parse_series(ticker, rows)
        log.info("Fetched %s bars for %s from %s", len(series.dates), ticker, start)
        out[ticker] = series
    return out


# ---------------------------------------------------------------------------
# Reconstruction
# ---------------------------------------------------------------------------


def cash_on(lots: list[Lot], day: date, cash_today: float) -> float:
    """Cash walked backwards from today's balance.

    Cost that has not yet been spent as of `day` is still cash; proceeds not yet
    received are not. This is what keeps total equity continuous across an entry
    instead of having capital appear out of nowhere on the entry date.
    """
    cash = cash_today
    for lot in lots:
        if lot.open_date > day:
            cash += lot.cost
        if lot.close_date is not None and lot.close_date > day:
            cash -= lot.proceeds
    return cash


def build_plan(
    db: Session,
    fmp,
    portfolio: Portfolio,
    start: date | None = None,
    end: date | None = None,
    allow_missing_prices: bool = False,
) -> BackfillPlan:
    """Compute every snapshot row without touching the database."""
    warnings: list[str] = []

    inception = start or portfolio.inception_date
    if inception is None:
        earliest = (
            db.query(Position.entry_date)
            .filter(Position.portfolio_id == portfolio.id, Position.entry_date.isnot(None))
            .order_by(Position.entry_date.asc())
            .first()
        )
        inception = earliest[0] if earliest else None
    if inception is None:
        raise BackfillError(
            "No inception date: set Portfolio.inception_date or give positions an "
            "entry_date. Refusing to guess when the track record started."
        )

    end = end or date.today()
    if end < inception:
        raise BackfillError(f"end {end} precedes inception {inception}")

    lots = build_lots(db, portfolio, inception, warnings)
    if not lots:
        raise BackfillError("No positions or trades to reconstruct from")

    earliest_lot = min(lot.open_date for lot in lots)
    if earliest_lot < inception:
        warnings.append(
            f"a lot opens {earliest_lot} before inception {inception}; "
            f"starting the curve at {earliest_lot} instead"
        )
        inception = earliest_lot

    tickers = sorted(
        {lot.ticker for lot in lots} | {BENCHMARK_TICKER} | set(EXTRA_BENCHMARKS)
    )
    series = fetch_prices(fmp, tickers, inception)

    for extra in EXTRA_BENCHMARKS:
        if not series.get(extra):
            log.warning(
                "No history for benchmark %s; it will be omitted from the "
                "comparison chart rather than drawn flat",
                extra,
            )

    benchmark = series.get(BENCHMARK_TICKER)
    if not benchmark:
        raise BackfillError(
            f"No {BENCHMARK_TICKER} history returned — the trading calendar is "
            f"derived from it, and without it every weekend would be a snapshot."
        )

    # Only HELD names may abort the run. A missing comparison ETF costs us a
    # line on a chart; a missing holding would silently be carried flat at cost
    # and look like a real zero-volatility track record.
    held = {lot.ticker for lot in lots}
    missing = [t for t in sorted(held) if not series.get(t)]
    if missing:
        message = f"No price history for {', '.join(missing)}"
        if not allow_missing_prices:
            raise BackfillError(
                message
                + " — refusing to write a curve that holds those names flat at cost, "
                "which would look like a real (zero-volatility) track record. "
                "Re-run with allow_missing_prices=True only if you accept that."
            )
        warnings.append(message + " — held flat at cost basis")

    # The calendar is the benchmark's own sessions, so weekends and market
    # holidays are simply absent rather than forward-filled.
    calendar = [d for d in benchmark.dates if inception <= d <= end]
    if not calendar:
        raise BackfillError(
            f"No trading days between {inception} and {end} in the {BENCHMARK_TICKER} series"
        )

    cash_today = float(portfolio.cash or 0.0)
    plan = BackfillPlan(portfolio_id=portfolio.id, start=calendar[0], end=calendar[-1])
    plan.lots = lots
    plan.warnings = warnings

    cost_by_ticker: dict[str, float] = {}
    for lot in lots:
        cost_by_ticker.setdefault(lot.ticker, lot.cost / lot.shares if lot.shares else 0.0)

    for day in calendar:
        invested = 0.0
        held = 0
        for lot in lots:
            if not lot.is_open_on(day):
                continue  # ZERO before entry_date and after the exit. Non-negotiable.
            price = series[lot.ticker].at(day) if series.get(lot.ticker) else None
            if price is None:
                price = cost_by_ticker.get(lot.ticker, 0.0)
            invested += lot.shares * price
            held += 1
        cash = cash_on(lots, day, cash_today)
        plan.rows.append(
            {
                "date": day,
                "cash": round(cash, 6),
                "invested_value": round(invested, 6),
                "total_value": round(cash + invested, 6),
                "spy_value": benchmark.at(day),
                "position_count": held,
            }
        )

    for ticker, s in series.items():
        for day, close in s.items():
            if plan.start <= day <= plan.end:
                plan.price_bars.append((ticker, day, close))

    return plan


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------


def upsert_snapshot(db: Session, portfolio_id: int, row: dict) -> PortfolioSnapshot:
    """Insert-or-update one snapshot.

    Same shape as `upsert_price_bar`: `db.merge()` would emit an INSERT for a
    PK-less instance and trip the `(portfolio_id, date)` unique constraint, so
    re-running the backfill would crash instead of being idempotent.
    """
    existing = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.portfolio_id == portfolio_id,
            PortfolioSnapshot.date == row["date"],
        )
        .one_or_none()
    )
    if existing:
        existing.cash = row["cash"]
        existing.invested_value = row["invested_value"]
        existing.total_value = row["total_value"]
        existing.spy_value = row["spy_value"]
        existing.position_count = row["position_count"]
        return existing
    snap = PortfolioSnapshot(
        portfolio_id=portfolio_id,
        date=row["date"],
        cash=row["cash"],
        invested_value=row["invested_value"],
        total_value=row["total_value"],
        spy_value=row["spy_value"],
        position_count=row["position_count"],
    )
    db.add(snap)
    db.flush()
    return snap


def apply_plan(db: Session, plan: BackfillPlan, write_price_bars: bool = True) -> int:
    for ticker, day, close in plan.price_bars if write_price_bars else []:
        upsert_price_bar(db, ticker, day, close)
    for row in plan.rows:
        upsert_snapshot(db, plan.portfolio_id, row)
    db.commit()
    return len(plan.rows)


def log_plan(plan: BackfillPlan, sample: int = 5) -> None:
    log.info(
        "Backfill plan: %s snapshots %s → %s across %s lots (%s tickers)",
        len(plan.rows),
        plan.start,
        plan.end,
        len(plan.lots),
        len(plan.tickers),
    )
    for warning in plan.warnings:
        log.warning("Backfill: %s", warning)
    for lot in sorted(plan.lots, key=lambda l: l.open_date):
        log.info(
            "  lot %-6s %10.4f sh  cost %12.2f  %s → %s",
            lot.ticker,
            lot.shares,
            lot.cost,
            lot.open_date,
            lot.close_date or "open",
        )
    head = plan.rows[:sample]
    tail = plan.rows[-sample:] if len(plan.rows) > sample else []
    for label, rows in (("first", head), ("last", tail)):
        for row in rows:
            log.info(
                "  %-5s %s cash=%12.2f invested=%12.2f total=%12.2f spy=%s n=%s",
                label,
                row["date"],
                row["cash"],
                row["invested_value"],
                row["total_value"],
                f"{row['spy_value']:.2f}" if row["spy_value"] else "—",
                row["position_count"],
            )
    if plan.rows:
        base = plan.rows[0]["total_value"]
        last = plan.rows[-1]["total_value"]
        if base:
            log.info(
                "Reconstructed return over the window: %+.2f%% (%.2f → %.2f)",
                (last / base - 1) * 100,
                base,
                last,
            )


def backfill_snapshots(
    db: Session,
    fmp,
    portfolio: Portfolio,
    start: date | None = None,
    end: date | None = None,
    dry_run: bool = True,
    allow_missing_prices: bool = False,
    write_price_bars: bool = True,
) -> BackfillPlan:
    """Reconstruct and (unless `dry_run`) persist the equity curve.

    Defaults to `dry_run=True` on purpose: this writes the numbers behind a
    public performance claim, so the caller has to ask for the write explicitly.
    """
    plan = build_plan(
        db,
        fmp,
        portfolio,
        start=start,
        end=end,
        allow_missing_prices=allow_missing_prices,
    )
    log_plan(plan)
    if dry_run:
        log.info("DRY RUN — no rows written. Re-run without dry_run to persist.")
        db.rollback()
        return plan
    written = apply_plan(db, plan, write_price_bars=write_price_bars)
    log.info("Wrote %s portfolio snapshots", written)
    return plan
