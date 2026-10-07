"""Beat the S&P 500 challenge: entries, eligibility and scoring.

The web app owns sign-in and the pages; it reaches this module through the
API (`/api/v1/challenge/*` for public reads, `/api/ops/challenge/*` for writes
keyed to a user). Everything lives here because the stock universe and the
prices are in this database, and a score is a join across both.

An entry holds 15 to 30 stocks at equal weight from the first SPY close dated
after its New York submission date, never rebalanced, against SPY bought at
that same close. Scores are computed on read from `challenge_price`; nothing
derived is stored. A pick with no price counts as flat, so a data gap can never
lift an entry up the board. A name that stops trading is held at its last close.
"""

from __future__ import annotations

import secrets
import time
from bisect import bisect_right
from datetime import date, datetime, timezone
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    ChallengeEntry,
    ChallengePick,
    ChallengePrice,
    ChallengePriceCheck,
    Stock,
)

MIN_PICKS = 15
MAX_PICKS = 30
MIN_MARKET_CAP = 300_000_000
BENCHMARK = "SPY"
NY = ZoneInfo("America/New_York")


class EntryError(ValueError):
    """A submission the rules reject. `code` is stable for the web app."""

    def __init__(self, code: str, message: str, tickers: list[str] | None = None):
        super().__init__(message)
        self.code = code
        self.tickers = tickers or []


def ny_date(at: datetime) -> date:
    return at.astimezone(NY).date()


def cohort_for(d: date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def _eligible_query(db: Session):
    return db.query(Stock).filter(
        Stock.is_active == True,  # noqa: E712
        Stock.is_etf == False,  # noqa: E712
        Stock.market_cap >= MIN_MARKET_CAP,
    )


def _stock_row(s: Stock) -> dict:
    return {
        "ticker": s.ticker,
        "name": s.name,
        "sector": s.sector,
        "industry": s.industry,
        "market_cap": s.market_cap,
    }


def search_eligible(db: Session, q: str, limit: int = 8) -> list[dict]:
    """Ticker prefix or name match over the eligible universe, best first."""
    term = q.strip()[:40]
    if not term:
        return []
    upper = term.upper()
    plain = term.lower().replace("%", "").replace("_", "")
    rows = (
        _eligible_query(db)
        .filter(
            (Stock.ticker.like(f"{upper}%")) | (func.lower(Stock.name).like(f"%{plain}%"))
        )
        .all()
    )
    rows.sort(
        key=lambda s: (
            s.ticker != upper,
            not s.ticker.startswith(upper),
            -(s.market_cap or 0),
        )
    )
    return [_stock_row(s) for s in rows[:limit]]


def create_entry(
    db: Session,
    *,
    user_id: str,
    display_name: str,
    tickers: list[str],
    now: datetime | None = None,
) -> dict:
    """Lock in an entry. Returns `{"id"}`, or `{"existing_id"}` if the user
    already entered this quarter. Raises EntryError for a rule violation."""
    now = now or datetime.now(timezone.utc)
    name = " ".join(display_name.split())
    if not 2 <= len(name) <= 30:
        raise EntryError("bad_name", "Pick a name for the leaderboard: 2 to 30 characters.")
    picks = list(dict.fromkeys(t.strip().upper() for t in tickers if t.strip()))
    if len(picks) < MIN_PICKS:
        raise EntryError("too_few", f"Pick at least {MIN_PICKS} stocks. You have {len(picks)}.")
    if len(picks) > MAX_PICKS:
        raise EntryError("too_many", f"Pick at most {MAX_PICKS} stocks. You have {len(picks)}.")
    eligible = {s.ticker for s in _eligible_query(db).filter(Stock.ticker.in_(picks)).all()}
    bad = [t for t in picks if t not in eligible]
    if bad:
        raise EntryError(
            "ineligible",
            f"{', '.join(bad)} {'are' if len(bad) > 1 else 'is'} not in the challenge universe. "
            "Only US listed operating companies above $300M in market value count.",
            bad,
        )

    submitted_on = ny_date(now)
    cohort = cohort_for(submitted_on)
    existing = (
        db.query(ChallengeEntry.id)
        .filter(ChallengeEntry.user_id == user_id, ChallengeEntry.cohort == cohort)
        .scalar()
    )
    if existing:
        return {"existing_id": existing}
    entry_id = secrets.token_urlsafe(6)
    db.add(
        ChallengeEntry(
            id=entry_id,
            user_id=user_id,
            display_name=name,
            cohort=cohort,
            submitted_at=now,
            submitted_on=submitted_on,
            hidden=False,
        )
    )
    db.add_all(ChallengePick(entry_id=entry_id, ticker=t) for t in picks)
    try:
        db.commit()
    except IntegrityError:
        # Two tabs submitting at once: the unique constraint is the real guard.
        db.rollback()
        again = (
            db.query(ChallengeEntry.id)
            .filter(ChallengeEntry.user_id == user_id, ChallengeEntry.cohort == cohort)
            .scalar()
        )
        if again:
            return {"existing_id": again}
        raise
    _BOARD_CACHE.clear()
    return {"id": entry_id}


def user_entries(db: Session, user_id: str) -> list[dict]:
    rows = (
        db.query(ChallengeEntry)
        .filter(ChallengeEntry.user_id == user_id)
        .order_by(ChallengeEntry.submitted_on.desc())
        .all()
    )
    return [
        {"id": e.id, "cohort": e.cohort, "submitted_on": e.submitted_on.isoformat()}
        for e in rows
    ]


def set_hidden(db: Session, entry_id: str, hidden: bool) -> bool:
    entry = db.get(ChallengeEntry, entry_id)
    if entry is None:
        return False
    entry.hidden = hidden
    db.commit()
    _BOARD_CACHE.clear()
    return True


def _spy_dates(db: Session) -> tuple[list[date], dict[date, float]]:
    rows = (
        db.query(ChallengePrice.date, ChallengePrice.close)
        .filter(ChallengePrice.ticker == BENCHMARK)
        .order_by(ChallengePrice.date)
        .all()
    )
    return [d for d, _ in rows], {d: c for d, c in rows}


def _start_date(spy_dates: list[date], submitted_on: date) -> date | None:
    """First benchmark session strictly after the submission date."""
    i = bisect_right(spy_dates, submitted_on)
    return spy_dates[i] if i < len(spy_dates) else None


def _basis(db: Session) -> str | None:
    check = db.get(ChallengePriceCheck, BENCHMARK)
    return check.basis if check and check.basis in ("total_return", "price") else None


def _growth(start: float | None, last: float | None) -> float:
    if not start or not last or start <= 0 or last <= 0:
        return 1.0
    return last / start


def _pick_marks(db: Session, ticker: str, start: date, as_of: date) -> tuple[float | None, float | None]:
    first = (
        db.query(ChallengePrice.close)
        .filter(ChallengePrice.ticker == ticker, ChallengePrice.date >= start)
        .order_by(ChallengePrice.date)
        .limit(1)
        .scalar()
    )
    last = (
        db.query(ChallengePrice.close)
        .filter(ChallengePrice.ticker == ticker, ChallengePrice.date <= as_of)
        .order_by(ChallengePrice.date.desc())
        .limit(1)
        .scalar()
    )
    return first, last


_BOARD_CACHE: dict[str | None, tuple[float, dict]] = {}
BOARD_TTL_SECONDS = 300


def board(db: Session, cohort: str | None = None) -> dict:
    """Every visible entry, ranked by return minus SPY's over the same days.

    Entries still waiting for their first close follow, newest first. Cached
    for five minutes; a new entry or a hide clears it.
    """
    hit = _BOARD_CACHE.get(cohort)
    now = time.monotonic()
    if hit and now - hit[0] < BOARD_TTL_SECONDS:
        return hit[1]

    spy_dates, spy = _spy_dates(db)
    as_of = spy_dates[-1] if spy_dates else None
    q = db.query(ChallengeEntry).filter(ChallengeEntry.hidden == False)  # noqa: E712
    if cohort:
        q = q.filter(ChallengeEntry.cohort == cohort)
    entries = q.order_by(ChallengeEntry.submitted_at.desc()).all()

    picks: dict[str, list[str]] = {}
    for entry_id, ticker in (
        db.query(ChallengePick.entry_id, ChallengePick.ticker)
        .filter(ChallengePick.entry_id.in_([e.id for e in entries] or [""]))
        .all()
    ):
        picks.setdefault(entry_id, []).append(ticker)

    # One price lookup per (ticker, start) pair, however many entries share it.
    marks: dict[tuple[str, date], tuple[float | None, float | None]] = {}
    rows = []
    for e in entries:
        start = _start_date(spy_dates, e.submitted_on) if as_of else None
        held = picks.get(e.id, [])
        ret = spy_ret = None
        if start and held:
            growths = []
            for t in held:
                key = (t, start)
                if key not in marks:
                    marks[key] = _pick_marks(db, t, start, as_of)
                growths.append(_growth(*marks[key]))
            ret = sum(growths) / len(growths) - 1
            spy_ret = spy[as_of] / spy[start] - 1
        rows.append(
            {
                "id": e.id,
                "display_name": e.display_name,
                "cohort": e.cohort,
                "submitted_on": e.submitted_on.isoformat(),
                "start_date": start.isoformat() if start else None,
                "picks": len(held),
                "ret": ret,
                "spy_ret": spy_ret,
                "excess": ret - spy_ret if ret is not None and spy_ret is not None else None,
            }
        )
    # Scored entries by lead over SPY; pending ones keep the query's newest-first order.
    ranked = sorted((r for r in rows if r["excess"] is not None), key=lambda r: -r["excess"])
    rows = ranked + [r for r in rows if r["excess"] is None]
    scored = [r["excess"] for r in ranked]
    cohorts = [
        c
        for (c,) in db.query(ChallengeEntry.cohort)
        .filter(ChallengeEntry.hidden == False)  # noqa: E712
        .distinct()
        .order_by(ChallengeEntry.cohort.desc())
        .all()
    ]
    result = {
        "as_of": as_of.isoformat() if as_of else None,
        "basis": _basis(db),
        "cohorts": cohorts,
        "popular": popular(db),
        "stats": {
            "entries": len(rows),
            "scored": len(scored),
            "beating": sum(1 for x in scored if x > 0),
            "median_excess": median(scored) if scored else None,
        },
        "rows": rows,
    }
    if len(_BOARD_CACHE) > 32:
        _BOARD_CACHE.clear()
    _BOARD_CACHE[cohort] = (now, result)
    return result


def popular(db: Session, limit: int = 12) -> list[dict]:
    rows = (
        db.query(ChallengePick.ticker, Stock.name, func.count().label("n"))
        .join(ChallengeEntry, ChallengeEntry.id == ChallengePick.entry_id)
        .outerjoin(Stock, Stock.ticker == ChallengePick.ticker)
        .filter(ChallengeEntry.hidden == False)  # noqa: E712
        .group_by(ChallengePick.ticker, Stock.name)
        .order_by(text("n DESC"), ChallengePick.ticker)
        .limit(limit)
        .all()
    )
    return [{"ticker": t, "name": n, "entries": c} for t, n, c in rows]


def entry_detail(db: Session, entry_id: str) -> dict | None:
    """One entry with its picks, marks and a daily series. None if hidden."""
    entry = db.get(ChallengeEntry, entry_id)
    if entry is None or entry.hidden:
        return None
    spy_dates, spy = _spy_dates(db)
    as_of = spy_dates[-1] if spy_dates else None
    start = _start_date(spy_dates, entry.submitted_on) if as_of else None
    held = [
        t
        for (t,) in db.query(ChallengePick.ticker).filter(ChallengePick.entry_id == entry_id).all()
    ]
    stocks = {s.ticker: s for s in db.query(Stock).filter(Stock.ticker.in_(held or [""])).all()}

    picks = []
    series: list[dict] = []
    if start:
        closes: dict[str, list[tuple[date, float]]] = {t: [] for t in held}
        for t, d, c in (
            db.query(ChallengePrice.ticker, ChallengePrice.date, ChallengePrice.close)
            .filter(ChallengePrice.ticker.in_(held), ChallengePrice.date >= start)
            .order_by(ChallengePrice.ticker, ChallengePrice.date)
            .all()
        ):
            closes[t].append((d, c))
        starts = {t: (closes[t][0][1] if closes[t] else None) for t in held}
        # Forward-fill each pick onto the benchmark's sessions.
        idx = {t: 0 for t in held}
        last_seen: dict[str, float | None] = {t: None for t in held}
        base = spy[start]
        for d in spy_dates[spy_dates.index(start):]:
            for t in held:
                rows = closes[t]
                while idx[t] < len(rows) and rows[idx[t]][0] <= d:
                    last_seen[t] = rows[idx[t]][1]
                    idx[t] += 1
            growth = sum(_growth(starts[t], last_seen[t]) for t in held) / len(held) if held else 1.0
            series.append({"date": d.isoformat(), "growth": growth, "spy": spy[d] / base})
        lasts = dict(last_seen)
    else:
        starts = {t: None for t in held}
        lasts = {t: None for t in held}

    for t in held:
        s = stocks.get(t)
        picks.append(
            {
                "ticker": t,
                "name": s.name if s else None,
                "sector": s.sector if s else None,
                "industry": s.industry if s else None,
                "market_cap": s.market_cap if s else None,
                "start": starts[t],
                "last": lasts[t],
                "growth": _growth(starts[t], lasts[t]),
            }
        )
    picks.sort(key=lambda p: (-p["growth"], p["ticker"]))

    return {
        "id": entry.id,
        "display_name": entry.display_name,
        "cohort": entry.cohort,
        "submitted_on": entry.submitted_on.isoformat(),
        "start_date": start.isoformat() if start else None,
        "as_of": as_of.isoformat() if start and as_of else None,
        "basis": _basis(db),
        "picks": picks,
        "spy_start": spy[start] if start else None,
        "spy_last": spy[as_of] if start and as_of else None,
        "series": series,
    }
