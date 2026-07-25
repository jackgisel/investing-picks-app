"""Equity-curve backfill regressions.

The thing under test is a *published performance claim*, so most of these
assertions are about what the reconstruction must refuse to do: value a
position before it was bought, invent equity out of nowhere, or emit a
plausible-looking curve when the price data behind it is missing.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import PortfolioSnapshot, PriceBar, Trade
from worker.services.backfill import (
    BackfillError,
    Lot,
    backfill_snapshots,
    build_plan,
    cash_on,
    _parse_series,
)

from conftest import make_position


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


def _sessions(start: date, days: int) -> list[date]:
    """Weekday-only calendar, standing in for real market sessions."""
    out: list[date] = []
    day = start
    while len(out) < days:
        if day.weekday() < 5:
            out.append(day)
        day += timedelta(days=1)
    return out


class FakeFMP:
    """Returns `/stable`-shaped rows: a bare list, symbol as a query param."""

    def __init__(self, series: dict[str, dict[date, float]]):
        self.series = series
        self.requested: list[tuple[str, date | None]] = []

    def historical_prices(self, ticker, from_date=None):
        self.requested.append((ticker, from_date))
        rows = self.series.get(ticker)
        if rows is None:
            return []
        return [
            {"symbol": ticker, "date": d.isoformat(), "close": px}
            for d, px in sorted(rows.items())
            if from_date is None or d >= from_date
        ]


def flat(dates: list[date], price: float) -> dict[date, float]:
    return {d: price for d in dates}


def ramp(dates: list[date], start_price: float, step: float) -> dict[date, float]:
    return {d: start_price + step * i for i, d in enumerate(dates)}


# ---------------------------------------------------------------------------
# Entry-date boundary: the whole point of the exercise
# ---------------------------------------------------------------------------


def test_position_contributes_zero_before_its_entry_date(db, portfolio):
    """A pick bought halfway through must not appear in the first half.

    Back-dating a position into a period it was not held fabricates a track
    record. This is the assertion that exists to catch that.
    """
    days = _sessions(date(2026, 4, 1), 10)
    entry = days[5]
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0  # 100k seed less the 10k spent on AAA
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=140.0, entry_date=entry)

    fmp = FakeFMP({
        "AAA": ramp(days, 100.0, 10.0),
        "SPY": flat(days, 500.0),
    })
    plan = build_plan(db, fmp, portfolio, end=days[-1])
    rows = {r["date"]: r for r in plan.rows}

    for day in days[:5]:
        assert rows[day]["invested_value"] == 0.0, f"AAA valued on {day}, before entry"
        assert rows[day]["position_count"] == 0
        # The capital was uninvested, not absent.
        assert rows[day]["cash"] == pytest.approx(100_000.0)
        assert rows[day]["total_value"] == pytest.approx(100_000.0)

    for day in days[5:]:
        assert rows[day]["position_count"] == 1
        assert rows[day]["cash"] == pytest.approx(90_000.0)


def test_equity_is_continuous_across_the_entry(db, portfolio):
    """No jump on entry day beyond the position's own fill-to-close move."""
    days = _sessions(date(2026, 4, 1), 6)
    entry = days[3]
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=entry)

    # Closes exactly at the fill price, so the entry day must be a no-op.
    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    plan = build_plan(db, fmp, portfolio, end=days[-1])
    totals = [r["total_value"] for r in plan.rows]

    assert totals == pytest.approx([100_000.0] * len(days))


def test_entry_day_pnl_is_measured_fill_to_close(db, portfolio):
    days = _sessions(date(2026, 4, 1), 4)
    entry = days[2]
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=110.0, entry_date=entry)

    # Filled at 100, closed at 110 the same day: +1,000 on the book.
    prices = {days[0]: 95.0, days[1]: 98.0, days[2]: 110.0, days[3]: 120.0}
    fmp = FakeFMP({"AAA": prices, "SPY": flat(days, 500.0)})
    rows = {r["date"]: r for r in build_plan(db, fmp, portfolio, end=days[-1]).rows}

    assert rows[days[1]]["total_value"] == pytest.approx(100_000.0)
    assert rows[days[2]]["total_value"] == pytest.approx(101_000.0)
    assert rows[days[3]]["total_value"] == pytest.approx(102_000.0)


def test_positions_entered_on_different_days_stack_correctly(db, portfolio):
    days = _sessions(date(2026, 4, 1), 8)
    portfolio.inception_date = days[0]
    portfolio.cash = 80_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[2])
    make_position(db, portfolio, "BBB", shares=50.0, avg_cost=200.0,
                  current_price=200.0, entry_date=days[5])

    fmp = FakeFMP({
        "AAA": flat(days, 100.0),
        "BBB": flat(days, 200.0),
        "SPY": flat(days, 500.0),
    })
    rows = {r["date"]: r for r in build_plan(db, fmp, portfolio, end=days[-1]).rows}

    assert rows[days[1]]["position_count"] == 0
    assert rows[days[1]]["cash"] == pytest.approx(100_000.0)
    assert rows[days[3]]["position_count"] == 1
    assert rows[days[3]]["cash"] == pytest.approx(90_000.0)
    assert rows[days[6]]["position_count"] == 2
    assert rows[days[6]]["cash"] == pytest.approx(80_000.0)
    # Flat prices, so equity never moves regardless of when capital was deployed.
    assert all(r["total_value"] == pytest.approx(100_000.0) for r in rows.values())


def test_cash_walk_back_restores_costs_and_removes_proceeds():
    lots = [
        Lot("AAA", 100.0, 10_000.0, date(2026, 5, 1)),
        Lot("BBB", 50.0, 5_000.0, date(2026, 4, 10), date(2026, 6, 1), 8_000.0),
    ]
    # Before either event: both costs still uninvested, neither proceed received.
    assert cash_on(lots, date(2026, 4, 1), 93_000.0) == pytest.approx(100_000.0)
    # BBB open, AAA not yet.
    assert cash_on(lots, date(2026, 4, 20), 93_000.0) == pytest.approx(95_000.0)
    # Both open, nothing sold.
    assert cash_on(lots, date(2026, 5, 15), 93_000.0) == pytest.approx(85_000.0)
    # BBB sold: proceeds are in cash.
    assert cash_on(lots, date(2026, 6, 15), 93_000.0) == pytest.approx(93_000.0)


# ---------------------------------------------------------------------------
# Trading calendar
# ---------------------------------------------------------------------------


def test_weekends_and_holidays_are_skipped_not_forward_filled(db, portfolio):
    """Sessions come from the benchmark's own bars, so gaps stay gaps."""
    days = _sessions(date(2026, 4, 1), 10)  # Wed 1 Apr onward, weekdays only
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0])

    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    plan = build_plan(db, fmp, portfolio, end=days[-1])

    assert [r["date"] for r in plan.rows] == days
    assert all(r["date"].weekday() < 5 for r in plan.rows)
    # 10 sessions spans two calendar weeks, so the naive count would be 14.
    assert len(plan.rows) == 10


def test_a_ticker_missing_a_session_is_filled_from_its_last_close(db, portfolio):
    days = _sessions(date(2026, 4, 1), 5)
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0])

    prices = flat(days, 100.0)
    del prices[days[2]]  # halted for a day
    fmp = FakeFMP({"AAA": prices, "SPY": flat(days, 500.0)})
    plan = build_plan(db, fmp, portfolio, end=days[-1])

    assert len(plan.rows) == 5
    assert all(r["invested_value"] == pytest.approx(10_000.0) for r in plan.rows)


def test_benchmark_series_is_carried_into_the_snapshots(db, portfolio):
    days = _sessions(date(2026, 4, 1), 4)
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0])

    spy = ramp(days, 500.0, 5.0)
    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": spy})
    plan = build_plan(db, fmp, portfolio, end=days[-1])

    assert [r["spy_value"] for r in plan.rows] == [500.0, 505.0, 510.0, 515.0]


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------


def _simple_book(db, portfolio, n=6):
    days = _sessions(date(2026, 4, 1), n)
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0])
    return days


def test_backfill_is_idempotent_across_reruns(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})

    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)
    first = db.query(PortfolioSnapshot).count()

    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)
    assert db.query(PortfolioSnapshot).count() == first == len(days)


def test_rerun_updates_an_existing_row_in_place(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)

    # Corrected prices arrive on a later run.
    fmp = FakeFMP({"AAA": flat(days, 120.0), "SPY": flat(days, 550.0)})
    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)

    rows = db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.date).all()
    assert len(rows) == len(days)
    assert rows[-1].invested_value == pytest.approx(12_000.0)
    assert rows[-1].total_value == pytest.approx(102_000.0)
    assert rows[-1].spy_value == pytest.approx(550.0)


def test_backfill_overwrites_a_snapshot_written_by_refresh_marks(db, portfolio):
    """refresh_marks already wrote today's row; the backfill must not collide."""
    days = _simple_book(db, portfolio)
    db.add(
        PortfolioSnapshot(
            portfolio_id=portfolio.id, date=days[-1], cash=1.0,
            invested_value=2.0, total_value=3.0, position_count=99,
        )
    )
    db.commit()

    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)

    rows = db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.date).all()
    assert len(rows) == len(days)
    assert rows[-1].position_count == 1
    assert rows[-1].total_value == pytest.approx(100_000.0)


def test_dry_run_writes_nothing(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})

    plan = backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=True)

    assert len(plan.rows) == len(days)  # it computed the whole curve...
    assert db.query(PortfolioSnapshot).count() == 0  # ...and persisted none of it
    assert db.query(PriceBar).count() == 0


def test_backfill_also_upserts_the_price_bars_it_fetched(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)

    assert db.query(PriceBar).filter(PriceBar.ticker == "AAA").count() == len(days)
    backfill_snapshots(db, fmp, portfolio, end=days[-1], dry_run=False)
    assert db.query(PriceBar).filter(PriceBar.ticker == "AAA").count() == len(days)


# ---------------------------------------------------------------------------
# Refusals — the reconstruction must fail loudly rather than fabricate
# ---------------------------------------------------------------------------


def test_missing_price_history_aborts_instead_of_holding_flat_at_cost(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"SPY": flat(days, 500.0)})  # no AAA

    with pytest.raises(BackfillError, match="No price history for AAA"):
        build_plan(db, fmp, portfolio, end=days[-1])

    assert db.query(PortfolioSnapshot).count() == 0


def test_missing_prices_can_be_accepted_explicitly(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"SPY": flat(days, 500.0)})

    plan = build_plan(db, fmp, portfolio, end=days[-1], allow_missing_prices=True)

    assert all(r["invested_value"] == pytest.approx(10_000.0) for r in plan.rows)
    assert any("No price history for AAA" in w for w in plan.warnings)


def test_no_benchmark_history_aborts(db, portfolio):
    days = _simple_book(db, portfolio)
    fmp = FakeFMP({"AAA": flat(days, 100.0)})

    with pytest.raises(BackfillError, match="No SPY history"):
        build_plan(db, fmp, portfolio, end=days[-1])


def test_no_inception_and_no_entry_dates_aborts(db, portfolio):
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0)
    fmp = FakeFMP({"AAA": {}, "SPY": {}})

    with pytest.raises(BackfillError, match="No inception date"):
        build_plan(db, fmp, portfolio)


def test_empty_book_aborts(db, portfolio):
    portfolio.inception_date = date(2026, 4, 1)
    db.commit()
    with pytest.raises(BackfillError, match="No positions or trades"):
        build_plan(db, FakeFMP({}), portfolio)


# ---------------------------------------------------------------------------
# Closed picks and admin corrections
# ---------------------------------------------------------------------------


def _trade(db, portfolio, ticker, side, shares, price, when, action=None):
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side=side,
            shares=shares,
            price=price,
            notional=shares * price,
            action=action,
            timestamp=datetime(when.year, when.month, when.day, 15, tzinfo=timezone.utc),
        )
    )
    db.commit()


def test_a_closed_pick_is_held_between_its_buy_and_sell(db, portfolio):
    days = _sessions(date(2026, 4, 1), 10)
    portfolio.inception_date = days[0]
    portfolio.cash = 102_000.0  # 100k, plus 2k realized on the round trip
    db.commit()
    _trade(db, portfolio, "OLD", "buy", 100.0, 100.0, days[2])
    _trade(db, portfolio, "OLD", "sell", 100.0, 120.0, days[7])

    fmp = FakeFMP({"OLD": flat(days, 100.0), "SPY": flat(days, 500.0)})
    rows = {r["date"]: r for r in build_plan(db, fmp, portfolio, end=days[-1]).rows}

    assert rows[days[1]]["position_count"] == 0
    assert rows[days[1]]["cash"] == pytest.approx(100_000.0)
    assert rows[days[4]]["position_count"] == 1
    assert rows[days[4]]["cash"] == pytest.approx(90_000.0)
    # Sold on days[7]; from that session on it is cash, including the gain.
    assert rows[days[7]]["position_count"] == 0
    assert rows[days[7]]["cash"] == pytest.approx(102_000.0)


def test_manual_buy_trade_does_not_double_count_an_open_position(db, portfolio):
    """The admin editor writes a Position AND a manual_buy Trade."""
    days = _sessions(date(2026, 4, 1), 5)
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0])
    _trade(db, portfolio, "AAA", "buy", 100.0, 100.0, days[0], action="manual_buy")

    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    plan = build_plan(db, fmp, portfolio, end=days[-1])

    assert len(plan.lots) == 1
    assert all(r["invested_value"] == pytest.approx(10_000.0) for r in plan.rows)


def test_manual_remove_is_a_correction_not_a_pick(db, portfolio):
    """A mistyped entry that was deleted never belonged in the track record."""
    days = _sessions(date(2026, 4, 1), 6)
    portfolio.inception_date = days[0]
    portfolio.cash = 90_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0])
    _trade(db, portfolio, "OOPS", "buy", 10.0, 50.0, days[1], action="manual_buy")
    _trade(db, portfolio, "OOPS", "sell", 10.0, 50.0, days[2], action="manual_remove")

    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    plan = build_plan(db, fmp, portfolio, end=days[-1])

    assert [lot.ticker for lot in plan.lots] == ["AAA"]
    assert any("OOPS" in w and "correction" in w for w in plan.warnings)


def test_partial_sell_on_an_open_position_is_warned_about(db, portfolio):
    days = _sessions(date(2026, 4, 1), 6)
    portfolio.inception_date = days[0]
    portfolio.cash = 95_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=50.0, avg_cost=100.0,
                  current_price=100.0, entry_date=days[0], is_house_money=True)
    _trade(db, portfolio, "AAA", "buy", 100.0, 100.0, days[0], action="manual_buy")
    _trade(db, portfolio, "AAA", "sell", 50.0, 100.0, days[3])

    fmp = FakeFMP({"AAA": flat(days, 100.0), "SPY": flat(days, 500.0)})
    plan = build_plan(db, fmp, portfolio, end=days[-1])

    assert len(plan.lots) == 1  # not double counted
    assert any("partial sell" in w for w in plan.warnings)


# ---------------------------------------------------------------------------
# FMP response shape
# ---------------------------------------------------------------------------


def test_parses_the_bare_stable_list_shape():
    series = _parse_series("AAA", [
        {"symbol": "AAA", "date": "2026-04-02", "close": 101.5},
        {"symbol": "AAA", "date": "2026-04-01", "close": 100.0},
    ])
    assert series.at(date(2026, 4, 1)) == 100.0
    assert series.at(date(2026, 4, 2)) == 101.5
    # Before the series starts there is no price — callers must not guess one.
    assert series.at(date(2026, 3, 31)) is None
    # A non-trading day resolves to the prior close.
    assert series.at(date(2026, 4, 5)) == 101.5


def test_malformed_and_non_positive_rows_are_dropped():
    series = _parse_series("AAA", [
        {"date": "2026-04-01", "close": 100.0},
        {"date": "not-a-date", "close": 1.0},
        {"date": "2026-04-02"},
        {"date": "2026-04-03", "close": 0},
        {"date": "2026-04-06", "close": None, "adjClose": 105.0},
    ])
    assert series.dates == [date(2026, 4, 1), date(2026, 4, 6)]
