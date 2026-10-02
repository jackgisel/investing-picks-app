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


def test_a_benchmark_that_cannot_price_the_first_pick_is_omitted(db, portfolio):
    """QQQ with only this week's marks printed -100% on the landing chart.

    Daily quotes landed, so len(closes) >= 2 passed, but every April cash flow
    was unmappable. units stayed 0 while deployed stayed the full book.
    """
    _buy(db, portfolio, "AAA", date(2026, 4, 10), 1000.0, 100.0)
    _buy(db, portfolio, "BBB", date(2026, 8, 21), 1000.0, 50.0)
    _bar(db, "AAA", date(2026, 4, 10), 100.0)
    _bar(db, "AAA", date(2026, 8, 21), 110.0)
    for d, px in (
        (date(2026, 8, 17), 0.01),
        (date(2026, 8, 18), 0.01),
        (date(2026, 8, 19), 0.01),
        (date(2026, 8, 20), 0.01),
        (date(2026, 8, 21), 550.0),
    ):
        _bar(db, "QQQ", d, px)
    db.commit()

    out = benchmark_series(db, portfolio.id, {"QQQ": "Nasdaq-100"})
    assert "QQQ" not in out["series"]
    assert "QQQ" not in out["labels"]


def test_a_benchmark_priced_from_the_first_pick_is_published(db, portfolio):
    """Control: the same book with QQQ history back to entry is a real series."""
    _buy(db, portfolio, "AAA", date(2026, 4, 10), 1000.0, 100.0)
    _bar(db, "AAA", date(2026, 4, 10), 100.0)
    _bar(db, "AAA", date(2026, 8, 21), 110.0)
    _bar(db, "QQQ", date(2026, 4, 10), 500.0)
    _bar(db, "QQQ", date(2026, 8, 21), 550.0)
    db.commit()

    out = benchmark_series(db, portfolio.id, {"QQQ": "Nasdaq-100"})
    assert out["series"]["QQQ"][-1]["return_pct"] == pytest.approx(10.0, abs=0.01)


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


def test_a_double_buy_is_its_own_lot_at_its_own_price(db, portfolio):
    """A conviction add is fresh capital on its own date.

    SEZL's September add was charted as a second April lot because the schedule
    read the position's summed `initial_investment` on its `entry_date`. Bought
    at $60 instead of $120, it doubled the name's weight for the whole history.
    """
    from app.db.models import Position

    d1, d2, d3 = date(2026, 4, 10), date(2026, 9, 4), date(2026, 10, 1)
    _buy(db, portfolio, "SEZL", d1, 1000.0, 60.0)
    _buy(db, portfolio, "SEZL", d2, 1000.0, 120.0, action="double_buy")
    db.add(
        Position(
            portfolio_id=portfolio.id,
            ticker="SEZL",
            shares=1000.0 / 60.0 + 1000.0 / 120.0,
            avg_cost=80.0,
            current_price=120.0,
            initial_investment=2000.0,
            entry_date=d1,
        )
    )
    for d, px in ((d1, 60.0), (d2, 120.0), (d3, 120.0)):
        _bar(db, "SEZL", d, px)
        _bar(db, "SPY", d, 100.0 if d == d1 else 110.0)
    db.commit()

    flows = deployment_schedule(db, portfolio.id)
    assert [(f.when, f.amount) for f in flows] == [(d1, 1000.0), (d2, 1000.0)]

    # First lot doubled, second flat: 3000 on 2000 deployed = +50%, not +100%.
    picks = {r["date"]: r["return_pct"] for r in picks_series(db, portfolio.id)}
    assert picks[d3.isoformat()] == pytest.approx(50.0, abs=0.01)

    # SPY: 10 units at 100 + 9.09 at 110, worth 2100 at 110 -> +5%, not +10%.
    spy = benchmark_series(db, portfolio.id, {"SPY": "S&P 500"})["series"]["SPY"]
    assert spy[-1]["return_pct"] == pytest.approx(5.0, abs=0.01)


def test_a_trim_sells_the_same_fraction_of_the_benchmark(db, portfolio):
    """Half the pick sold: the benchmark sells half its shadow too, and both
    sides hold the proceeds flat from then on."""
    from app.db.models import Position

    d1, d2, d3 = date(2026, 4, 10), date(2026, 6, 1), date(2026, 7, 1)
    _buy(db, portfolio, "AAA", d1, 1000.0, 100.0, action="buy")
    db.add(
        Trade(
            portfolio_id=portfolio.id, ticker="AAA", side="sell", shares=5.0,
            price=200.0, notional=1000.0, action="partial_sell",
            timestamp=datetime(2026, 6, 1, tzinfo=timezone.utc),
        )
    )
    db.add(
        Position(
            portfolio_id=portfolio.id, ticker="AAA", shares=5.0, avg_cost=100.0,
            current_price=200.0, initial_investment=1000.0, entry_date=d1,
        )
    )
    for d, aaa, spy in ((d1, 100.0, 100.0), (d2, 200.0, 110.0), (d3, 200.0, 130.0)):
        _bar(db, "AAA", d, aaa)
        _bar(db, "SPY", d, spy)
    db.commit()

    # Picks: $1,000 back in cash + 5 x 200 = 2,000 on 1,000 -> +100%.
    picks = {r["date"]: r["return_pct"] for r in picks_series(db, portfolio.id)}
    assert picks[d3.isoformat()] == pytest.approx(100.0, abs=0.01)

    # SPY: 10 units at 100. Half sold at 110 = 550 cash; the other 5 at 130 =
    # 650. 1,200 on 1,000 -> +20%. Never selling would have printed +30%.
    spy = benchmark_series(db, portfolio.id, {"SPY": "S&P 500"})["series"]["SPY"]
    assert spy[-1]["return_pct"] == pytest.approx(20.0, abs=0.01)


def test_the_growth_index_treats_new_money_as_a_flow(db, portfolio):
    """A flat new buy beside a winner is not a drawdown."""
    from app.services.benchmarks import picks_drawdown, picks_growth_index

    d1, d2, d3 = date(2026, 4, 10), date(2026, 6, 1), date(2026, 7, 1)
    _buy(db, portfolio, "AAA", d1, 1000.0, 100.0, action="buy")
    _buy(db, portfolio, "BBB", d2, 10000.0, 50.0, action="buy")
    for d, aaa in ((d1, 100.0), (d2, 150.0), (d3, 150.0)):
        _bar(db, "AAA", d, aaa)
        _bar(db, "SPY", d, 100.0)
    for d in (d2, d3):
        _bar(db, "BBB", d, 50.0)
    db.commit()

    rows = {r["date"]: r["index"] for r in picks_growth_index(db, portfolio.id)}
    assert rows[d2.isoformat()] == pytest.approx(1.5)
    assert rows[d3.isoformat()] == pytest.approx(1.5)
    assert picks_drawdown(db, portfolio.id)["drawdown_pct"] == 0.0

    # The money-weighted line falls from +50% to about +4.5% on the same day,
    # which is why it cannot drive a drawdown alert.
    picks = {r["date"]: r["return_pct"] for r in picks_series(db, portfolio.id)}
    assert picks[d3.isoformat()] < 5.0


def test_the_scorecard_index_leg_follows_every_lot(db, portfolio):
    from app.services.track_record import pick_scorecard

    d1, d2, d3 = date(2026, 4, 10), date(2026, 9, 4), date(2026, 10, 1)
    _buy(db, portfolio, "SEZL", d1, 1000.0, 60.0)
    _buy(db, portfolio, "SEZL", d2, 1000.0, 120.0, action="double_buy")
    for d, spy in ((d1, 100.0), (d2, 120.0), (d3, 120.0)):
        _bar(db, "SPY", d, spy)
    db.commit()

    rows = pick_scorecard(
        db,
        [
            {"ticker": "SEZL", "status": "active", "entry_date": d1.isoformat(), "pnl_pct": 50.0},
            {"ticker": "NEW", "status": "active", "entry_date": d3.isoformat(), "pnl_pct": 0.0},
        ],
    )
    sezl, new = rows
    # 10 SPY units in April + 8.33 in September, worth 2,200 on 2,000 -> +10%.
    # The April-only leg would have said +20%.
    assert sezl["spy_pct"] == pytest.approx(10.0, abs=0.01)
    assert sezl["measurable"] is True
    # Bought on the latest session: no holding period yet.
    assert new["measurable"] is False
