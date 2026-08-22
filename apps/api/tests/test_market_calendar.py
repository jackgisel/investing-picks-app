"""Trading-calendar tests.

The two dates that motivated this module come from real data: the book was
hand-entered with positions dated 2026-06-19 and 2026-07-03, and FMP returned
no price bar for either because both are market holidays.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from worker.services.market_calendar import (
    is_effective_run_day,
    is_trading_day,
    last_trading_day_on_or_before,
    market_holidays,
    next_trading_day,
    previous_trading_day,
)


def test_the_two_dates_that_caused_the_bad_entries():
    # Juneteenth 2026 falls on a Friday.
    assert not is_trading_day(date(2026, 6, 19))
    assert previous_trading_day(date(2026, 6, 19)) == date(2026, 6, 18)

    # 2026-07-04 is a Saturday, so the market closes Friday the 3rd.
    assert not is_trading_day(date(2026, 7, 3))
    assert previous_trading_day(date(2026, 7, 3)) == date(2026, 7, 2)


def test_weekends_are_not_trading_days():
    assert not is_trading_day(date(2026, 7, 25))  # Saturday
    assert not is_trading_day(date(2026, 7, 26))  # Sunday
    assert is_trading_day(date(2026, 7, 24))      # Friday


@pytest.mark.parametrize(
    "day",
    [
        date(2026, 1, 1),    # New Year's Day
        date(2026, 1, 19),   # MLK
        date(2026, 2, 16),   # Presidents' Day
        date(2026, 4, 3),    # Good Friday
        date(2026, 5, 25),   # Memorial Day
        date(2026, 9, 7),    # Labor Day
        date(2026, 11, 26),  # Thanksgiving
        date(2026, 12, 25),  # Christmas
    ],
)
def test_known_2026_holidays(day):
    assert not is_trading_day(day)


def test_good_friday_tracks_easter_across_years():
    # Easter moves; a hardcoded table would silently rot.
    assert date(2027, 3, 26) in market_holidays(2027)
    assert date(2025, 4, 18) in market_holidays(2025)


def test_weekend_holidays_shift_in_the_right_direction():
    # 2027-12-25 is a Saturday -> observed Friday the 24th.
    assert date(2027, 12, 24) in market_holidays(2027)
    # 2028-01-01 is a Saturday -> observed Friday, which lands in 2027.
    assert date(2022, 1, 1).weekday() == 5
    assert date(2021, 12, 31) in market_holidays(2021)


def test_juneteenth_only_after_2022():
    assert date(2026, 6, 19) in market_holidays(2026)
    assert date(2019, 6, 19) not in market_holidays(2019)


def test_navigation_skips_holiday_weekend_runs():
    # Thursday 2026-11-26 is Thanksgiving; Friday the 27th is a session.
    assert previous_trading_day(date(2026, 11, 27)) == date(2026, 11, 25)
    assert next_trading_day(date(2026, 11, 25)) == date(2026, 11, 27)


def test_last_trading_day_on_or_before_is_identity_on_sessions():
    assert last_trading_day_on_or_before(date(2026, 7, 24)) == date(2026, 7, 24)
    assert last_trading_day_on_or_before(date(2026, 7, 3)) == date(2026, 7, 2)


def test_a_holiday_evaluation_runs_the_prior_session_instead_of_vanishing():
    """The scheduling rule: move the run, never skip the cycle."""
    target = date(2026, 7, 3)  # nominal 1st-Friday evaluation, market closed
    assert not is_effective_run_day(target, date(2026, 7, 3))
    assert is_effective_run_day(target, date(2026, 7, 2))


def test_a_normal_target_runs_on_its_own_day():
    target = date(2026, 7, 17)
    assert is_effective_run_day(target, date(2026, 7, 17))
    assert not is_effective_run_day(target, date(2026, 7, 16))


# ---------------------------------------------------------------------------
# Scheduling: which day of an evaluation week actually runs
# ---------------------------------------------------------------------------


def test_biweekly_target_identifies_first_and_third_fridays():
    from worker.jobs.runner import biweekly_target_friday

    # 2026-07-03 is the 1st Friday of July (and a market holiday).
    assert biweekly_target_friday(date(2026, 7, 1)) == date(2026, 7, 3)
    assert biweekly_target_friday(date(2026, 7, 3)) == date(2026, 7, 3)
    # 2026-07-17 is the 3rd Friday.
    assert biweekly_target_friday(date(2026, 7, 17)) == date(2026, 7, 17)
    # 2026-07-10 is the 2nd Friday — not an evaluation week.
    assert biweekly_target_friday(date(2026, 7, 10)) is None
    # 2026-07-24 is the 4th Friday.
    assert biweekly_target_friday(date(2026, 7, 24)) is None


def test_exactly_one_weekday_runs_per_evaluation_week():
    """The trigger fires all week; the guard must select a single day."""
    from worker.jobs.runner import biweekly_target_friday

    for week in (date(2026, 7, 1), date(2026, 7, 15)):
        monday = week - timedelta(days=week.weekday())
        runs = [
            monday + timedelta(days=i)
            for i in range(5)
            if (t := biweekly_target_friday(monday + timedelta(days=i)))
            and is_effective_run_day(t, monday + timedelta(days=i))
        ]
        assert len(runs) == 1, f"week of {monday}: {runs}"


def test_dca_target_friday_is_every_week():
    from worker.jobs.runner import dca_target_friday

    assert dca_target_friday(date(2026, 7, 8)) == date(2026, 7, 10)
    assert dca_target_friday(date(2026, 7, 10)) == date(2026, 7, 10)
    assert dca_target_friday(date(2026, 7, 11)) is None  # Saturday


def test_dca_holiday_friday_runs_thursday():
    from worker.jobs.runner import dca_target_friday

    thursday = date(2026, 4, 2)
    friday = date(2026, 4, 3)  # Good Friday
    assert dca_target_friday(thursday) == friday
    assert is_effective_run_day(friday, thursday)
    assert not is_effective_run_day(friday, friday)


def test_holiday_friday_moves_the_run_to_thursday():
    from worker.jobs.runner import biweekly_target_friday

    # 1st Friday of July 2026 is the observed Independence Day closure.
    thursday = date(2026, 7, 2)
    friday = date(2026, 7, 3)
    assert is_effective_run_day(biweekly_target_friday(thursday), thursday)
    assert not is_effective_run_day(biweekly_target_friday(friday), friday)


def test_good_friday_also_moves_the_run():
    from worker.jobs.runner import biweekly_target_friday

    # 2026-04-03 is Good Friday and the 1st Friday of April.
    assert not is_trading_day(date(2026, 4, 3))
    thursday = date(2026, 4, 2)
    assert biweekly_target_friday(thursday) == date(2026, 4, 3)
    assert is_effective_run_day(date(2026, 4, 3), thursday)
