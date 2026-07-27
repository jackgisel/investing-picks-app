"""Evaluation cadence — the 1st and 3rd Friday rule.

This is published to subscribers as "next picks: <date>", so it is no longer
only the scheduler's business. The scheduler's CronTrigger fires on
day="1-7,15-21", day_of_week="mon-fri"; these bands must agree with it.
"""

from __future__ import annotations

from datetime import date

import pytest

from outpick_strategy.cadence import (
    evaluation_fridays_between,
    is_evaluation_friday,
    next_evaluation_friday,
)


@pytest.mark.parametrize(
    "d",
    [
        date(2026, 7, 3),  # 1st Friday
        date(2026, 7, 17),  # 3rd Friday
        date(2026, 8, 7),
        date(2026, 8, 21),
    ],
)
def test_evaluation_fridays(d):
    assert is_evaluation_friday(d)


@pytest.mark.parametrize(
    "d",
    [
        date(2026, 7, 10),  # 2nd Friday — day 10 is in neither band
        date(2026, 7, 24),  # 4th Friday
        date(2026, 7, 31),  # 5th Friday
        date(2026, 7, 16),  # a Thursday inside the 15-21 band
        date(2026, 7, 20),  # a Monday inside the 15-21 band
    ],
)
def test_non_evaluation_days(d):
    assert not is_evaluation_friday(d)


def test_next_evaluation_friday_returns_today_when_today_qualifies():
    assert next_evaluation_friday(date(2026, 8, 7)) == date(2026, 8, 7)


def test_next_evaluation_friday_skips_the_second_friday():
    # From Mon 6 Jul the next Friday is the 10th, which is NOT an evaluation
    # day — the answer is the 17th.
    assert next_evaluation_friday(date(2026, 7, 6)) == date(2026, 7, 17)


def test_next_evaluation_friday_crosses_the_month_boundary():
    # After the 3rd Friday of July the next one is the 1st Friday of August.
    assert next_evaluation_friday(date(2026, 7, 18)) == date(2026, 8, 7)


def test_next_evaluation_friday_crosses_the_year_boundary():
    assert next_evaluation_friday(date(2026, 12, 19)) == date(2027, 1, 1)


def test_every_month_has_exactly_two_evaluation_fridays():
    """The bands are day-of-month, not "nth weekday". A month whose 1st falls
    on a Saturday has its first Friday on the 7th and its third on the 21st —
    still exactly two, and that edge is what the bands have to get right.
    """
    all_2026 = evaluation_fridays_between(date(2026, 1, 1), date(2026, 12, 31))
    for month in range(1, 13):
        fridays = [d for d in all_2026 if d.month == month]
        assert len(fridays) == 2, f"month {month} had {fridays}"


def test_evaluation_fridays_between_is_empty_for_a_reversed_range():
    assert evaluation_fridays_between(date(2026, 8, 1), date(2026, 7, 1)) == []
