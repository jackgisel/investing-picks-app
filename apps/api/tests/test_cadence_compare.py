"""Weekly research dates stay off the live 1st/3rd-Friday cadence."""

from __future__ import annotations

from datetime import date

from app.db.models import MarketCapHistory, PriceBar, UniverseMembership
from outpick_strategy.cadence import evaluation_fridays_between
from worker.backtest.cadence_compare import pick_diff
from worker.backtest.fridays import biweekly_eval_dates, research_eval_dates
from worker.backtest.membership import write_universe_membership
from worker.backtest.store import open_dataset


def test_weekly_dates_include_the_fridays_biweekly_skips():
    start, end = date(2026, 8, 1), date(2026, 8, 31)
    weekly = research_eval_dates(start, end)
    biweekly = evaluation_fridays_between(start, end)
    assert weekly == [
        date(2026, 8, 7),
        date(2026, 8, 14),
        date(2026, 8, 21),
        date(2026, 8, 28),
    ]
    assert date(2026, 8, 14) not in biweekly
    assert date(2026, 8, 28) not in biweekly
    assert biweekly_eval_dates(start, end) == [date(2026, 8, 7), date(2026, 8, 21)]


def test_good_friday_moves_to_the_prior_session():
    # 2026-04-03 is Good Friday. The session is Thursday 2026-04-02.
    dates = research_eval_dates(date(2026, 4, 1), date(2026, 4, 3))
    assert dates == [date(2026, 4, 2)]
    assert research_eval_dates(date(2026, 8, 1), date(2026, 7, 1)) == []


def test_pick_diff_flags_a_later_biweekly_buy_of_an_off_cycle_name():
    biweekly = {
        "evaluation_dates": ["2026-08-07", "2026-08-21"],
        "buys": [
            {"date": "2026-08-07", "ticker": "BBB"},
            {"date": "2026-08-21", "ticker": "AAA"},
        ],
    }
    weekly = {
        "evaluation_dates": ["2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28"],
        "buys": [
            {"date": "2026-08-07", "ticker": "BBB"},
            {"date": "2026-08-14", "ticker": "AAA"},
            {"date": "2026-08-28", "ticker": "CCC"},
        ],
    }
    diff = pick_diff(biweekly, weekly)
    assert diff["only_weekly"] == ["CCC"]
    assert diff["only_biweekly"] == []
    assert diff["both"] == ["AAA", "BBB"]
    by_ticker = {row["ticker"]: row for row in diff["weekly_off_cycle"]}
    assert by_ticker["AAA"]["biweekly_bought_later"] is True
    assert by_ticker["AAA"]["biweekly_later_fill_date"] == "2026-08-21"
    assert by_ticker["CCC"]["biweekly_bought_later"] is False


def test_membership_dates_override_writes_an_off_cycle_friday(tmp_path):
    db = open_dataset(tmp_path / "dataset.sqlite")
    db.add(PriceBar(ticker="AAA", date=date(2026, 8, 14), close=20.0))
    db.add(
        MarketCapHistory(ticker="AAA", date=date(2026, 8, 14), market_cap=2_000_000_000)
    )
    db.commit()
    assert write_universe_membership(db, date(2026, 8, 1), date(2026, 8, 31)) == 0
    written = write_universe_membership(
        db, date(2026, 8, 1), date(2026, 8, 31), dates=[date(2026, 8, 14)]
    )
    rows = db.query(UniverseMembership).all()
    assert written == 1
    assert [row.as_of for row in rows] == [date(2026, 8, 14)]
    db.close()
