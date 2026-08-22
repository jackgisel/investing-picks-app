"""Bulk price-bar loading for the momentum factor.

The backfill writes ~160k rows against a table that `refresh_marks` is also
writing to on its own schedule, so the properties that matter are: it never
overwrites a live mark, a collision does not destroy the batch, and re-running
is safe (that is the whole resumability story for a job that a redeploy can
kill mid-flight).
"""

from __future__ import annotations

from datetime import date, timedelta

from conftest import make_position

from app.db.models import PriceBar, Stock
from app.services.benchmarks import BENCHMARKS
from worker.services.ingest import INGEST_ETFS, backfill_price_history, bulk_insert_price_bars

TODAY = date.today()


def test_bulk_insert_writes_rows(db):
    rows = [
        {"ticker": "AAA", "date": TODAY - timedelta(days=i), "close": 10.0 + i}
        for i in range(1, 6)
    ]
    bulk_insert_price_bars(db, rows)

    assert db.query(PriceBar).filter(PriceBar.ticker == "AAA").count() == 5


def test_existing_bar_is_left_alone(db):
    """A live mark from refresh_marks must survive a later backfill."""
    day = TODAY - timedelta(days=1)
    db.add(PriceBar(ticker="AAA", date=day, close=99.0))
    db.commit()

    bulk_insert_price_bars(db, [{"ticker": "AAA", "date": day, "close": 1.0}])

    bar = db.query(PriceBar).filter(PriceBar.ticker == "AAA").one()
    assert bar.close == 99.0, "backfill clobbered an existing mark"


def test_conflicting_row_does_not_abort_the_batch(db):
    day = TODAY - timedelta(days=1)
    db.add(PriceBar(ticker="AAA", date=day, close=99.0))
    db.commit()

    rows = [
        {"ticker": "AAA", "date": day, "close": 1.0},  # conflicts
        {"ticker": "AAA", "date": TODAY - timedelta(days=2), "close": 2.0},
        {"ticker": "BBB", "date": TODAY - timedelta(days=2), "close": 3.0},
    ]
    bulk_insert_price_bars(db, rows)

    assert db.query(PriceBar).count() == 3, "one conflict lost the rest of the batch"


def test_rerunning_is_idempotent(db):
    rows = [
        {"ticker": "AAA", "date": TODAY - timedelta(days=i), "close": 10.0}
        for i in range(1, 4)
    ]
    bulk_insert_price_bars(db, rows)
    bulk_insert_price_bars(db, rows)

    assert db.query(PriceBar).count() == 3


def test_empty_input_is_a_noop(db):
    assert bulk_insert_price_bars(db, []) == 0


class _StubFMP:
    def __init__(self):
        self.asked: list[str] = []
        self.asked_from: dict[str, date] = {}

    def historical_prices(self, ticker, from_date=None):
        self.asked.append(ticker)
        self.asked_from[ticker] = from_date
        return [
            {"date": (TODAY - timedelta(days=i)).isoformat(), "close": 50.0 + i}
            for i in range(0, 10)  # includes TODAY, which must be filtered out
        ]


def _bars(ticker: str, *, count: int, newest_days_ago: int):
    """`count` daily bars ending `newest_days_ago` days before today."""
    return [
        PriceBar(ticker=ticker, date=TODAY - timedelta(days=newest_days_ago + i), close=5.0)
        for i in range(count)
    ]


def test_backfill_skips_today_and_well_covered_tickers(db, portfolio):
    db.add(Stock(ticker="THIN", market_cap=1e9, is_active=True))
    db.add(Stock(ticker="FULL", market_cap=2e9, is_active=True))
    for bar in _bars("FULL", count=29, newest_days_ago=1):
        db.add(bar)
    db.commit()

    fmp = _StubFMP()
    result = backfill_price_history(db, fmp, min_bars=20)

    assert "THIN" in fmp.asked
    assert "FULL" not in fmp.asked, "re-fetched a ticker that already had history"
    # Comparison ETFs have no Stock row and no bars here, so they are short
    # and must be fetched — that is the MAGS-gap fix.
    assert set(INGEST_ETFS).issubset(fmp.asked)
    assert result["tickers"] == 1 + len(INGEST_ETFS)

    # Today belongs to refresh_marks; the backfill must not write it.
    assert (
        db.query(PriceBar)
        .filter(PriceBar.ticker == "THIN", PriceBar.date == TODAY)
        .count()
        == 0
    )


def test_a_long_but_stale_series_is_topped_up(db, portfolio):
    """BUG-W2: bar count alone let a frozen series look covered forever.

    30 bars against min_bars=20 clears the old condition, but the newest is 40
    days old — while the `as_of - 365d` momentum anchor keeps moving.
    """
    db.add(Stock(ticker="STALE", market_cap=1e9, is_active=True))
    for bar in _bars("STALE", count=30, newest_days_ago=40):
        db.add(bar)
    db.commit()

    fmp = _StubFMP()
    result = backfill_price_history(db, fmp, min_bars=20, max_stale_days=5)

    assert "STALE" in fmp.asked, "a long-but-frozen series was never topped up"
    assert result["stale"] == 1 and result["short"] == len(INGEST_ETFS)


def test_a_stale_top_up_fetches_incrementally(db, portfolio):
    """A weekly top-up must not re-download the full lookback every run."""
    db.add(Stock(ticker="STALE", market_cap=1e9, is_active=True))
    for bar in _bars("STALE", count=30, newest_days_ago=40):
        db.add(bar)
    db.commit()

    fmp = _StubFMP()
    backfill_price_history(db, fmp, min_bars=20, max_stale_days=5, overlap_days=10)

    # Newest bar is 40 days back, so the fetch starts ~50 days back — not at the
    # 430-day lookback floor.
    assert fmp.asked_from["STALE"] == TODAY - timedelta(days=50)


def test_a_fresh_but_short_series_still_gets_full_history(db, portfolio):
    """The holdings case: refresh_marks keeps them fresh but only ~70 bars deep.

    Freshness must not be allowed to mask a series too short to carry a momentum
    anchor, and the top-up window would not reach one either.
    """
    db.add(Stock(ticker="SHORT", market_cap=1e9, is_active=True))
    for bar in _bars("SHORT", count=10, newest_days_ago=1):
        db.add(bar)
    db.commit()

    fmp = _StubFMP()
    result = backfill_price_history(db, fmp, min_bars=20, lookback_days=430)

    assert "SHORT" in fmp.asked, "a fresh but too-short series was skipped"
    assert fmp.asked_from["SHORT"] == TODAY - timedelta(days=430)
    assert result["short"] == 1 + len(INGEST_ETFS)


def test_a_held_ticker_outside_the_universe_is_still_covered(db, portfolio):
    """Positions are appended explicitly; the staleness check must reach them."""
    make_position(db, portfolio, "HELD", shares=10, avg_cost=10.0, current_price=12.0)
    for bar in _bars("HELD", count=30, newest_days_ago=40):
        db.add(bar)
    db.commit()

    fmp = _StubFMP()
    backfill_price_history(db, fmp, min_bars=20, max_stale_days=5)

    assert "HELD" in fmp.asked


def test_a_comparison_etf_without_a_stock_row_is_still_covered(db, portfolio):
    """MAGS is not in the scored universe; omitting it froze Mag 7 on the chart."""
    fmp = _StubFMP()
    backfill_price_history(db, fmp, min_bars=20, max_stale_days=5)

    assert "MAGS" in fmp.asked
    assert "QQQ" in fmp.asked
    assert "VTI" in fmp.asked
    assert "SPY" in fmp.asked
    assert "VOO" in fmp.asked


def test_backfill_fetches_benchmarks_before_the_universe_budget_runs_out(db, portfolio):
    """A newly added comparison ETF must not sit behind hundreds of stale names."""
    for i in range(8):
        db.add(Stock(ticker=f"U{i}", market_cap=1e9 + i, is_active=True))
    db.commit()

    fmp = _StubFMP()
    backfill_price_history(db, fmp, min_bars=20, max_tickers=len(INGEST_ETFS))

    assert set(fmp.asked) == set(INGEST_ETFS)
    assert all(not t.startswith("U") for t in fmp.asked)


def test_backfill_drops_a_non_positive_close(db, portfolio):
    class ZeroFMP:
        def historical_prices(self, ticker, from_date=None):
            day = (TODAY - timedelta(days=2)).isoformat()
            return [{"date": day, "close": 0, "adjClose": 0}]

    backfill_price_history(db, ZeroFMP(), min_bars=20)
    assert db.query(PriceBar).count() == 0
