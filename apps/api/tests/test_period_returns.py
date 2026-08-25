"""Calendar-period returns.

The properties worth pinning are the ones that are easy to get subtly wrong and
impossible to spot in the rendered number: which session a period is measured
FROM, and what happens to a position that did not exist for the whole of it.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.db.models import PortfolioSnapshot, Position, PriceBar, Stock
from app.services.period_returns import (
    period_returns_payload,
    resolve_anchors,
)


def _bar(db, ticker, d, close):
    db.add(PriceBar(ticker=ticker, date=d, close=close))


def _snap(db, d, total, spy=None):
    db.add(
        PortfolioSnapshot(
            portfolio_id=1,
            date=d,
            cash=0.0,
            invested_value=total,
            total_value=total,
            spy_value=spy,
            position_count=1,
        )
    )


# Wed 2026-07-29 .. Mon 2026-08-03 .. Wed 2026-08-05. Spans a month boundary and
# a weekend, so all three anchors are distinct and none of them is "yesterday".
JUL_29 = date(2026, 7, 29)
JUL_31 = date(2026, 7, 31)  # Friday, and the last session of July
AUG_03 = date(2026, 8, 3)  # Monday
AUG_04 = date(2026, 8, 4)
AUG_05 = date(2026, 8, 5)  # reporting date

SESSIONS = [JUL_29, JUL_31, AUG_03, AUG_04, AUG_05]


def test_anchors_are_the_session_before_the_period_opens():
    a = resolve_anchors(SESSIONS)
    assert a.latest == AUG_05
    assert a.day == AUG_04
    # Friday, NOT Monday: measuring the week from Monday's close discards
    # Monday's own move.
    assert a.week == JUL_31
    # Last session of July, not August 1st (a Saturday) and not August 3rd.
    assert a.month == JUL_31


def test_anchors_are_none_when_history_does_not_reach_back():
    a = resolve_anchors([AUG_04, AUG_05])
    assert a.day == AUG_04
    # The book has no session before this Monday, so WTD and MTD are unknown —
    # which must read as unknown, never as 0%.
    assert a.week is None
    assert a.month is None


def test_no_sessions_at_all():
    a = resolve_anchors([])
    assert (a.latest, a.day, a.week, a.month) == (None, None, None, None)


@pytest.fixture()
def book(db, portfolio):
    """One position held throughout, one entered on the Tuesday."""
    for d, px in [(JUL_29, 90.0), (JUL_31, 100.0), (AUG_03, 105.0), (AUG_04, 110.0), (AUG_05, 121.0)]:
        _bar(db, "OLD", d, px)
    for d, px in [(AUG_04, 50.0), (AUG_05, 55.0)]:
        _bar(db, "NEW", d, px)

    db.add(Stock(ticker="OLD", last_price=121.0, sector="Tech"))
    db.add(Stock(ticker="NEW", last_price=55.0, sector="Tech"))
    db.add(
        Position(
            portfolio_id=1, ticker="OLD", shares=10, avg_cost=90.0,
            current_price=121.0, entry_date=JUL_29, sector="Tech",
        )
    )
    db.add(
        Position(
            portfolio_id=1, ticker="NEW", shares=20, avg_cost=50.0,
            current_price=55.0, entry_date=AUG_04, sector="Tech",
        )
    )

    for d, total, spy in [
        (JUL_29, 100_000.0, 500.0),
        (JUL_31, 101_000.0, 505.0),
        (AUG_03, 102_000.0, 510.0),
        (AUG_04, 103_000.0, 515.0),
        (AUG_05, 106_090.0, 520.0),
    ]:
        _snap(db, d, total, spy)
    db.commit()
    return portfolio


def _period(payload, pid):
    return next(p for p in payload["periods"] if p["id"] == pid)


def test_book_and_spy_returns_use_the_right_anchor(db, book):
    payload = period_returns_payload(db)
    assert payload["as_of"] == AUG_05.isoformat()

    day = _period(payload, "day")
    assert day["from_date"] == AUG_04.isoformat()
    assert day["book_return_pct"] == 3.0  # 103,000 -> 106,090
    assert day["spy_return_pct"] == 0.97

    week = _period(payload, "week")
    assert week["from_date"] == JUL_31.isoformat()
    assert week["book_return_pct"] == 5.04  # 101,000 -> 106,090
    assert week["spy_return_pct"] == 2.97


def test_position_held_throughout_is_measured_from_the_anchor(db, book):
    payload = period_returns_payload(db)
    old = next(p for p in payload["positions"] if p["ticker"] == "OLD")
    assert old["periods"]["day"] == {
        "return_pct": 10.0,  # 110 -> 121
        "from_date": AUG_04.isoformat(),
        "partial": False,
    }
    assert old["periods"]["week"]["return_pct"] == 21.0  # 100 -> 121
    assert old["periods"]["month"]["return_pct"] == 21.0


def test_position_entered_mid_period_is_measured_from_entry_and_flagged(db, book):
    payload = period_returns_payload(db)
    new = next(p for p in payload["positions"] if p["ticker"] == "NEW")
    # A full session inside the book, so today is a normal full-period return.
    assert new["periods"]["day"] == {
        "return_pct": 10.0,
        "from_date": AUG_04.isoformat(),
        "partial": False,
    }
    # The week opened before we owned it: "+10% since we bought it on the 4th"
    # is not "+10% this week", and the flag is what lets a surface say so.
    assert new["periods"]["week"]["partial"] is True
    assert new["periods"]["week"]["from_date"] == AUG_04.isoformat()
    assert new["periods"]["week"]["return_pct"] == 10.0


def test_open_picks_sleeve_excludes_mid_period_entries(db, book):
    payload = period_returns_payload(db)

    # Today: both names were held at Tuesday's close.
    # 10*110 + 20*50 = 2,100 -> 10*121 + 20*55 = 2,310 = +10%.
    day = _period(payload, "day")
    assert day["open_picks_return_pct"] == 10.0
    assert day["open_picks_positions"] == 2
    assert day["open_picks_excluded_new"] == 0

    # This week: NEW did not exist on Friday. Folding it in at its entry price
    # would put its $1,000 in the denominator for days it was not at risk, so
    # the sleeve is OLD alone and says so.
    week = _period(payload, "week")
    assert week["open_picks_return_pct"] == 21.0
    assert week["open_picks_positions"] == 1
    assert week["open_picks_excluded_new"] == 1


def test_empty_book_publishes_nulls_not_zeros(db, portfolio):
    payload = period_returns_payload(db)
    assert payload["as_of"] is None
    assert payload["positions"] == []
    for period in payload["periods"]:
        assert period["book_return_pct"] is None
        assert period["open_picks_return_pct"] is None


def test_zero_base_snapshot_yields_none_rather_than_a_vast_return(db, portfolio):
    _snap(db, AUG_04, 0.0, 500.0)
    _snap(db, AUG_05, 100_000.0, 505.0)
    db.commit()
    day = _period(period_returns_payload(db), "day")
    assert day["book_return_pct"] is None


def test_missing_bar_carries_the_position_at_its_last_close(db, portfolio):
    # OLD has no bar on the 4th — a failed quote — while the book snapshot for
    # that day exists. The position must not drop out of the day's sleeve.
    _bar(db, "OLD", AUG_03, 100.0)
    _bar(db, "OLD", AUG_05, 110.0)
    db.add(Stock(ticker="OLD", last_price=110.0))
    db.add(
        Position(
            portfolio_id=1, ticker="OLD", shares=10, avg_cost=90.0,
            current_price=110.0, entry_date=JUL_29,
        )
    )
    _snap(db, AUG_04, 100_000.0)
    _snap(db, AUG_05, 101_000.0)
    db.commit()

    payload = period_returns_payload(db)
    old = next(p for p in payload["positions"] if p["ticker"] == "OLD")
    assert old["periods"]["day"]["return_pct"] == 10.0  # from the 3rd's close


def test_endpoint_serves_the_payload(db, book):
    """The route itself, not just the service.

    A service with passing tests and a router that never calls it is the exact
    shape of failure `test_ops_dry_run.py` exists to catch.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.routes import public_v1

    app = FastAPI()
    app.include_router(public_v1.router)
    app.dependency_overrides[get_db] = lambda: db

    res = TestClient(app).get("/api/v1/period-returns")
    assert res.status_code == 200, res.text
    payload = res.json()

    assert [p["id"] for p in payload["periods"]] == ["day", "week", "month"]
    assert {p["ticker"] for p in payload["positions"]} == {"OLD", "NEW"}
    assert payload["periods"][0]["book_return_pct"] == 3.0


def test_sector_falls_back_to_the_stocks_table(db, portfolio):
    """Most positions carry no sector of their own; `stocks` is where it lives.

    Reading `Position.sector` alone rendered the whole book "Unclassified" on a
    table whose neighbouring page had the sector right.
    """
    _bar(db, "OLD", AUG_04, 100.0)
    _bar(db, "OLD", AUG_05, 110.0)
    db.add(Stock(ticker="OLD", last_price=110.0, sector="Financial Services"))
    db.add(
        Position(
            portfolio_id=1, ticker="OLD", shares=10, avg_cost=90.0,
            current_price=110.0, entry_date=JUL_29, sector=None,
        )
    )
    _snap(db, AUG_04, 100_000.0)
    _snap(db, AUG_05, 101_000.0)
    db.commit()

    row = period_returns_payload(db)["positions"][0]
    assert row["sector"] == "Financial Services"
