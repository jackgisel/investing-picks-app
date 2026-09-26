"""Monthly returns and the per-pick scorecard behind the Performance page."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.db.models import PriceBar, Trade
from app.services.track_record import monthly_returns, pick_scorecard


def _bar(db, ticker, d, close):
    db.add(PriceBar(ticker=ticker, date=d, close=close))


def _buy(db, portfolio, ticker, when, notional, price):
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="buy",
            shares=notional / price,
            price=price,
            notional=notional,
            action="buy",
            timestamp=datetime(when.year, when.month, when.day, tzinfo=timezone.utc),
        )
    )


@pytest.fixture()
def book(db, portfolio):
    # One pick bought mid-April; +10% in April, +10% again in May.
    for d, aaa, spy in [
        (date(2026, 4, 15), 100.0, 100.0),
        (date(2026, 4, 30), 110.0, 102.0),
        (date(2026, 5, 29), 121.0, 104.04),
        (date(2026, 6, 5), 121.0, 104.04),
    ]:
        _bar(db, "AAA", d, aaa)
        _bar(db, "SPY", d, spy)
    _buy(db, portfolio, "AAA", date(2026, 4, 15), 1000.0, 100.0)
    db.commit()
    return portfolio


def test_each_month_is_its_own_return_not_a_slice_of_the_curve(db, book):
    months = monthly_returns(db, portfolio_id=book.id)
    assert [m["month"] for m in months] == ["2026-04", "2026-05", "2026-06"]

    april, may, june = months
    assert april["picks_pct"] == pytest.approx(10.0)
    assert april["spy_pct"] == pytest.approx(2.0)
    # Since-inception May would read +21%; the month itself is +10%.
    assert may["picks_pct"] == pytest.approx(10.0)
    assert may["spy_pct"] == pytest.approx(2.0)
    assert june["picks_pct"] == pytest.approx(0.0)


def test_first_and_latest_months_are_flagged_partial(db, book):
    months = monthly_returns(db, portfolio_id=book.id)
    assert [m["partial"] for m in months] == [True, False, True]


def test_no_trades_means_no_months(db, portfolio):
    assert monthly_returns(db, portfolio_id=portfolio.id) == []


def test_scorecard_measures_the_index_over_each_picks_own_holding(db, book):
    rows = pick_scorecard(
        db,
        [
            {
                "ticker": "AAA",
                "status": "active",
                "entry_date": "2026-04-15",
                "exit_date": None,
                "pnl_pct": 21.0,
            },
            {
                "ticker": "BBB",
                "status": "closed",
                "entry_date": "2026-04-30",
                "exit_date": "2026-05-29",
                "pnl_pct": -5.0,
            },
        ],
    )
    open_row, closed_row = rows
    assert open_row["spy_pct"] == pytest.approx(4.04)
    assert open_row["excess_pct"] == pytest.approx(16.96)
    assert closed_row["spy_pct"] == pytest.approx(2.0)
    assert closed_row["excess_pct"] == pytest.approx(-7.0)


def test_scorecard_leaves_unknowns_unknown(db, book):
    (row,) = pick_scorecard(
        db,
        [
            {
                "ticker": "CCC",
                "status": "active",
                "entry_date": None,
                "exit_date": None,
                "pnl_pct": None,
            }
        ],
    )
    assert row["spy_pct"] is None
    assert row["excess_pct"] is None
