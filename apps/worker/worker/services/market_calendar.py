"""US equity market trading calendar.

The scheduler previously fired on wall-clock weekdays, so a run landing on a
market holiday found no new prices. That is not hypothetical: the book was
hand-entered with positions dated 2026-06-19 (Juneteenth) and 2026-07-03
(Independence Day observed), neither of which is a session, and FMP returned no
bar for either.

Holidays are COMPUTED rather than tabulated so the calendar does not silently
expire at the end of a hardcoded year and start treating holidays as sessions.

Not modelled: early closes (the half sessions before Independence Day and after
Thanksgiving) are full trading days for our purposes since we only use closes,
and one-off closures for national days of mourning, which are unpredictable.
"""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache


def _easter(year: int) -> date:
    """Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """The nth `weekday` (Mon=0) of a month. n=-1 means the last one."""
    if n > 0:
        d = date(year, month, 1)
        offset = (weekday - d.weekday()) % 7
        return d + timedelta(days=offset + 7 * (n - 1))
    nxt = date(year + (month == 12), (month % 12) + 1, 1)
    d = nxt - timedelta(days=1)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def _observed(d: date) -> date:
    """Weekend holidays shift: Saturday -> Friday before, Sunday -> Monday after."""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


@lru_cache(maxsize=32)
def market_holidays(year: int) -> frozenset[date]:
    """NYSE/Nasdaq full-day closures for `year`."""
    days = {
        _observed(date(year, 1, 1)),                  # New Year's Day
        _nth_weekday(year, 1, 0, 3),                  # MLK Day
        _nth_weekday(year, 2, 0, 3),                  # Presidents' Day
        _easter(year) - timedelta(days=2),            # Good Friday
        _nth_weekday(year, 5, 0, -1),                 # Memorial Day
        _observed(date(year, 7, 4)),                  # Independence Day
        _nth_weekday(year, 9, 0, 1),                  # Labor Day
        _nth_weekday(year, 11, 3, 4),                 # Thanksgiving
        _observed(date(year, 12, 25)),                # Christmas
    }
    # Juneteenth became a market holiday in 2022.
    if year >= 2022:
        days.add(_observed(date(year, 6, 19)))

    # When the NEXT year's New Year's Day is a Saturday, its observance falls
    # back into December of THIS year — the market closed Fri 2021-12-31 for
    # Sat 2022-01-01. Without this, that day looks like a session.
    next_new_year = _observed(date(year + 1, 1, 1))
    if next_new_year.year == year:
        days.add(next_new_year)

    # Symmetrically, this year's own New Year's observance can belong to the
    # previous year, in which case it is not a closure within this year at all.
    return frozenset(d for d in days if d.year == year)


def is_trading_day(d: date) -> bool:
    """True when the US equity market holds a regular session on `d`."""
    if d.weekday() >= 5:
        return False
    return d not in market_holidays(d.year)


def previous_trading_day(d: date) -> date:
    """The most recent session strictly before `d`."""
    cursor = d - timedelta(days=1)
    while not is_trading_day(cursor):
        cursor -= timedelta(days=1)
    return cursor


def last_trading_day_on_or_before(d: date) -> date:
    """`d` itself when it is a session, otherwise the session before it."""
    return d if is_trading_day(d) else previous_trading_day(d)


def next_trading_day(d: date) -> date:
    """The next session strictly after `d`."""
    cursor = d + timedelta(days=1)
    while not is_trading_day(cursor):
        cursor += timedelta(days=1)
    return cursor


def is_effective_run_day(target: date, today: date) -> bool:
    """Should a job scheduled for `target` actually run on `today`?

    Jobs must not be skipped just because their nominal date is a holiday — an
    evaluation cycle that silently vanishes is worse than one that runs a day
    early. The run moves to the last session on or before the target, so the
    work happens against real prices.
    """
    return today == last_trading_day_on_or_before(target)
