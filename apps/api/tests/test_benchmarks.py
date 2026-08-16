"""Money-weighted benchmark comparison.

The point of this module is that comparing a mostly-cash book against a fully
invested index is not a like-for-like comparison. These tests pin the property
that actually matters: the benchmark receives the SAME dollars on the SAME
dates as the picks.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.db.models import PriceBar, Trade
from app.services.benchmarks import (
    BENCHMARKS,
    benchmark_series,
    deployment_schedule,
    picks_series,
)


def _bar(db, ticker, d, close):
    db.add(PriceBar(ticker=ticker, date=d, close=close))


def _buy(db, portfolio, ticker, when, notional, price, action="manual_buy"):
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


@pytest.fixture()
def book(db, portfolio):
    """One pick entered late, so inception-indexing and cash-flow-indexing differ."""
    d1, d2 = date(2026, 4, 10), date(2026, 6, 1)
    _buy(db, portfolio, "AAA", d1, 1000.0, 100.0)
    _buy(db, portfolio, "BBB", d2, 1000.0, 50.0)

    # AAA doubles over the window; BBB is flat.
    for d, px in ((d1, 100.0), (date(2026, 5, 1), 150.0), (d2, 180.0), (date(2026, 7, 1), 200.0)):
        _bar(db, "AAA", d, px)
    for d, px in ((d2, 50.0), (date(2026, 7, 1), 50.0)):
        _bar(db, "BBB", d, px)

    # SPY rises 10% over the whole window, but only 2% after BBB's entry.
    for d, px in (
        (d1, 100.0),
        (date(2026, 5, 1), 104.0),
        (d2, 108.0),
        (date(2026, 7, 1), 110.0),
    ):
        _bar(db, "SPY", d, px)
    db.commit()
    return portfolio


def test_deployment_schedule_reads_buy_trades(book, db):
    flows = deployment_schedule(db, book.id)
    assert [(f.ticker, f.amount) for f in flows] == [("AAA", 1000.0), ("BBB", 1000.0)]


def test_benchmark_receives_the_same_dollars_on_the_same_dates(book, db):
    """The core property. BBB's $1,000 buys SPY at 108, not at 100."""
    out = benchmark_series(db, book.id, {"SPY": "S&P 500"})
    final = out["series"]["SPY"][-1]

    # 1000/100 = 10 units, plus 1000/108 = 9.259 units; at 110 that is
    # 1100.00 + 1018.52 = 2118.52 on 2000 deployed -> +5.93%.
    assert final["return_pct"] == pytest.approx(5.93, abs=0.01)

    # Indexing everything from inception instead would credit SPY the full
    # 10% on both lots, which is the comparison this module exists to avoid.
    assert final["return_pct"] < 10.0


def test_benchmark_denominator_grows_as_capital_is_committed(book, db):
    """Before BBB's entry only AAA's $1,000 is deployed."""
    rows = {r["date"]: r["return_pct"] for r in benchmark_series(db, book.id, {"SPY": "S&P 500"})["series"]["SPY"]}
    # 2026-05-01: only AAA deployed, SPY 100 -> 104 = +4%.
    assert rows["2026-05-01"] == pytest.approx(4.0, abs=0.01)


def test_picks_and_benchmark_share_a_denominator(book, db):
    """Both lines must measure return on the same deployed capital."""
    picks = {r["date"]: r["return_pct"] for r in picks_series(db, book.id)}
    bench = {
        r["date"]: r["return_pct"]
        for r in benchmark_series(db, book.id, {"SPY": "S&P 500"})["series"]["SPY"]
    }
    # On 2026-05-01 only AAA is live: picks +50%, SPY +4%.
    assert picks["2026-05-01"] == pytest.approx(50.0, abs=0.01)
    assert bench["2026-05-01"] == pytest.approx(4.0, abs=0.01)
    assert set(bench).issubset(set(picks) | {"2026-05-01"})


def test_a_benchmark_with_no_history_is_omitted_not_drawn_flat(book, db):
    out = benchmark_series(db, book.id, {"SPY": "S&P 500", "NOPE": "Missing"})
    assert "SPY" in out["series"]
    assert "NOPE" not in out["series"]
    assert "NOPE" not in out["labels"]


def test_entry_on_a_day_the_benchmark_has_no_bar_uses_the_prior_session(db, portfolio):
    _buy(db, portfolio, "AAA", date(2026, 6, 19), 1000.0, 10.0)  # Juneteenth
    _bar(db, "AAA", date(2026, 6, 18), 10.0)
    _bar(db, "AAA", date(2026, 7, 1), 20.0)
    _bar(db, "SPY", date(2026, 6, 18), 100.0)
    _bar(db, "SPY", date(2026, 7, 1), 110.0)
    db.commit()

    out = benchmark_series(db, portfolio.id, {"SPY": "S&P 500"})
    # The holiday entry still maps onto SPY's prior session, giving +10%.
    assert out["series"]["SPY"][-1]["return_pct"] == pytest.approx(10.0, abs=0.01)


def test_manual_removals_are_excluded_from_the_comparison(book, db):
    """An admin correction is not capital committed to a pick."""
    _buy(db, book, "OOPS", date(2026, 5, 1), 5000.0, 10.0)
    db.add(
        Trade(
            portfolio_id=book.id,
            ticker="OOPS",
            side="sell",
            shares=500.0,
            price=10.0,
            notional=5000.0,
            action="manual_remove",
            timestamp=datetime(2026, 5, 2, tzinfo=timezone.utc),
        )
    )
    db.commit()

    flows = deployment_schedule(db, book.id)
    assert "OOPS" not in {f.ticker for f in flows}
    assert benchmark_series(db, book.id, {"SPY": "S&P 500"})["deployed"] == 2000.0


def test_empty_book_returns_no_series(db, portfolio):
    out = benchmark_series(db, portfolio.id, {"SPY": "S&P 500"})
    assert out["series"] == {}
    assert picks_series(db, portfolio.id) == []


def test_published_benchmarks_include_nasdaq():
    """The landing chart's ticker list lives in one dict; QQQ is not optional."""
    assert BENCHMARKS["QQQ"] == "Nasdaq-100"
    assert list(BENCHMARKS)[:2] == ["SPY", "QQQ"]


def test_entry_date_beats_trade_timestamp(db, portfolio):
    """The bug that collapsed the chart to a single point.

    Manual entry writes its audit Trade with the server default now(), so a
    hand-entered historical book had every buy stamped with the day it was
    typed in. Reading that would date all capital to today.
    """
    from app.db.models import Position

    entered = date(2026, 4, 10)
    typed_in = datetime(2026, 7, 25, tzinfo=timezone.utc)

    db.add(
        Position(
            portfolio_id=portfolio.id,
            ticker="AAA",
            shares=10.0,
            avg_cost=100.0,
            current_price=200.0,
            entry_date=entered,
            initial_investment=1000.0,
        )
    )
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="AAA",
            side="buy",
            shares=10.0,
            price=100.0,
            notional=1000.0,
            action="manual_buy",
            timestamp=typed_in,
        )
    )
    db.commit()

    flows = deployment_schedule(db, portfolio.id)
    assert len(flows) == 1
    assert flows[0].when == entered, "must use the position's entry date"


def test_closed_picks_still_come_from_trades(db, portfolio):
    """A sold pick has no position row, so its buy trade supplies the date."""
    _buy(db, portfolio, "GONE", date(2026, 5, 1), 1000.0, 10.0)
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="GONE",
            side="sell",
            shares=100.0,
            price=15.0,
            notional=1500.0,
            action="full_sell",
            timestamp=datetime(2026, 6, 1, tzinfo=timezone.utc),
        )
    )
    db.commit()

    flows = deployment_schedule(db, portfolio.id)
    assert [(f.ticker, f.when) for f in flows] == [("GONE", date(2026, 5, 1))]
