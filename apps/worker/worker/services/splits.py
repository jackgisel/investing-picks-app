"""Stock splits: keep share counts and stored prices on one basis.

A split changes the quote, not the value of a holding. `refresh_marks` writes
the live quote, which is in post-split terms from the ex-date on, so a book
that still holds the pre-split share count reads a 4-for-1 as a 75% loss. The
daily sell pass would act on that loss, and the public return would show it.

Two steps, both idempotent:

1. `apply_position_splits` runs BEFORE `refresh_marks`. For every open
   position (every book, not just the live one) with a split dated on or
   before today, it scales `shares` by the ratio and `avg_cost` by its
   inverse, so cost basis and market value are unchanged. One
   `SplitAdjustment` row per (portfolio, ticker, split date) keeps a second
   run from applying it again. When the job cannot tell which shares the
   split covers (a trade on or after the split date, or a split found more
   than `STALE_DAYS` late) it changes nothing, writes a "review" row, and the
   daily sell pass stays off until someone resolves it.

2. `restate_price_bars` runs AFTER `refresh_marks`, once a post-split bar
   exists. `price_bars` is only topped up a few days at a time, so the bars
   before a split stay on the old basis and momentum reads a step that never
   happened. This finds that step (a one-day move matching the split ratio)
   and divides every bar before it by the ratio.

Trade rows are never rewritten. `benchmarks.trade_ledger` reads the applied
rows and restates older trades in today's share terms.
"""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models import Position, PriceBar, SplitAdjustment, StockSplit, Trade
from worker.services.fmp import FMPAccessError, FMPClient

log = logging.getLogger(__name__)

#: How far back the calendar is read each run. Longer than STALE_DAYS so a
#: split FMP publishes late is still seen, and lands as a review row.
LOOKBACK_DAYS = 14
#: A split older than this when first applied is held for review. The marks
#: job may already have written post-split quotes against the old share count
#: and the sell pass may have acted on them.
STALE_DAYS = 7
#: How far before the split date the price step is searched for. A weekly
#: top-up that ran after the split overwrites a few days before it with
#: adjusted closes, which moves the step earlier than the split date.
STEP_SEARCH_DAYS = 30

APPLIED = "applied"
REVIEW = "review"


def parse_split_rows(rows: list[dict] | None) -> list[tuple[str, date, float, float]]:
    """`(ticker, date, numerator, denominator)` for every well-formed split row.

    Drops anything with a missing or non-positive side and 1-for-1 rows, which
    FMP sometimes lists for share-class events that change nothing.
    """
    out = []
    for row in rows or []:
        ticker = (row.get("symbol") or "").strip().upper()
        try:
            when = date.fromisoformat(str(row.get("date"))[:10])
            num = float(row.get("numerator"))
            den = float(row.get("denominator"))
        except (TypeError, ValueError):
            continue
        if not ticker or num <= 0 or den <= 0 or math.isclose(num, den):
            continue
        out.append((ticker, when, num, den))
    return out


def _has_split_fields(rows: list) -> bool:
    """Whether any row carries the fields `parse_split_rows` reads."""
    keys = {"date", "numerator", "denominator"}
    return any(isinstance(r, dict) and keys <= r.keys() for r in rows)


def _held_tickers(db: Session) -> set[str]:
    return {
        row[0]
        for row in db.query(Position.ticker).filter(Position.shares > 0).distinct().all()
    }


def record_splits(db: Session, fmp: FMPClient, today: date) -> dict:
    """Store every split FMP reports for the recent window.

    The market-wide calendar is the main source. If it fails or is not on the
    plan, each held ticker is looked up on its own, which still protects the
    book; only the price restatement for unheld names is lost that day.
    """
    start = today - timedelta(days=LOOKBACK_DAYS)
    source = "calendar"
    try:
        rows = fmp.splits_calendar(start, today)
    except FMPAccessError:
        log.warning("Split calendar is not on this FMP plan; checking held tickers one by one")
        rows = None
    parsed = parse_split_rows(rows)
    if rows and not _has_split_fields(rows):
        # Rows came back without the fields: the response shape is not what this
        # reads. Treating that as "no splits" would miss every split silently.
        raise RuntimeError(
            f"Split calendar returned {len(rows)} rows without "
            "date/numerator/denominator; check the FMP response fields"
        )
    if rows is None:
        source = "per_ticker"
        parsed = []
        for ticker in sorted(_held_tickers(db)):
            ticker_rows = fmp.stock_splits(ticker)
            if ticker_rows is None:
                # A held name we could not check is a name whose split we
                # could miss, so the caller must not trade on today's marks.
                raise RuntimeError(f"Could not fetch splits for held ticker {ticker}")
            for row in ticker_rows:
                row.setdefault("symbol", ticker)
            ticker_parsed = parse_split_rows(ticker_rows)
            if ticker_rows and not _has_split_fields(ticker_rows):
                raise RuntimeError(
                    f"Splits for {ticker} returned rows without date/numerator/denominator"
                )
            parsed.extend(s for s in ticker_parsed if start <= s[1] <= today)

    added = 0
    for ticker, when, num, den in parsed:
        if when > today:
            continue
        exists = (
            db.query(StockSplit.id)
            .filter(StockSplit.ticker == ticker, StockSplit.date == when)
            .first()
        )
        if exists:
            continue
        db.add(StockSplit(ticker=ticker, date=when, numerator=num, denominator=den))
        added += 1
        log.info("Recorded split %s %s %g-for-%g", ticker, when, num, den)
    db.commit()
    return {"source": source, "seen": len(parsed), "added": added}


def _trade_day(t: Trade) -> date | None:
    ts = t.timestamp
    if ts is None:
        return None
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc)
    return ts.date()


def _last_close_before(db: Session, ticker: str, when: date) -> float | None:
    bar = (
        db.query(PriceBar)
        .filter(PriceBar.ticker == ticker, PriceBar.date < when, PriceBar.close > 0)
        .order_by(PriceBar.date.desc())
        .first()
    )
    return bar.close if bar else None


def _review_reason(db: Session, pos: Position, split: StockSplit, today: date) -> str | None:
    """Why this split cannot be applied automatically, or None if it can."""
    if (today - split.date).days > STALE_DAYS:
        return (
            f"split dated {split.date.isoformat()} was found {(today - split.date).days} "
            "days late; marks may already be post-split"
        )
    trades = (
        db.query(Trade)
        .filter(Trade.portfolio_id == pos.portfolio_id, Trade.ticker == pos.ticker)
        .all()
    )
    late = [t for t in trades if (_trade_day(t) or date.min) >= split.date]
    if late:
        return (
            f"{len(late)} trade(s) on or after the split date; cannot tell which "
            "shares the split covers"
        )
    return None


def apply_position_splits(db: Session, today: date) -> dict:
    """Scale every open position that held through a recorded split.

    Returns `{"applied": [...], "review": [...]}` for splits handled this run,
    plus `"open_reviews"`: every review row still unresolved in any book.
    """
    applied: list[str] = []
    review: list[str] = []
    splits = db.query(StockSplit).filter(StockSplit.date <= today).all()
    by_ticker: dict[str, list[StockSplit]] = {}
    for s in splits:
        by_ticker.setdefault(s.ticker, []).append(s)

    positions = db.query(Position).filter(Position.shares > 0).all()
    for pos in positions:
        for split in sorted(by_ticker.get(pos.ticker, []), key=lambda s: s.date):
            # Bought on or after the split date: the shares were bought at the
            # post-split price, so there is nothing to scale.
            if pos.entry_date is not None and pos.entry_date >= split.date:
                continue
            done = (
                db.query(SplitAdjustment.id)
                .filter(
                    SplitAdjustment.portfolio_id == pos.portfolio_id,
                    SplitAdjustment.ticker == pos.ticker,
                    SplitAdjustment.split_date == split.date,
                )
                .first()
            )
            if done:
                continue
            label = f"{pos.ticker} (book {pos.portfolio_id}) {split.date.isoformat()}"
            reason = _review_reason(db, pos, split, today)
            if reason:
                db.add(
                    SplitAdjustment(
                        portfolio_id=pos.portfolio_id,
                        ticker=pos.ticker,
                        split_date=split.date,
                        ratio=split.ratio,
                        status=REVIEW,
                        reason=reason,
                        shares_before=pos.shares,
                        avg_cost_before=pos.avg_cost,
                    )
                )
                review.append(f"{label}: {reason}")
                log.error("Split held for review: %s: %s", label, reason)
                continue

            ratio = split.ratio
            shares_before, cost_before = pos.shares, pos.avg_cost
            pos.shares = shares_before * ratio
            pos.avg_cost = (cost_before or 0.0) / ratio
            # The mark is pre-split unless a quote landed after the split.
            # Compare it with the last close before the split to tell which.
            pre = _last_close_before(db, pos.ticker, split.date)
            mark = pos.current_price or 0.0
            if mark > 0 and (
                pre is None or abs(math.log(mark / pre)) < abs(math.log(mark * ratio / pre))
            ):
                pos.current_price = mark / ratio
            db.add(
                SplitAdjustment(
                    portfolio_id=pos.portfolio_id,
                    ticker=pos.ticker,
                    split_date=split.date,
                    ratio=ratio,
                    status=APPLIED,
                    shares_before=shares_before,
                    shares_after=pos.shares,
                    avg_cost_before=cost_before,
                    avg_cost_after=pos.avg_cost,
                )
            )
            applied.append(f"{label}: {shares_before:g} -> {pos.shares:g} shares")
            log.info("Applied split %s: %g -> %g shares", label, shares_before, pos.shares)
    db.commit()

    open_reviews = [
        f"{r.ticker} (book {r.portfolio_id}) {r.split_date.isoformat()}: {r.reason}"
        for r in db.query(SplitAdjustment).filter(SplitAdjustment.status == REVIEW).all()
    ]
    return {"applied": applied, "review": review, "open_reviews": open_reviews}


def _step_tolerance(ratio: float) -> float:
    """How close (in log terms) a one-day move must be to the split ratio.

    Tight for small ratios like 5-for-4, where an ordinary bad day can look
    like the split; looser for 2-for-1 and up, where nothing else moves a
    stock that far in a session.
    """
    return min(0.15, abs(math.log(ratio)) / 3)


def restate_price_bars(db: Session, today: date) -> dict:
    """Put each split ticker's older `price_bars` on the post-split basis.

    Waits for a bar on or after the split date (the marks job writes it) so
    the step can be seen. If no step matches the ratio, the stored series was
    already adjusted when it was fetched and nothing changes.
    """
    restated: list[str] = []
    pending: list[str] = []
    rows = (
        db.query(StockSplit)
        .filter(StockSplit.date <= today, StockSplit.prices_adjusted_at.is_(None))
        .all()
    )
    now = datetime.now(timezone.utc)
    for split in rows:
        bars = (
            db.query(PriceBar)
            .filter(
                PriceBar.ticker == split.ticker,
                PriceBar.date <= today,
                PriceBar.close > 0,
            )
            .order_by(PriceBar.date.asc())
            .all()
        )
        if not bars:
            split.prices_adjusted_at = now
            continue
        if bars[-1].date < split.date:
            pending.append(split.ticker)
            continue

        ratio = split.ratio
        tol = _step_tolerance(ratio)
        window_start = split.date - timedelta(days=STEP_SEARCH_DAYS)
        boundary = None
        # Latest matching step wins: everything before it is the old basis.
        for i in range(len(bars) - 1, 0, -1):
            if bars[i].date < window_start:
                break
            step = bars[i].close / bars[i - 1].close
            if abs(math.log(step * ratio)) < tol:
                boundary = i
                break
        if boundary is not None:
            for bar in bars[:boundary]:
                bar.close = bar.close / ratio
            restated.append(f"{split.ticker}: {boundary} bars before {bars[boundary].date}")
            log.info(
                "Restated %s price bars for %s split on %s",
                boundary,
                split.ticker,
                split.date,
            )
        split.prices_adjusted_at = now
    db.commit()
    return {"restated": restated, "waiting_for_post_split_bar": pending}
