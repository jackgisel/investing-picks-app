"""When the strategy evaluates. Pure date math — no I/O, no market calendar.

The cadence rule lived inline in the worker's scheduler, which was fine while
the scheduler was its only reader. It is published to subscribers now ("next
picks: Fri 7 Aug"), and the API cannot import the worker — they deploy as
separate services and the API's few worker imports are deliberately lazy. One
definition here, imported by both, beats a second copy that drifts.

Holiday adjustment deliberately does NOT live here: `market_calendar` owns the
trading calendar, and this package takes no dependencies. Callers that need the
session an evaluation will really run on wrap these with
`last_trading_day_on_or_before`.
"""

from __future__ import annotations

from datetime import date, timedelta

FRIDAY = 4

# Run 118 evaluates on the 1st and 3rd Friday of the month. Expressed as
# day-of-month bands rather than "nth weekday" because that is what the
# scheduler's CronTrigger fires on (day="1-7,15-21"), and the two must agree.
FIRST_FRIDAY_DAYS = range(1, 8)
THIRD_FRIDAY_DAYS = range(15, 22)


def is_evaluation_friday(d: date) -> bool:
    """Is `d` a date the strategy evaluates on?"""
    if d.weekday() != FRIDAY:
        return False
    return d.day in FIRST_FRIDAY_DAYS or d.day in THIRD_FRIDAY_DAYS


def next_evaluation_friday(today: date) -> date:
    """The next evaluation Friday on or after `today`.

    Bounded scan: an evaluation Friday falls at least twice a month, so this
    terminates within about three weeks. A month-arithmetic version is shorter
    and gets the December boundary wrong.
    """
    cursor = today
    for _ in range(40):
        if is_evaluation_friday(cursor):
            return cursor
        cursor += timedelta(days=1)
    raise AssertionError(f"no evaluation Friday within 40 days of {today}")


def evaluation_fridays_between(start: date, end: date) -> list[date]:
    """Every evaluation Friday in [start, end]. Empty when end < start."""
    out: list[date] = []
    cursor = start
    while cursor <= end:
        if is_evaluation_friday(cursor):
            out.append(cursor)
        cursor += timedelta(days=1)
    return out
