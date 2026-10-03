"""Five years of daily closes for factor studies, in their own table.

The live book keeps ~14 months of closes in `price_bars` for the momentum
factor. A factor study needs a longer window, but widening that table would put
a long adjusted history next to bars written under an older adjustment, so any
name that split in between would show a fabricated jump. This writes a separate
table (`price_bars_deep`), one fetch per ticker, replacing that ticker's rows on
a refetch so a series always has one price basis. Drop the table and nothing
live notices.
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import DeepPriceBar, DeepPriceCheck, Stock
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.ingest import held_tickers, parse_historical_bars, today_et

log = logging.getLogger(__name__)

DEEP_PRICE_JOB = "price_history_deep"
DEEP_PRICE_TIMEOUT_MINUTES = 50.0
DEEP_PRICE_BUDGET_MINUTES = 44.0
LOOKBACK_DAYS = 1830
#: A ticker with a full fetch on record is refreshed this rarely (one fetch
#: replaces its rows, so each refresh is a whole new, consistent series).
REFRESH_DAYS = 90
#: A ticker FMP had no bars for is looked at again this often.
RETRY_EMPTY_DAYS = 30
ACCESS_ERROR_LIMIT = 3
ALL_EMPTY_ALARM = 25
INSERT_CHUNK = 2000


def _age_days(at: datetime, now: datetime) -> float:
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return (now - at).total_seconds() / 86400


def tickers_to_fetch(db: Session, now: datetime | None = None) -> list[str]:
    """Live-universe names that need a (re)fetch, held and largest first."""
    now = now or datetime.now(timezone.utc)
    held = held_tickers(db)
    rows = (
        db.query(Stock.ticker, Stock.market_cap)
        .filter(Stock.is_active == True)  # noqa: E712
        .all()
    )
    rows.sort(key=lambda r: (r[0] not in held, -(r[1] or 0), r[0]))
    checks = {c.ticker: c for c in db.query(DeepPriceCheck).all()}
    out: list[str] = []
    for ticker, _ in rows:
        check = checks.get(ticker)
        if check is None:
            out.append(ticker)
            continue
        limit = REFRESH_DAYS if check.bars > 0 else RETRY_EMPTY_DAYS
        if _age_days(check.checked_at, now) >= limit:
            out.append(ticker)
    return out


def _store(db: Session, ticker: str, bars: list[dict], now: datetime) -> None:
    """Replace one ticker's rows with a fresh series, in a single transaction."""
    db.query(DeepPriceBar).filter(DeepPriceBar.ticker == ticker).delete()
    for i in range(0, len(bars), INSERT_CHUNK):
        db.bulk_insert_mappings(DeepPriceBar, bars[i : i + INSERT_CHUNK])
    check = db.get(DeepPriceCheck, ticker) or DeepPriceCheck(ticker=ticker)
    check.checked_at = now
    check.bars = len(bars)
    check.first_bar = min((b["date"] for b in bars), default=None)
    db.merge(check)
    db.commit()


def deep_price_history(
    db: Session,
    fmp: FMPClient,
    today: date | None = None,
    budget_seconds: float = DEEP_PRICE_BUDGET_MINUTES * 60,
    lookback_days: int = LOOKBACK_DAYS,
) -> dict:
    """Fetch five years of closes for every name that needs it. Resumable.

    Each ticker commits (and records a check) as it goes, so a run that stops
    on its time budget, or is killed by a deploy, loses at most the ticker in
    flight and picks up at the next one. A failed request records nothing, so
    it is simply asked again; an empty answer is recorded and retried monthly.
    """
    today = today or today_et()
    start = today - timedelta(days=lookback_days)
    started = time.monotonic()
    queue = tickers_to_fetch(db)

    fetched = with_bars = empty = errors = total_bars = 0
    access_streak = 0
    for ticker in queue:
        if time.monotonic() - started > budget_seconds:
            break
        try:
            rows = fmp.historical_price_series(ticker, start)
        except FMPAccessError:
            access_streak += 1
            if access_streak >= ACCESS_ERROR_LIMIT:
                log.exception("historical prices are not available; stopping")
                raise
            errors += 1
            continue
        access_streak = 0
        if rows is None:
            errors += 1
            continue
        bars, _, _ = parse_historical_bars(ticker, rows, start, today)
        unique = list({b["date"]: b for b in bars}.values())
        _store(db, ticker, unique, datetime.now(timezone.utc))
        fetched += 1
        total_bars += len(unique)
        if unique:
            with_bars += 1
        else:
            empty += 1
        if fetched % 50 == 0:
            log.info("Deep price history progress: %s/%s", fetched, len(queue))

    if fetched + errors >= ALL_EMPTY_ALARM and with_bars == 0:
        raise RuntimeError(
            f"deep prices: no bars for {fetched} names ({errors} failed requests)"
        )
    return {
        "as_of": today.isoformat(),
        "window_start": start.isoformat(),
        "queued": len(queue),
        "fetched": fetched,
        "with_bars": with_bars,
        "empty": empty,
        "errors": errors,
        "bars": total_bars,
        "remaining": len(queue) - fetched - errors,
    }


def coverage(db: Session) -> dict:
    """Ops view: what the deep table holds."""
    tickers = db.query(func.count(DeepPriceCheck.ticker)).filter(DeepPriceCheck.bars > 0).scalar() or 0
    empty = db.query(func.count(DeepPriceCheck.ticker)).filter(DeepPriceCheck.bars == 0).scalar() or 0
    first = db.query(func.min(DeepPriceBar.date)).scalar()
    last = db.query(func.max(DeepPriceBar.date)).scalar()
    return {
        "tickers_with_bars": tickers,
        "tickers_empty": empty,
        "bars": db.query(func.count(DeepPriceBar.id)).scalar() or 0,
        "first_bar": first.isoformat() if first else None,
        "last_bar": last.isoformat() if last else None,
    }
