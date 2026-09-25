"""Research dates for a weekly replay. Live evaluation stays biweekly.

`evaluation_fridays_between` in `packages/strategy` is the shipped cadence
(the 1st and 3rd Friday). This module lists every Friday so a backtest can
replay one add per week without changing the scheduler.
"""

from __future__ import annotations

from datetime import date, timedelta

from outpick_strategy.cadence import evaluation_fridays_between

from worker.services.market_calendar import last_trading_day_on_or_before

FRIDAY = 4


def calendar_fridays_between(start: date, end: date) -> list[date]:
    """Every calendar Friday in [start, end]. Empty when end < start."""
    if end < start:
        return []
    cursor = start
    while cursor.weekday() != FRIDAY:
        cursor += timedelta(days=1)
        if cursor > end:
            return []
    out: list[date] = []
    while cursor <= end:
        out.append(cursor)
        cursor += timedelta(days=7)
    return out


def shift_to_sessions(fridays: list[date], start: date) -> list[date]:
    """Move each Friday to the last session on or before it.

    Matches replay's default holiday rule: a market holiday is evaluated on
    the prior session, and a session before `start` is dropped. Duplicate
    sessions (two Fridays landing on one day) are kept once, in order.
    """
    out: list[date] = []
    for friday in fridays:
        session = last_trading_day_on_or_before(friday)
        if session < start:
            continue
        if session not in out:
            out.append(session)
    return out


def research_eval_dates(start: date, end: date) -> list[date]:
    """Every Friday in [start, end], on the session that Friday would trade."""
    return shift_to_sessions(calendar_fridays_between(start, end), start)


def biweekly_eval_dates(start: date, end: date) -> list[date]:
    """Shipped 1st/3rd Fridays, holiday-shifted the same way as the weekly list."""
    return shift_to_sessions(evaluation_fridays_between(start, end), start)
