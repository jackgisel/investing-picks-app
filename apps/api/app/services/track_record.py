"""The factsheet half of the Performance page: month by month, and pick by pick.

Two views every research service with a public record publishes, and that the
cumulative curve cannot answer on its own:

- **Monthly returns.** The curve says where the book ended up; it does not say
  whether that came from one lucky month or from steady ones. Each month is
  REBUILT as its own window (see `rebase_flows`) rather than read off the
  cumulative curve: the curve is money-weighted on a growing base, so chaining
  its month-end values would not give the month's return.

- **Pick scorecard.** Every pick, open or closed, against what the S&P 500 did
  over the same holding period. A book can beat the index on a handful of
  outliers while most picks trail it; only the per-pick view shows which.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.services.benchmarks import (
    _closes,
    _price_on_or_before,
    benchmark_series,
    deployment_schedule,
    latest_session,
    picks_series,
)

SPY = "SPY"


def _last_on_or_before(rows: list[dict], cutoff: date) -> float | None:
    """The last `return_pct` in a series dated on or before `cutoff`."""
    value: float | None = None
    for row in rows:
        if date.fromisoformat(row["date"]) > cutoff:
            break
        value = row["return_pct"]
    return value


def _month_end(year: int, month: int) -> date:
    first_next = date(year + (month == 12), month % 12 + 1, 1)
    return first_next - timedelta(days=1)


def monthly_returns(db: Session, portfolio_id: int = 1) -> list[dict]:
    """Picks vs S&P 500 for every calendar month the book has been live.

    Each month opens at the prior month's final close — the same base a
    published month-to-date figure uses, and the month analogue of how YTD is
    anchored in `window_open`. The first month runs from the first pick; the
    latest runs to the latest session and is flagged `partial`.
    """
    flows = deployment_schedule(db, portfolio_id)
    latest = latest_session(db)
    if not flows or latest is None:
        return []
    inception = min(f.when for f in flows)

    out: list[dict] = []
    year, month = inception.year, inception.month
    while (year, month) <= (latest.year, latest.month):
        first = date(year, month, 1)
        # The last calendar day of the prior month. Lots are priced "on or
        # before" the start, so this is that month's final close.
        start: date | None = first - timedelta(days=1)
        if start < inception:
            start = None
        end = min(_month_end(year, month), latest)

        picks = _last_on_or_before(picks_series(db, portfolio_id, start=start), end)
        spy_rows = (
            benchmark_series(db, portfolio_id, tickers={SPY: "S&P 500"}, start=start)
            .get("series", {})
            .get(SPY, [])
        )
        spy = _last_on_or_before(spy_rows, end)

        out.append(
            {
                "month": f"{year:04d}-{month:02d}",
                "picks_pct": picks,
                "spy_pct": spy,
                # First month from the first pick, latest month to date. Both
                # are real returns over a shorter span, and must say so.
                "partial": start is None or end < _month_end(year, month),
            }
        )
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return out


def pick_scorecard(db: Session, picks: list[dict]) -> list[dict]:
    """Each pick beside the S&P 500's move over the same holding period.

    `picks` is the `/picks?status=all` payload, so the pick's own return is the
    exact figure published everywhere else. The index leg runs from the close
    on (or before) entry to the close on (or before) exit, or the latest
    session for a pick still open. Unknown on either side stays None — a pick
    with no entry date is not "level with the market".
    """
    closes = _closes(db, SPY)
    sessions = sorted(closes)
    latest = sessions[-1] if sessions else None

    out: list[dict] = []
    for p in picks:
        entry = date.fromisoformat(p["entry_date"]) if p.get("entry_date") else None
        exit_ = date.fromisoformat(p["exit_date"]) if p.get("exit_date") else None
        spy_pct: float | None = None
        if entry and sessions:
            first = _price_on_or_before(closes, sessions, entry)
            last = _price_on_or_before(closes, sessions, exit_ or latest)
            if first and last and first > 0:
                spy_pct = round((last / first - 1) * 100, 2)
        ret = p.get("pnl_pct")
        out.append(
            {
                "ticker": p["ticker"],
                "status": p["status"],
                "entry_date": p.get("entry_date"),
                "exit_date": p.get("exit_date"),
                "return_pct": ret,
                "spy_pct": spy_pct,
                "excess_pct": (
                    round(ret - spy_pct, 2)
                    if ret is not None and spy_pct is not None
                    else None
                ),
            }
        )
    return out
