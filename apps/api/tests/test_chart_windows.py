"""Windowed chart ranges.

The failure this file exists to prevent is the obvious implementation: slicing
the cumulative since-inception series. A pick up 40% since April would open a
one-week chart at +40%, and the benchmark beside it would open at its own
accumulated gain — two lines starting at different heights, compared as though
they started together.

Every window is instead REBUILT: each pick open on the window's first day is
re-entered at what it was worth that day, and the benchmarks receive the same
dollars on the same dates.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.db.models import Position, PriceBar, Trade
from app.services.benchmarks import (
    exit_schedule,
    picks_series,
    benchmark_series,
    rebase_flows,
    deployment_schedule,
    shift_back,
    window_start,
)


def _bar(db, ticker, d, close):
    db.add(PriceBar(ticker=ticker, date=d, close=close))


def _buy(db, portfolio, ticker, when, notional, price, action="buy"):
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="buy",
            shares=notional / price,
            price=price,
            notional=notional,
            action=action,
            timestamp=datetime(when.year, when.month, when.day, tzinfo=timezone.utc),
        )
    )


def _sell(db, portfolio, ticker, when, notional, price):
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="sell",
            shares=notional / price,
            price=price,
            notional=notional,
            action="sell",
            timestamp=datetime(when.year, when.month, when.day, tzinfo=timezone.utc),
        )
    )


class TestShiftBack:
    def test_days_window(self):
        assert shift_back(date(2026, 8, 21), 0, 7) == date(2026, 8, 14)

    def test_month_window(self):
        assert shift_back(date(2026, 8, 21), 1, 0) == date(2026, 7, 21)

    def test_year_window_crosses_the_year_boundary(self):
        assert shift_back(date(2026, 2, 3), 12, 0) == date(2025, 2, 3)
        assert shift_back(date(2026, 2, 3), 6, 0) == date(2025, 8, 3)

    def test_month_end_clamps_rather_than_rolling_over(self):
        # One month before March 31st is the last day of February, not March
        # 3rd. Rolling over lands in the WRONG MONTH, so the window silently
        # measures something other than what the control says.
        assert shift_back(date(2026, 3, 31), 1, 0) == date(2026, 2, 28)
        assert shift_back(date(2026, 7, 31), 1, 0) == date(2026, 6, 30)


@pytest.fixture()
def book(db, portfolio):
    """AAA doubles over four months; the window opens halfway up."""
    days = [date(2026, 4, 1), date(2026, 6, 1), date(2026, 7, 1), date(2026, 8, 1)]
    for d, px in zip(days, [100.0, 150.0, 180.0, 200.0]):
        _bar(db, "AAA", d, px)
        # SPY rises 10% over the same span, all of it after June.
        _bar(db, "SPY", d, {100.0: 100.0, 150.0: 100.0, 180.0: 105.0, 200.0: 110.0}[px])

    _buy(db, portfolio, "AAA", days[0], 1000.0, 100.0)
    db.add(
        Position(
            portfolio_id=1, ticker="AAA", shares=10, avg_cost=100.0,
            current_price=200.0, entry_date=days[0], initial_investment=1000.0,
        )
    )
    db.commit()
    return portfolio


def test_since_inception_series_is_unchanged(db, book):
    rows = picks_series(db)
    assert rows[0] == {"date": "2026-04-01", "return_pct": 0.0}
    # Final point is anchored to the live headline, as before.
    assert rows[-1]["return_pct"] == 100.0


def test_window_reopens_every_line_at_zero(db, book):
    start = date(2026, 6, 1)
    rows = picks_series(db, start=start)

    # NOT +50%: the pick is re-entered on June 1 at its June 1 value. A sliced
    # series would open here at the gain it had already made.
    assert rows[0] == {"date": "2026-06-01", "return_pct": 0.0}
    # 150 -> 200 is +33.33% over the window, not +100% since inception.
    assert rows[-1]["return_pct"] == 33.33

    bench = benchmark_series(db, start=start)["series"]["SPY"]
    assert bench[0]["return_pct"] == 0.0
    # SPY 100 -> 110 over the same window.
    assert bench[-1]["return_pct"] == 10.0


def test_window_drops_sessions_before_it_opens(db, book):
    rows = picks_series(db, start=date(2026, 7, 1))
    assert [r["date"] for r in rows] == ["2026-07-01", "2026-08-01"]


def test_a_pick_bought_inside_the_window_keeps_its_real_flow(db, portfolio):
    for d, px in [(date(2026, 6, 1), 100.0), (date(2026, 7, 1), 100.0), (date(2026, 8, 1), 120.0)]:
        _bar(db, "NEW", d, px)
        _bar(db, "SPY", d, 100.0)
    _buy(db, portfolio, "NEW", date(2026, 7, 1), 1000.0, 100.0)
    db.add(
        Position(
            portfolio_id=1, ticker="NEW", shares=10, avg_cost=100.0,
            current_price=120.0, entry_date=date(2026, 7, 1),
            initial_investment=1000.0,
        )
    )
    db.commit()

    flows = rebase_flows(
        db, deployment_schedule(db), exit_schedule(db), date(2026, 6, 1)
    )
    # Entered after the window opened, so it is NOT repriced — its own entry is
    # already inside the window.
    assert [(f.ticker, f.when, f.amount) for f in flows] == [
        ("NEW", date(2026, 7, 1), 1000.0)
    ]


class TestClosedPicks:
    """A window must include picks closed inside it and exclude ones closed
    before it — the first is the difference between a track record and
    survivorship bias, the second is money the window never put at risk."""

    @pytest.fixture()
    def sold(self, db, portfolio):
        for d, px in [
            (date(2026, 4, 1), 100.0),
            (date(2026, 6, 1), 150.0),
            (date(2026, 7, 1), 180.0),
            (date(2026, 8, 1), 400.0),
        ]:
            _bar(db, "OUT", d, px)
            _bar(db, "SPY", d, 100.0)
        _buy(db, portfolio, "OUT", date(2026, 4, 1), 1000.0, 100.0)
        # Sold on July 1 for $1,800 — the price then kept running to $4,000,
        # which the book did NOT capture.
        _sell(db, portfolio, "OUT", date(2026, 7, 1), 1800.0, 180.0)
        db.commit()
        return portfolio

    def test_exit_is_recorded(self, db, sold):
        gone = exit_schedule(db)["OUT"]
        assert (gone.when, gone.proceeds) == (date(2026, 7, 1), 1800.0)

    def test_a_pick_closed_inside_the_window_freezes_at_its_proceeds(self, db, sold):
        rows = {r["date"]: r["return_pct"] for r in picks_series(db, start=date(2026, 6, 1))}
        # Re-entered June 1 at $1,500, sold July 1 for $1,800: +20%.
        assert rows["2026-07-01"] == 20.0
        # August still reads +20%. The stock more than doubled after the exit;
        # marking the position live would credit the window with a run the book
        # was no longer in.
        assert rows["2026-08-01"] == 20.0

    def test_a_pick_closed_before_the_window_is_excluded(self, db, sold):
        # Nothing was held during July–August, so there is no window to plot.
        assert picks_series(db, start=date(2026, 7, 15)) == []


def test_window_start_is_anchored_on_the_last_session_not_today(db, portfolio):
    # Bars stop on a Friday. A window anchored on `date.today()` would slide
    # forward over the weekend and shorten every range.
    for d in [date(2026, 8, 7), date(2026, 8, 14), date(2026, 8, 21)]:
        _bar(db, "SPY", d, 100.0)
    # A flow well before every window, so none of them normalise to the full
    # history — that behaviour has its own test.
    _buy(db, portfolio, "AAA", date(2026, 1, 5), 1000.0, 100.0)
    db.commit()
    assert window_start(db, "1w") == date(2026, 8, 14)
    assert window_start(db, "1m") == date(2026, 7, 21)
    assert window_start(db, None) is None
    assert window_start(db, "garbage") is None


def test_a_window_older_than_the_book_is_the_full_history(db, book):
    """Not a truncated window, and not a second answer to the same question.

    "1 year" on a five-month-old book covers exactly what since-inception
    covers. Treating it as a genuine window would skip the final-point anchor
    that keeps the curve agreeing with the published headline, so the same data
    would print two slightly different returns depending on which button was
    pressed.
    """
    assert window_start(db, "1y") is None
    assert picks_series(db, start=window_start(db, "1y")) == picks_series(db)
