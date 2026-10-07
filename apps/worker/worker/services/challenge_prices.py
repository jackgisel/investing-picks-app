"""Adjusted closes for every ticker in a Beat the S&P challenge entry.

Entries live in `challenge_entry` / `challenge_pick`, and
`app/services/challenge.py` scores them on read from `challenge_price`, which
this job fills. Entries run for ten
years, so a split or a dividend will restate a ticker's history many times.
Each run fetches the ticker's whole series from the earliest entry that holds
it; if the vendor's numbers for dates we already store have changed, the
stored series is replaced in one transaction, otherwise only new dates are
appended. Either way a ticker's rows always share one adjustment basis.

SPY is fetched first and decides the basis for the run: dividend-adjusted
closes when the plan serves them, split-adjusted closes otherwise. Every pick
then uses the same endpoint, so an entry is never scored with dividends on one
side of the comparison and not the other.
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from app.db.models import ChallengeEntry, ChallengePick, ChallengePrice, ChallengePriceCheck
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.ingest import first_present, today_et

log = logging.getLogger(__name__)

CHALLENGE_PRICE_JOB = "challenge_prices"
CHALLENGE_PRICE_TIMEOUT_MINUTES = 50.0
CHALLENGE_PRICE_BUDGET_MINUTES = 42.0
BENCHMARK = "SPY"
#: Fetch a few sessions before the earliest submission, so the first session
#: after it is always inside the series even across a long weekend.
LOOKBACK_PAD_DAYS = 10
ACCESS_ERROR_LIMIT = 3
ALL_EMPTY_ALARM = 25
INSERT_CHUNK = 2000
#: Closes that differ by more than this (relative) mean the vendor restated
#: the series, so it is replaced rather than appended to.
RESTATE_TOLERANCE = 1e-6

TOTAL_RETURN = "total_return"
PRICE = "price"


def entries_exist(db: Session) -> bool:
    """False on a database that has not been migrated since the challenge shipped."""
    insp = inspect(db.get_bind())
    return insp.has_table("challenge_entry") and insp.has_table("challenge_pick")


def tickers_needed(db: Session) -> dict[str, date]:
    """Each ticker held by any entry, with the earliest submission holding it."""
    rows = (
        db.query(ChallengePick.ticker, func.min(ChallengeEntry.submitted_on))
        .join(ChallengeEntry, ChallengeEntry.id == ChallengePick.entry_id)
        .group_by(ChallengePick.ticker)
        .all()
    )
    out: dict[str, date] = {str(t).upper(): first for t, first in rows}
    if out:
        out[BENCHMARK] = min([*out.values(), out.get(BENCHMARK, date.max)])
    return out


def parse_closes(rows: list[dict], basis: str, start: date, cutoff: date) -> dict[date, float]:
    """Dated closes from an FMP payload. Dividend-adjusted rows must carry adjClose."""
    fields = ("adjClose",) if basis == TOTAL_RETURN else ("adjClose", "close")
    out: dict[date, float] = {}
    for row in rows or []:
        raw = row.get("date")
        close = first_present(row, *fields)
        if not raw or close is None:
            continue
        try:
            d = date.fromisoformat(str(raw)[:10])
            c = float(close)
        except (TypeError, ValueError):
            continue
        if c <= 0 or d < start or d >= cutoff:
            continue
        out[d] = c
    return out


def choose_basis(fmp: FMPClient, start: date) -> tuple[str, list[dict] | None]:
    """Dividend-adjusted if the plan serves it for SPY, split-adjusted otherwise.

    Returns the basis and SPY's rows, so the benchmark is not fetched twice.
    """
    try:
        rows = fmp.dividend_adjusted_series(BENCHMARK, start)
    except FMPAccessError:
        log.info("dividend-adjusted prices are not on this plan; scoring on price")
        rows = None
    if rows and any(r.get("adjClose") is not None for r in rows):
        return TOTAL_RETURN, rows
    return PRICE, fmp.historical_price_series(BENCHMARK, start)


def fetch_series(fmp: FMPClient, ticker: str, start: date, basis: str) -> list[dict] | None:
    if basis == TOTAL_RETURN:
        return fmp.dividend_adjusted_series(ticker, start)
    return fmp.historical_price_series(ticker, start)


def store(
    db: Session,
    ticker: str,
    closes: dict[date, float],
    basis: str,
    now: datetime,
) -> bool:
    """Write one ticker's series. Returns True when the stored series was replaced."""
    existing = dict(
        db.query(ChallengePrice.date, ChallengePrice.close)
        .filter(ChallengePrice.ticker == ticker)
        .all()
    )
    check = db.get(ChallengePriceCheck, ticker)
    same_basis = check is not None and check.basis == basis
    restated = any(
        abs(existing[d] - c) > RESTATE_TOLERANCE * max(1.0, abs(c))
        for d, c in closes.items()
        if d in existing
    )
    replace = bool(existing) and (restated or not same_basis)
    if replace:
        db.query(ChallengePrice).filter(ChallengePrice.ticker == ticker).delete()
        new = closes
    else:
        new = {d: c for d, c in closes.items() if d not in existing}
    rows = [{"ticker": ticker, "date": d, "close": c} for d, c in sorted(new.items())]
    for i in range(0, len(rows), INSERT_CHUNK):
        db.bulk_insert_mappings(ChallengePrice, rows[i : i + INSERT_CHUNK])
    check = check or ChallengePriceCheck(ticker=ticker)
    check.checked_at = now
    check.bars = len(closes)
    check.basis = basis
    check.replaced = replace
    db.merge(check)
    db.commit()
    return replace


def _last_checked(check: ChallengePriceCheck | None) -> datetime:
    """When a ticker was last fetched, as an aware datetime; never checked sorts first."""
    if check is None or check.checked_at is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    at = check.checked_at
    return at if at.tzinfo else at.replace(tzinfo=timezone.utc)


#: A ticker fetched this recently is not fetched again by a rerun.
FRESH_HOURS = 12


def _is_fresh(check: ChallengePriceCheck | None, now: datetime) -> bool:
    return now - _last_checked(check) < timedelta(hours=FRESH_HOURS)


def challenge_prices(
    db: Session,
    fmp: FMPClient,
    today: date | None = None,
    cutoff: date | None = None,
    budget_seconds: float = CHALLENGE_PRICE_BUDGET_MINUTES * 60,
    now: datetime | None = None,
) -> dict:
    """Refresh every challenge ticker's series. Resumable within a day.

    `cutoff` excludes bars on or after it; the scheduled run passes tomorrow
    (it runs after the close), a manual mid-session run passes today so an
    unfinished session is never stored as a close.
    """
    if not entries_exist(db):
        return {"skipped": "no entry tables yet"}
    today = today or today_et()
    cutoff = cutoff or today
    now = now or datetime.now(timezone.utc)
    needed = tickers_needed(db)
    if not needed:
        return {"skipped": "no entries"}

    checks = {c.ticker: c for c in db.query(ChallengePriceCheck).all()}
    # Benchmark first (it sets the basis), then whatever was refreshed longest ago.
    others = sorted(
        (t for t in needed if t != BENCHMARK),
        key=lambda t: (_last_checked(checks.get(t)), t),
    )

    started = time.monotonic()
    spy_start = needed[BENCHMARK] - timedelta(days=LOOKBACK_PAD_DAYS)
    basis, spy_rows = choose_basis(fmp, spy_start)
    if spy_rows is None:
        raise RuntimeError("challenge prices: the benchmark series did not load")
    spy = parse_closes(spy_rows, basis, spy_start, cutoff)
    if not spy:
        raise RuntimeError("challenge prices: the benchmark series came back empty")
    replaced = int(store(db, BENCHMARK, spy, basis, now))

    fetched = with_bars = empty = errors = skipped = 0
    access_streak = 0
    for ticker in others:
        if time.monotonic() - started > budget_seconds:
            break
        if _is_fresh(checks.get(ticker), now) and checks[ticker].basis == basis:
            skipped += 1
            continue
        start = needed[ticker] - timedelta(days=LOOKBACK_PAD_DAYS)
        try:
            rows = fetch_series(fmp, ticker, start, basis)
        except FMPAccessError:
            access_streak += 1
            if access_streak >= ACCESS_ERROR_LIMIT:
                log.exception("challenge prices: price history is not available; stopping")
                raise
            errors += 1
            continue
        access_streak = 0
        if rows is None:
            errors += 1
            continue
        closes = parse_closes(rows, basis, start, cutoff)
        replaced += int(store(db, ticker, closes, basis, now))
        fetched += 1
        if closes:
            with_bars += 1
        else:
            empty += 1

    if fetched + errors >= ALL_EMPTY_ALARM and with_bars == 0:
        raise RuntimeError(
            f"challenge prices: no bars for {fetched} names ({errors} failed requests)"
        )
    return {
        "as_of": today.isoformat(),
        "basis": basis,
        "tickers": len(needed),
        "fetched": fetched + 1,
        "with_bars": with_bars + 1,
        "empty": empty,
        "errors": errors,
        "skipped_fresh": skipped,
        "replaced": replaced,
        "remaining": len(others) - fetched - errors - skipped,
    }
