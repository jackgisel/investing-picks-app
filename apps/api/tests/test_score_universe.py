"""score_universe behaviour under the factor-coverage floor.

Covers the three ways the floor could go wrong in production: a stale row
outliving the run that disowned it, a short price history masquerading as a
12-month return, and an ancient fundamentals snapshot being ranked against
fresh peers.
"""

from __future__ import annotations

from datetime import date, timedelta

from app.db.models import CompositeScore, Fundamentals, PriceBar, Stock
from worker.services.scoring import (
    FUNDAMENTALS_MAX_AGE_DAYS,
    load_price_history,
    _momentum_12m,
    score_universe,
)

TODAY = date.today()


def _stock(db, ticker, sector="Technology", cap=5e9):
    db.add(Stock(ticker=ticker, sector=sector, market_cap=cap, is_active=True, is_etf=False))


def _fundamentals(db, ticker, as_of=None, **data):
    db.add(Fundamentals(ticker=ticker, as_of=as_of or TODAY, data=data))


def _bars(db, ticker, days_back, start_price=100.0, step=0.1):
    """A daily series ending today, `days_back` calendar days long."""
    for i in range(days_back):
        d = TODAY - timedelta(days=i)
        db.add(PriceBar(ticker=ticker, date=d, close=start_price + (days_back - i) * step))


def test_unscoreable_ticker_has_its_stale_row_removed(db):
    """A row from an earlier run must not survive as 'current'."""
    _stock(db, "AAA")
    # Only profitability data -> coverage below the Run 118 floor.
    _fundamentals(db, "AAA", netProfitMarginTTM=0.2)
    db.add(
        CompositeScore(
            ticker="AAA",
            as_of=TODAY,
            quant_rating=4.9,
            composite=97.0,
            valuation_grade="A",
            growth_grade="A",
            profitability_grade="A",
            momentum_grade="A",
            revisions_grade="A",
            sector="Technology",
        )
    )
    db.commit()

    written = score_universe(db)

    assert written == 0
    remaining = db.query(CompositeScore).filter(CompositeScore.ticker == "AAA").count()
    assert remaining == 0, "stale score survived the run that disowned it"


def test_fundamentals_older_than_the_max_age_are_ignored(db):
    _stock(db, "OLD")
    _fundamentals(
        db,
        "OLD",
        as_of=TODAY - timedelta(days=FUNDAMENTALS_MAX_AGE_DAYS + 1),
        netProfitMarginTTM=0.5,
    )
    db.commit()

    assert score_universe(db) == 0


def test_momentum_requires_a_real_twelve_month_anchor(db):
    """Six months of history must not be reported as a 12-month return."""
    _bars(db, "SHORT", days_back=180)
    _bars(db, "LONG", days_back=420)
    db.commit()

    history = load_price_history(db, ["SHORT", "LONG"], TODAY)

    assert _momentum_12m(history, "SHORT", TODAY) is None
    assert _momentum_12m(history, "LONG", TODAY) is not None


def test_momentum_is_none_for_unknown_ticker(db):
    assert _momentum_12m({}, "NOPE", TODAY) is None


def test_load_price_history_is_one_query_for_many_tickers(db):
    _bars(db, "AAA", days_back=10)
    _bars(db, "BBB", days_back=10)
    db.commit()

    history = load_price_history(db, ["AAA", "BBB"], TODAY)

    assert set(history) == {"AAA", "BBB"}
    # Newest first — _momentum_12m relies on bars[0] being the latest close.
    assert history["AAA"][0][0] > history["AAA"][-1][0]
