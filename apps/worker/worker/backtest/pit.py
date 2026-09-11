"""Point-in-time availability dates. No lookahead: a score on d may only
read rows with available_from <= d.
"""

from __future__ import annotations

from datetime import date, timedelta

from worker.services.ingest import first_present


def parse_fmp_date(raw) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


def filing_available_from(row: dict) -> date | None:
    """When this statement became public.

    Prefer `acceptedDate` (SEC acceptance), then FMP's `fillingDate` typo,
    then `filingDate`, then the period `date` as a last resort. A timestamp
    at or after 16:00 ET is treated as available the next calendar day —
    after the cash session, so it cannot leak into that day's close-based
    score. Trading-day shift is left to the caller that already has a
    calendar (membership / scoring).
    """
    raw = first_present(row, "acceptedDate", "fillingDate", "filingDate", "date")
    if not raw:
        return None
    text = str(raw)
    day = parse_fmp_date(text)
    if day is None:
        return None
    if len(text) >= 16:
        try:
            hour = int(text[11:13])
        except ValueError:
            hour = 0
        if hour >= 16:
            day = day + timedelta(days=1)
    return day
