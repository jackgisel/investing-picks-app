"""Sector on /api/v1/strategy holdings.

The live book was seeded by hand, so every Position row has sector NULL and
the dashboard rendered all eight holdings as "Unclassified" — including the
sector-exposure bar, which collapsed to a single grey block. The `stocks`
reference table had the real sectors the whole time, refreshed from the FMP
profile on every ingest.
"""

from __future__ import annotations

from app.db.models import Stock
from app.routes.public_v1 import get_strategy
from conftest import make_position


def _stock(db, ticker: str, sector: str | None):
    db.add(Stock(ticker=ticker, name=f"{ticker} Inc.", sector=sector))
    db.commit()


def test_sector_falls_back_to_the_stocks_table(db, portfolio):
    """A hand-seeded position with no sector still reports one."""
    make_position(db, portfolio, "SEZL", shares=10, avg_cost=10.0, current_price=12.0)
    _stock(db, "SEZL", "Financial Services")

    holdings = get_strategy(db=db)["holdings"]
    assert holdings[0]["ticker"] == "SEZL"
    assert holdings[0]["sector"] == "Financial Services"


def test_position_sector_wins_over_the_reference_table(db, portfolio):
    """The sector stamped at buy time is what the strategy actually used."""
    pos = make_position(
        db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0
    )
    pos.sector = "Technology"
    db.commit()
    _stock(db, "WDC", "Consumer Cyclical")

    holdings = get_strategy(db=db)["holdings"]
    assert holdings[0]["sector"] == "Technology"


def test_unknown_ticker_stays_unclassified(db, portfolio):
    """No row in `stocks` must report null, never a guess."""
    make_position(db, portfolio, "ZZZZ", shares=10, avg_cost=10.0, current_price=12.0)

    holdings = get_strategy(db=db)["holdings"]
    assert holdings[0]["sector"] is None


def test_a_null_sector_in_stocks_is_not_mistaken_for_a_value(db, portfolio):
    make_position(db, portfolio, "AAA", shares=10, avg_cost=10.0, current_price=12.0)
    _stock(db, "AAA", None)

    holdings = get_strategy(db=db)["holdings"]
    assert holdings[0]["sector"] is None


def test_sector_lookup_survives_an_empty_book(db, portfolio):
    assert get_strategy(db=db)["holdings"] == []
