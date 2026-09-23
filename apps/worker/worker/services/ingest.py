"""Ingest universe + fundamentals + marks via FMP."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import NamedTuple
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS

from app.db.models import (
    CompositeScore,
    ConsensusSnapshot,
    EarningsHistory,
    Fundamentals,
    Portfolio,
    PortfolioSnapshot,
    Position,
    PriceBar,
    MacroReading,
    Stock,
    StockNews,
)
from app.services.benchmarks import BENCHMARKS
from app.services.portfolio import ensure_default_portfolio
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.market_calendar import last_trading_day_on_or_before

log = logging.getLogger(__name__)

#: Comparison ETFs that must keep a daily bar, including VOO for the DCA sample.
#: Not the same set as BENCHMARKS — VOO must not appear on the live picks chart.
INGEST_ETFS: tuple[str, ...] = (*BENCHMARKS, "VOO")

# How far back to look for the consensus estimate we compare against. Weekly
# fundamentals refreshes mean roughly one snapshot per 7 days, so ~3 weeks
# approximates the conventional 1-month revision window.
REVISION_LOOKBACK_DAYS = 21

# Shortest window that can carry a real revision signal. Consensus estimates
# barely move day to day, so comparing snapshots a day apart returns 0.0% for
# most of the universe — not "no change worth noting" but a tie block that
# percentile ranking then has to resolve. Below this we report NO revision,
# which under the factor-coverage floor leaves the ticker unscored rather than
# scored on a fabricated factor. A weekly refresh clears it comfortably.
MIN_REVISION_LOOKBACK_DAYS = 5

# FMP's fiscal year-end date on the same FY can move by a few days (Western
# Digital's Friday-nearest-June-30 jumped 2027-06-27 → 2027-07-03). Exact
# string equality then treated it as a rollover, nulled revisions, and the
# coverage floor unrated a held name. Real next-year periods are ~365 days
# apart, so a two-week window is jitter, not a new year.
PERIOD_MATCH_TOLERANCE_DAYS = 14

# Daily consensus poll: live floors are $300M / $5, but names just under those
# lines must already have a vintage the week they cross, otherwise they are
# unscored on the first evaluation Friday they become eligible.
SNAPSHOT_MARKET_CAP_FLOOR = 250_000_000
SNAPSHOT_SHARE_PRICE_FLOOR = 4.0
SNAPSHOT_SCREENER_LIMIT = 1200
CONSENSUS_SNAPSHOT_TIMEOUT_MINUTES = 20.0
CONSENSUS_SNAPSHOT_JOB = "consensus_snapshot"
CONSENSUS_SNAPSHOT_GAP_JOB = "consensus_snapshot_gap"
_ET = ZoneInfo("America/New_York")


def held_tickers(db: Session) -> set[str]:
    """Open position tickers across every book, not just the live one."""
    return {row[0] for row in db.query(Position.ticker).distinct().all()}


#: How many of the top-rated non-held tickers get a news pull. Wider than the
#: 3-name editorial watchlist on purpose — news is sparse, and the spotlight
#: thread's news focus needs headlines to actually exist on most days, not
#: just for the handful of names shown in the dashboard's watchlist.
NEWS_UNIVERSE_SIZE = 20

#: News older than this is pruned and never served — the spotlight thread's
#: "news" focus is meant to read as current, not a rehash of last week.
NEWS_RETENTION_DAYS = 14


def news_universe_tickers(db: Session, limit: int = NEWS_UNIVERSE_SIZE) -> list[str]:
    """Held tickers plus the highest-rated names outside the book.

    Deliberately excludes the general tape: a news feed for names our own
    screen has no opinion on is not something the spotlight thread can use —
    every claim it makes has to trace back to the payload, and an FMP
    headline about a ticker we've never scored is not in the payload for any
    other reason.
    """
    held = held_tickers(db)
    latest = db.query(func.max(CompositeScore.as_of)).scalar()
    if latest is None:
        return sorted(held)
    top_rated = (
        db.query(CompositeScore.ticker)
        .filter(CompositeScore.as_of == latest)
        .order_by(CompositeScore.quant_rating.desc())
        .limit(limit + len(held))
        .all()
    )
    non_held = [t for (t,) in top_rated if t not in held][:limit]
    return sorted(held | set(non_held))


def _parse_fmp_news_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# Law-firm class-action solicitations ride the same news feed as real
# reporting and are formulaic enough to catch on title alone — confirmed
# live in the first production pull (a "ROSEN... Encourages Investors to
# Secure Counsel" release for a tracked ticker). The spotlight thread must
# never report on a lawsuit against a name we track; that is legally
# sensitive territory this feature was never built to navigate, and it is
# not "news" in the sense the thread means it — it is a solicitation.
_LAWSUIT_SOLICITATION_MARKERS = (
    "class action",
    "securities fraud",
    "investor rights",
    "shareholder rights",
    "encourages investors",
    "encouraged to secure counsel",
    "lead plaintiff",
)


def _is_lawsuit_solicitation(title: str) -> bool:
    lowered = title.lower()
    return any(marker in lowered for marker in _LAWSUIT_SOLICITATION_MARKERS)


def refresh_news(db: Session, fmp: FMPClient, tickers: list[str]) -> int:
    """Pull recent headlines for `tickers` and upsert into `stock_news`.

    `url` carries the dedupe: the same article re-appearing on the next tick
    is a no-op, not a duplicate row. Anything past `NEWS_RETENTION_DAYS` is
    deleted on every run so the table stays small and a "current" reading
    never accidentally serves stale news.
    """
    if not tickers:
        return 0
    rows = fmp.stock_news(tickers, limit=100)

    existing_urls = {
        url for (url,) in db.query(StockNews.url).filter(
            StockNews.url.in_([r["url"] for r in rows if r.get("url")])
        )
    }
    # A ticker whose news mentions another symbol we also queried can hand
    # back the same article twice in one response — tracked separately from
    # `existing_urls` because that set is fixed before this loop starts and
    # would not catch a duplicate appearing later in the same batch.
    seen_urls: set[str] = set()

    inserted = 0
    for row in rows:
        url = row.get("url")
        title = row.get("title")
        published = _parse_fmp_news_date(row.get("publishedDate"))
        if not url or not title or not published:
            continue
        if url in existing_urls or url in seen_urls:
            continue
        if _is_lawsuit_solicitation(title):
            continue
        seen_urls.add(url)
        db.add(
            StockNews(
                ticker=row.get("symbol"),
                published_at=published,
                publisher=row.get("publisher"),
                title=title,
                url=url,
            )
        )
        inserted += 1
    if inserted:
        db.commit()

    cutoff = datetime.now(timezone.utc) - timedelta(days=NEWS_RETENTION_DAYS)
    db.query(StockNews).filter(StockNews.published_at < cutoff).delete()
    db.commit()
    return inserted


def first_present(row: dict, *keys):
    """First key in `keys` carrying a non-None value, else None.

    `row.get(a, row.get(b))` is NOT this: the default is only consulted when `a`
    is ABSENT, so a payload that sends `a` explicitly as null returns None and
    never looks at `b`. FMP does send explicit nulls for fields it has no value
    for, so every such row was discarded even though a usable value sat beside
    it — a hole in the price history at the 12-month anchor makes `_momentum_12m`
    return None, which under `min_factor_coverage = 1.0` makes the whole ticker
    unscoreable, hence neither buyable NOR sellable.
    """
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


#: Field priority for a daily close, shared by BOTH writers of `price_bars`
#: (`backfill_price_history` here and `backfill._parse_series`). They used to
#: disagree — ingest read adjClose first, _parse_series read close first — and
#: `upsert_price_bar` overwrites on conflict, so for a ticker that split, the
#: series jumped by the split ratio at whatever date boundary the two jobs
#: happened to divide, which `_momentum_12m` reads as a fabricated -67%/+200%
#: annual return on a stock whose price never moved.
#:
#: adjClose wins where FMP supplies it. It is expressed in TODAY's share terms,
#: which is the only basis consistent with the two things it is compared
#: against: the live unadjusted quote `refresh_marks` writes for today, and the
#: CURRENT `Position.shares` count `backfill` multiplies it by. An unadjusted
#: pre-split close is neither. Where FMP omits adjClose (or sends it null) this
#: degrades to `close`, which is exactly the previous behaviour — so this is
#: safe whether or not `/stable/historical-price-eod/full` carries the field.
CLOSE_FIELDS = ("adjClose", "close")


def parse_historical_bars(
    ticker: str, rows: list[dict], start: date, cutoff: date
) -> tuple[list[dict], int, int]:
    """Turn an FMP historical-price payload into `price_bars` rows.

    Returns `(bars, rows_seen, rows_adjusted)`. Zero and negative closes are
    dropped — they are data holes, not sessions.
    """
    bars: list[dict] = []
    seen = 0
    adjusted = 0
    for row in rows or []:
        seen += 1
        if row.get("adjClose") is not None:
            adjusted += 1
        raw_date = row.get("date")
        close = first_present(row, *CLOSE_FIELDS)
        if not raw_date or close is None:
            continue
        try:
            bar_date = date.fromisoformat(str(raw_date)[:10])
            close = float(close)
        except (TypeError, ValueError):
            continue
        if close <= 0 or bar_date >= cutoff or bar_date < start:
            continue
        bars.append({"ticker": ticker, "date": bar_date, "close": close})
    return bars, seen, adjusted


def ingest_ticker_history(
    db: Session, fmp: FMPClient, ticker: str, start: date, cutoff: date
) -> tuple[int, int, int]:
    """Fetch one ticker's history and insert missing bars.

    Returns `(rows_seen, rows_adjusted, bars_attempted)`.
    """
    rows = fmp.historical_prices(ticker, start)
    bars, seen, adjusted = parse_historical_bars(ticker, rows, start, cutoff)
    inserted = 0
    if bars:
        unique = {(b["ticker"], b["date"]): b for b in bars}
        inserted = bulk_insert_price_bars(db, list(unique.values()))
    return seen, adjusted, inserted


def ensure_benchmark_history(
    db: Session,
    fmp: FMPClient,
    lookback_days: int = 430,
    min_bars: int = 200,
) -> dict:
    """Give comparison ETFs a real series instead of waiting until Saturday.

    `refresh_marks` only writes today. QQQ was added to BENCHMARKS on a Sunday;
    `backfill_prices` had already run that Saturday, so the landing chart
    published five live quotes against April cash flows and Nasdaq-100 printed
    -100%. This fetch is a handful of tickers, only when a series is short, and
    skips today so it never overwrites the live mark written below.
    """
    fetch = getattr(fmp, "historical_prices", None)
    if not callable(fetch):
        return {"tickers": 0, "bars": 0}

    start = date.today() - timedelta(days=lookback_days)
    cutoff = date.today()
    coverage = {
        ticker: int(n or 0)
        for ticker, n in (
            db.query(PriceBar.ticker, func.count(PriceBar.id))
            .filter(PriceBar.ticker.in_(list(INGEST_ETFS)))
            .group_by(PriceBar.ticker)
            .all()
        )
    }
    fetched = 0
    inserted = 0
    for ticker in INGEST_ETFS:
        if coverage.get(ticker, 0) >= min_bars:
            continue
        try:
            _seen, _adjusted, n = ingest_ticker_history(db, fmp, ticker, start, cutoff)
        except FMPAccessError:
            log.exception("historical prices unavailable; stopping benchmark backfill")
            break
        fetched += 1
        inserted += n
        log.info("Benchmark history %s: %s bars attempted", ticker, n)
    return {"tickers": fetched, "bars": inserted}


def upsert_price_bar(db: Session, ticker: str, bar_date: date, close: float) -> PriceBar:
    """Insert-or-update one daily bar.

    `db.merge(PriceBar(...))` does NOT work here: with no primary key set, merge
    treats the object as pending and emits an INSERT, which the
    UniqueConstraint("ticker", "date") then rejects. That crashed any second
    marks run in the same day — which is exactly what happens on evaluation
    Fridays, when the biweekly job marks at 11:00 and the daily job marks again
    at 18:30.
    """
    existing = (
        db.query(PriceBar)
        .filter(PriceBar.ticker == ticker, PriceBar.date == bar_date)
        .one_or_none()
    )
    if existing:
        existing.close = close
        return existing
    bar = PriceBar(ticker=ticker, date=bar_date, close=close)
    db.add(bar)
    db.flush()
    return bar


def bulk_insert_price_bars(db: Session, rows: list[dict], chunk_size: int = 2000) -> int:
    """Insert many bars, skipping any that already exist. Returns rows attempted.

    `upsert_price_bar` is correct for the update-in-place case but does a
    SELECT + INSERT + flush per bar — unusable for a history backfill of ~160k
    rows. Reading the existing keys first and inserting the difference would be
    check-then-act: `refresh_marks` writes bars for the same tickers on its own
    schedule, and on Postgres one unique violation aborts the whole statement
    AND transaction, losing every other row in the batch.

    ON CONFLICT DO NOTHING pushes the race to the database, which makes this
    both concurrency-safe and idempotent — a killed run resumes by simply being
    re-run. Both Postgres and SQLite support it (SQLite since 3.24).

    DO NOTHING rather than DO UPDATE is deliberate: `refresh_marks` stores a
    live quote for today, and this must never overwrite it with an EOD bar.
    """
    if not rows:
        return 0

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:  # pragma: no cover - only these two are ever deployed
        for row in rows:
            upsert_price_bar(db, row["ticker"], row["date"], row["close"])
        db.commit()
        return len(rows)

    written = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        stmt = _insert(PriceBar.__table__).values(chunk)
        db.execute(stmt.on_conflict_do_nothing(index_elements=["ticker", "date"]))
        # Commit per chunk so a killed job leaves durable progress rather than
        # rolling back the entire backfill.
        db.commit()
        written += len(chunk)
    return written


def today_et() -> date:
    """Calendar date in America/New_York — the poll date for a snapshot."""
    return datetime.now(timezone.utc).astimezone(_ET).date()


def snapshot_universe_tickers(db: Session, fmp: FMPClient) -> list[str]:
    """Screener-eligible names plus a buffer under the live floors, plus holdings.

    Does not admit anyone to `stocks` — live scoring still uses refresh_universe
    and the $300M/$5 cut. Writing a Stock row here would leak below-floor names
    into the live scorer the week their cap ticks up on a quote but the Saturday
    screen has not yet run.
    """
    rows = fmp.stock_screener(
        min_market_cap=SNAPSHOT_MARKET_CAP_FLOOR, limit=SNAPSHOT_SCREENER_LIMIT
    )
    tickers: set[str] = set()
    for row in rows:
        ticker = (row.get("symbol") or "").upper()
        if not ticker or "." in ticker:
            continue
        raw_price = row.get("price")
        try:
            price = float(raw_price) if raw_price is not None else None
        except (TypeError, ValueError):
            price = None
        if price is None or price < SNAPSHOT_SHARE_PRICE_FLOOR:
            continue
        tickers.add(ticker)
    for (ticker,) in (
        db.query(Stock.ticker)
        .filter(Stock.is_active == True, Stock.is_etf == False)  # noqa: E712
        .all()
    ):
        tickers.add(ticker)
    tickers |= held_tickers(db)
    return sorted(tickers)


def _optional_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value) -> int | None:
    number = _optional_float(value)
    if number is None:
        return None
    return int(number)


def parse_consensus_estimate(row: dict) -> dict | None:
    """One FMP analyst-estimates row → a consensus_snapshots insert dict.

    Accepts both `/stable` names (`epsAvg`) and the legacy `estimated*` prefix
    so vintages taken under either shape stay comparable.
    """
    period = _parse_period(row.get("date"))
    if period is None:
        return None
    analyst_count = _optional_int(
        first_present(
            row,
            "numAnalystsEps",
            "numberAnalystsEstimatedEps",
            "numberAnalystEstimatedEps",
            "numAnalystsRevenue",
            "numberAnalystEstimatedRevenue",
            "analystsCount",
        )
    )
    return {
        "fiscal_period": period,
        "eps_avg": _optional_float(first_present(row, "epsAvg", "estimatedEpsAvg")),
        "eps_high": _optional_float(first_present(row, "epsHigh", "estimatedEpsHigh")),
        "eps_low": _optional_float(first_present(row, "epsLow", "estimatedEpsLow")),
        "revenue_avg": _optional_float(
            first_present(row, "revenueAvg", "estimatedRevenueAvg")
        ),
        "revenue_high": _optional_float(
            first_present(row, "revenueHigh", "estimatedRevenueHigh")
        ),
        "revenue_low": _optional_float(
            first_present(row, "revenueLow", "estimatedRevenueLow")
        ),
        "analyst_count": analyst_count,
        "raw": dict(row),
    }


def bulk_insert_consensus_snapshots(
    db: Session, rows: list[dict], chunk_size: int = 500
) -> int:
    """Insert vintages, skipping any that already exist. Returns rows attempted.

    Append-only: ON CONFLICT DO NOTHING, never DO UPDATE. A same-day retry
    must not rewrite a vintage we already observed.
    """
    if not rows:
        return 0

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:  # pragma: no cover - only these two are ever deployed
        for row in rows:
            existing = (
                db.query(ConsensusSnapshot)
                .filter(
                    ConsensusSnapshot.ticker == row["ticker"],
                    ConsensusSnapshot.as_of == row["as_of"],
                    ConsensusSnapshot.fiscal_period == row["fiscal_period"],
                )
                .one_or_none()
            )
            if existing is None:
                db.add(ConsensusSnapshot(**row))
        db.commit()
        return len(rows)

    written = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        stmt = _insert(ConsensusSnapshot.__table__).values(chunk)
        db.execute(
            stmt.on_conflict_do_nothing(
                index_elements=["ticker", "as_of", "fiscal_period"]
            )
        )
        db.commit()
        written += len(chunk)
    return written


def missing_snapshot_weekdays(db: Session, today: date) -> list[date]:
    """Mon–Fri dates after the first vintage with no consensus_snapshots row.

    Empty table → no gaps (the clock has not started). Weekends are not
    expected. A hole on a weekday is permanent and must alert.
    """
    first = db.query(func.min(ConsensusSnapshot.as_of)).scalar()
    if first is None:
        return []
    present = {
        d
        for (d,) in db.query(ConsensusSnapshot.as_of)
        .filter(ConsensusSnapshot.as_of >= first, ConsensusSnapshot.as_of < today)
        .distinct()
        .all()
    }
    missing: list[date] = []
    cursor = first
    while cursor < today:
        if cursor.weekday() < 5 and cursor not in present:
            missing.append(cursor)
        cursor += timedelta(days=1)
    return missing


def snapshot_consensus(
    db: Session, fmp: FMPClient, as_of: date | None = None
) -> dict:
    """Poll FMP analyst-estimates for the snapshot universe and append vintages.

    Idempotent per (ticker, as_of, fiscal_period). Raises if the universe is
    empty or every ticker comes back with no estimates — those are the silent
    failures that would punch a hole in the window forever.
    """
    as_of = as_of or today_et()
    gaps = [d.isoformat() for d in missing_snapshot_weekdays(db, as_of)]
    if gaps:
        log.error("Consensus snapshot gaps before %s: %s", as_of, ", ".join(gaps))

    tickers = snapshot_universe_tickers(db, fmp)
    if not tickers:
        raise RuntimeError("consensus snapshot universe is empty")

    rows_attempted = 0
    tickers_ok = 0
    tickers_empty = 0
    for i, ticker in enumerate(tickers, 1):
        try:
            estimates = fmp.analyst_estimates(ticker)
        except FMPAccessError:
            log.exception(
                "analyst-estimates is not available; stopping consensus snapshot "
                "so the hole is visible instead of a green run of zeros"
            )
            raise
        parsed: list[dict] = []
        for row in estimates or []:
            item = parse_consensus_estimate(row)
            if item is None:
                continue
            item["ticker"] = ticker
            item["as_of"] = as_of
            item["fetched_at"] = datetime.now(timezone.utc)
            parsed.append(item)
        # Dedup fiscal periods in one payload; last row wins inside the batch
        # but ON CONFLICT will keep the first persisted vintage.
        unique = {(r["ticker"], r["as_of"], r["fiscal_period"]): r for r in parsed}
        rows_attempted += bulk_insert_consensus_snapshots(db, list(unique.values()))
        if unique:
            tickers_ok += 1
        else:
            tickers_empty += 1
        if i % 25 == 0:
            log.info("Consensus snapshot progress: %s/%s", i, len(tickers))

    if tickers_ok == 0:
        raise RuntimeError(
            f"consensus snapshot stored 0 estimates for {len(tickers)} tickers"
        )
    log.info(
        "Consensus snapshot %s: %s/%s tickers with estimates, %s rows attempted",
        as_of,
        tickers_ok,
        len(tickers),
        rows_attempted,
    )
    return {
        "as_of": as_of.isoformat(),
        "universe": len(tickers),
        "tickers_with_estimates": tickers_ok,
        "tickers_empty": tickers_empty,
        "rows_attempted": rows_attempted,
        "missing_prior_days": gaps,
    }


def refresh_universe(db: Session, fmp: FMPClient, limit: int = 800) -> int:
    params = RUN118_PARAMS
    rows = fmp.stock_screener(min_market_cap=params.min_universe_market_cap, limit=limit)
    count = 0
    for row in rows:
        ticker = (row.get("symbol") or "").upper()
        if not ticker or "." in ticker:
            continue
        # An unverifiable price is not an acceptable one. This was
        # `price = row.get("price") or 0` followed by
        # `if price and price < min_share_price` — a missing or zero price
        # (halted names, thinly-traded shells) is falsy, so the $5 floor was
        # skipped entirely and the ticker was admitted. `refresh_universe` is
        # the ONLY code path in the repo that reads `min_share_price` and
        # nothing ever re-applies it to an existing Stock row, so that
        # admission was permanent: the name then collected fundamentals, got
        # scored, and was buyable at $0.80.
        raw_price = row.get("price")
        try:
            price = float(raw_price) if raw_price is not None else None
        except (TypeError, ValueError):
            price = None
        if price is None or price < params.min_share_price:
            continue
        stock = db.get(Stock, ticker)
        if not stock:
            stock = Stock(ticker=ticker)
            db.add(stock)
        stock.name = row.get("companyName") or stock.name
        stock.sector = row.get("sector") or stock.sector
        stock.industry = row.get("industry") or stock.industry
        stock.market_cap = row.get("marketCap") or stock.market_cap
        stock.is_etf = False
        stock.is_active = True
        stock.last_price = price or stock.last_price
        stock.updated_at = datetime.now(timezone.utc)
        count += 1
    db.commit()
    log.info("Universe refresh: %s tickers", count)
    return count


def _forward_estimate(
    estimates: list[dict], as_of: date, nth: int = 0
) -> dict | None:
    """The consensus row for the nearest fiscal period ending on/after `as_of`.

    FMP returns one row per fiscal year, past and future, unordered in practice.
    Revisions must always be measured against the *same* fiscal period, so we
    pin the period explicitly rather than trusting list position.

    `nth=1` is the fiscal year after that (FY2). It has no fallback: when no
    second upcoming period exists the answer is None, not FY1 again.
    """
    rows: list[tuple[date, dict]] = []
    for e in estimates or []:
        raw = e.get("date")
        if not raw:
            continue
        try:
            period = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        rows.append((period, e))
    if not rows:
        return None
    upcoming = sorted([r for r in rows if r[0] >= as_of], key=lambda r: r[0])
    if nth:
        if len(upcoming) <= nth:
            return None
        period, row = upcoming[nth]
    else:
        period, row = upcoming[0] if upcoming else max(rows, key=lambda r: r[0])
    return {
        "estimatePeriod": period.isoformat(),
        # `/stable` dropped the `estimated` prefix the legacy API used; accept
        # both so stored snapshots taken under either shape stay comparable.
        # `first_present`, not `row.get(a, row.get(b))`: an explicit
        # `"epsAvg": null` would otherwise shadow a usable `estimatedEpsAvg` in
        # the same row, leaving epsEstimateAvg None — and a null estimate makes
        # compute_estimate_revisions return {}, which nulls the revisions factor
        # (weight 0.30, gates every buy via min_revisions_grade).
        "epsEstimateAvg": first_present(row, "epsAvg", "estimatedEpsAvg"),
        "revenueEstimateAvg": first_present(
            row, "revenueAvg", "estimatedRevenueAvg"
        ),
    }


def upsert_earnings_history(db: Session, ticker: str, reports: list[dict]) -> int:
    """Store FMP earnings rows, replacing a scheduled row once it reports.

    The backtest ingest inserts and skips conflicts, which is right for a
    one-off history pull. Live rows start as a schedule with null actuals, so
    they have to be updated in place when the print lands.
    """
    rows: dict[date, dict] = {}
    for report in reports or []:
        raw = report.get("date")
        try:
            day = date.fromisoformat(str(raw)[:10]) if raw else None
        except ValueError:
            day = None
        if day is not None:
            rows[day] = {"ticker": ticker, "date": day, "data": dict(report)}
    if not rows:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    else:
        from sqlalchemy.dialects.sqlite import insert as _insert
    stmt = _insert(EarningsHistory.__table__).values(list(rows.values()))
    db.execute(
        stmt.on_conflict_do_update(
            index_elements=["ticker", "date"], set_={"data": stmt.excluded.data}
        )
    )
    return len(rows)


def _latest_reported_earnings(reports: list[dict], as_of: date) -> dict:
    """Newest announced actual-versus-estimate print on or before `as_of`.

    Upcoming calendar rows carry null actuals. They are useful elsewhere, but
    they cannot be called a beat or miss, so this projection ignores them.
    """
    candidates: list[tuple[date, dict]] = []
    for report in reports or []:
        raw_date = report.get("date")
        if not raw_date:
            continue
        try:
            announced = date.fromisoformat(str(raw_date)[:10])
        except ValueError:
            continue
        if announced > as_of:
            continue
        has_actual = any(
            report.get(key) is not None for key in ("epsActual", "revenueActual")
        )
        if has_actual:
            candidates.append((announced, report))
    if not candidates:
        return {}

    announced, report = max(candidates, key=lambda item: item[0])
    return {
        "earningsReportDate": announced.isoformat(),
        "epsActual": report.get("epsActual"),
        "epsEstimated": report.get("epsEstimated"),
        "revenueActual": report.get("revenueActual"),
        "revenueEstimated": report.get("revenueEstimated"),
    }



def _price_target_consensus(row: dict | None) -> dict:
    """Street price-target band from FMP consensus, if present.

    Subscriber-facing context only — never a scoring input. Field names vary
    slightly across FMP generations; accept the common aliases.
    """
    if not row:
        return {}
    low = first_present(row, "targetLow", "priceTargetLow", "targetLowPrice")
    high = first_present(row, "targetHigh", "priceTargetHigh", "targetHighPrice")
    mean = first_present(
        row,
        "targetConsensus",
        "targetMedian",
        "priceTargetConsensus",
        "priceTargetAverage",
        "priceTargetMedian",
    )
    count = first_present(
        row, "numberOfAnalysts", "analystsCount", "priceTargetAnalystCount"
    )
    out: dict = {}
    if low is not None:
        out["priceTargetLow"] = low
    if mean is not None:
        out["priceTargetMean"] = mean
    if high is not None:
        out["priceTargetHigh"] = high
    if count is not None:
        out["priceTargetAnalystCount"] = count
    return out


def backfill_holding_earnings(
    db: Session, fmp: FMPClient, *, as_of: date | None = None, commit: bool = True
) -> dict[str, int]:
    """Attach the latest reported earnings to each current holding snapshot.

    The earnings display was introduced after existing fundamentals snapshots
    had already been written. Re-running the full 400-name fundamentals job is
    unnecessary for that repair, so this fetches only current holdings and
    updates their newest existing JSON snapshot in place.

    No new dated snapshot is created: doing so from otherwise copied data would
    manufacture a new point-in-time observation and could distort estimate
    revision calculations used by the strategy. The operation is idempotent.
    """
    effective_as_of = as_of or date.today()
    tickers = sorted(
        {
            row[0]
            for row in db.query(Position.ticker)
            .filter(Position.portfolio_id == 1)
            .all()
        }
    )
    result = {
        "holdings": len(tickers),
        "updated": 0,
        "unchanged": 0,
        "missing_report": 0,
        "missing_snapshot": 0,
    }

    for ticker in tickers:
        snapshot = (
            db.query(Fundamentals)
            .filter(Fundamentals.ticker == ticker)
            .order_by(Fundamentals.as_of.desc(), Fundamentals.id.desc())
            .first()
        )
        if snapshot is None:
            result["missing_snapshot"] += 1
            continue

        earnings = _latest_reported_earnings(fmp.earnings(ticker), effective_as_of)
        if not earnings:
            result["missing_report"] += 1
            continue

        current = dict(snapshot.data or {})
        if all(current.get(key) == value for key, value in earnings.items()):
            result["unchanged"] += 1
            continue

        current.update(earnings)
        snapshot.data = current
        result["updated"] += 1

    if commit:
        db.commit()
    else:
        db.rollback()
    return result


def _parse_period(raw) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


def periods_match(current, prior) -> bool:
    """True when two estimatePeriod values are the same fiscal year.

    Exact string match first. Then a date window, because FMP restates the
    year-end by a few days without changing the year.
    """
    if current is None or prior is None:
        return False
    if current == prior:
        return True
    left, right = _parse_period(current), _parse_period(prior)
    if left is None or right is None:
        return False
    return abs((left - right).days) <= PERIOD_MATCH_TOLERANCE_DAYS


class PriorEstimate(NamedTuple):
    as_of: date
    data: dict


def _snapshot_estimate_data(row: ConsensusSnapshot) -> dict:
    period = row.fiscal_period
    period_s = period.isoformat() if isinstance(period, date) else str(period)
    return {
        "estimatePeriod": period_s,
        "epsEstimateAvg": row.eps_avg,
        "revenueEstimateAvg": row.revenue_avg,
    }


def _prior_estimate_snapshot(
    db: Session, ticker: str, as_of: date, period
) -> PriorEstimate | None:
    """Best earlier vintage of the same fiscal period.

    Prefers `consensus_snapshots` at each lookback tier, then falls back to
    `fundamentals` so Segment A (weekly top-400 rows from ~Jul 2026) stays
    usable. Prefer a row at least REVISION_LOOKBACK_DAYS old. If the 21-day
    row is a different year but a newer same-period snapshot exists past
    MIN_REVISION_LOOKBACK_DAYS, use that.

    Tiered, not "any snapshot wins": a 6-day snapshot must not replace a
    21-day fundamentals pair during the first three weeks after this job
    ships — consensus barely moves day to day, and that swap would fabricate
    a near-zero revisions factor for the live top-400.
    """
    cutoff = as_of - timedelta(days=REVISION_LOOKBACK_DAYS)
    min_as_of = as_of - timedelta(days=MIN_REVISION_LOOKBACK_DAYS)

    priors: list[PriorEstimate] = []
    for row in (
        db.query(ConsensusSnapshot)
        .filter(ConsensusSnapshot.ticker == ticker, ConsensusSnapshot.as_of < as_of)
        .order_by(ConsensusSnapshot.as_of.desc(), ConsensusSnapshot.id.desc())
        .all()
    ):
        priors.append(PriorEstimate(row.as_of, _snapshot_estimate_data(row)))
    for row in (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of < as_of)
        .order_by(Fundamentals.as_of.desc(), Fundamentals.id.desc())
        .all()
    ):
        data = dict(row.data or {})
        # Derived PIT rows are not vintages. Pairing them with themselves (or
        # with a later Friday's pit copy of the same Saturday estimate) is
        # what made Segment A Fridays a constant revisions factor.
        if data.get("source") == "pit":
            continue
        priors.append(PriorEstimate(row.as_of, data))
    # Stable sort: snapshots were appended first, so on the same as_of they
    # stay ahead of the fundamentals row.
    priors.sort(key=lambda row: row.as_of, reverse=True)

    fallback = None
    for row in priors:
        if not periods_match(period, (row.data or {}).get("estimatePeriod")):
            continue
        if row.as_of <= cutoff:
            return row
        if row.as_of <= min_as_of and fallback is None:
            fallback = row
    return fallback


def _pct_change(current, prior) -> float | None:
    try:
        cur = float(current)
        old = float(prior)
    except (TypeError, ValueError):
        return None
    if old == 0:
        return None
    # abs() in the denominator keeps the sign meaningful when consensus is
    # negative (a loss-making name whose estimated loss narrows is an upward
    # revision).
    return (cur - old) / abs(old)


def compute_estimate_revisions(
    db: Session,
    ticker: str,
    current: dict,
    as_of: date,
    *,
    vintage_as_of: date | None = None,
) -> dict:
    """Period-over-period change in consensus estimates — a real revision.

    The previous implementation stored `estimatedEpsAvg` / `estimatedRevenueAvg`
    directly, i.e. estimate *levels*. Percentile-ranked within a sector that is
    largely a company-size factor, not a revisions factor, and it carries weight
    0.30 and gates every buy via `min_revisions_grade`.

    KNOWN GAP: FMP's `analyst-estimates` endpoint only exposes the *current*
    consensus, not a consensus history, so a genuine revision cannot be computed
    on the very first snapshot for a ticker. We derive it from our own stored
    vintages (`consensus_snapshots` first, `fundamentals` second), which means
    the factor is null until a ticker has two snapshots of the same fiscal
    period spanning the lookback. A real next-year rollover stays null until
    that pair exists. A restated year-end date on the same FY is not a rollover.

    `vintage_as_of` is the observation date of `current`. Live callers omit it
    (the estimate was fetched today, so vintage == `as_of`). The backtest
    derive path passes the Saturday vintage that was forward-filled onto an
    evaluation Friday, so the 5–21 day window is measured from that vintage
    and does not self-pair with the same row.
    """
    period = current.get("estimatePeriod")
    if not period:
        return {}
    lookback_as_of = vintage_as_of or as_of
    prior_row = _prior_estimate_snapshot(db, ticker, lookback_as_of, period)
    prior = (prior_row.data or {}) if prior_row else {}
    if not prior:
        return {}
    out: dict = {}
    eps_rev = _pct_change(current.get("epsEstimateAvg"), prior.get("epsEstimateAvg"))
    rev_rev = _pct_change(
        current.get("revenueEstimateAvg"), prior.get("revenueEstimateAvg")
    )
    if eps_rev is not None:
        out["epsRevisionPct"] = eps_rev
        # The level the revision is measured from, so scoring can express it
        # per dollar of price (`revisions_eps_scaling = "price"`).
        out["epsEstimatePrior"] = prior.get("epsEstimateAvg")
    if rev_rev is not None:
        out["revenueRevisionPct"] = rev_rev
    if out:
        out["revisionBasisDate"] = prior_row.as_of.isoformat()
        out["revisionLookbackDays"] = (lookback_as_of - prior_row.as_of).days
    return out


FY2_SUFFIX = "Fy2"
_FY2_KEYS = (
    "epsRevisionPct",
    "revenueRevisionPct",
    "epsEstimatePrior",
    "epsEstimateAvg",
    "estimatePeriod",
)


def compute_fy2_revisions(
    db: Session,
    ticker: str,
    fy2: dict | None,
    as_of: date,
    *,
    vintage_as_of: date | None = None,
) -> dict:
    """Next-fiscal-year revisions, keyed with the `Fy2` suffix.

    Same pairing rules as FY1. The FY2 prior can only come from
    `consensus_snapshots` (fundamentals rows store FY1 alone), so this stays
    empty until the daily snapshot job has three weeks of history.
    """
    if not fy2:
        return {}
    rev = compute_estimate_revisions(db, ticker, fy2, as_of, vintage_as_of=vintage_as_of)
    if not rev:
        return {}
    merged = {**fy2, **rev}
    return {f"{k}{FY2_SUFFIX}": merged[k] for k in _FY2_KEYS if merged.get(k) is not None}


def recompute_latest_revisions(db: Session, as_of: date | None = None) -> int:
    """Rewrite revision fields on each ticker's newest snapshot from history.

    Scoring reads `epsRevisionPct` / `revenueRevisionPct` off that JSON. A
    lookback that treated a restated year-end date as a rollover stored nulls
    even when a same-period pair existed, and a rescore would keep reading
    them. Recomputing here heals without another FMP call.
    """
    as_of = as_of or date.today()
    latest = (
        db.query(
            Fundamentals.ticker,
            func.max(Fundamentals.as_of).label("as_of"),
        )
        .filter(Fundamentals.as_of <= as_of)
        .group_by(Fundamentals.ticker)
        .subquery()
    )
    patched = 0
    for row in (
        db.query(Fundamentals)
        .join(
            latest,
            (Fundamentals.ticker == latest.c.ticker)
            & (Fundamentals.as_of == latest.c.as_of),
        )
    ):
        data = dict(row.data or {})
        estimate = {
            "estimatePeriod": data.get("estimatePeriod"),
            "epsEstimateAvg": data.get("epsEstimateAvg"),
            "revenueEstimateAvg": data.get("revenueEstimateAvg"),
        }
        revision = compute_estimate_revisions(db, row.ticker, estimate, row.as_of)
        if not revision:
            continue
        if all(data.get(key) == value for key, value in revision.items()):
            continue
        data.update(revision)
        row.data = data
        patched += 1
    if patched:
        db.flush()
    return patched


def _sum_field(rows: list[dict], field: str) -> float | None:
    total = 0.0
    for row in rows:
        value = row.get(field)
        if value is None:
            return None
        try:
            total += float(value)
        except (TypeError, ValueError):
            return None
    return total


def compute_ttm_growth(rows: list[dict]) -> dict:
    """Trailing-twelve-month growth from eight quarterly income statements.

    Latest four quarters against the four before them. This reproduces what the
    `*GrowthTTM` metric names have always implied, and it is calendar-aligned
    across companies — unlike FMP's fiscal-year `financial-growth`, where a
    December filer and a June filer end up percentile-ranked against windows
    almost a year apart.

    `abs()` in the denominator, matching `_pct_change`: a company whose net
    income goes from -$10m to +$5m has improved, and a signed denominator would
    score that as -150% and bury the turnaround at the bottom of the factor.

    EPS is derived from TTM net income over the latest diluted share count
    rather than by summing quarterly EPS, which drifts when the count changes
    mid-year.
    """
    dated = [r for r in rows if r.get("date")]
    if len(dated) < 8:
        return {}
    dated.sort(key=lambda r: str(r["date"]), reverse=True)
    recent, prior = dated[:4], dated[4:8]

    out: dict = {}
    for field, key in (
        ("revenue", "revenueGrowthTTM"),
        ("netIncome", "netIncomeGrowthTTM"),
    ):
        cur = _sum_field(recent, field)
        old = _sum_field(prior, field)
        if cur is None or old is None or old == 0:
            continue
        out[key] = (cur - old) / abs(old)

    cur_ni = _sum_field(recent, "netIncome")
    old_ni = _sum_field(prior, "netIncome")
    cur_sh = recent[0].get("weightedAverageShsOutDil")
    old_sh = prior[0].get("weightedAverageShsOutDil")
    try:
        cur_sh = float(cur_sh) if cur_sh else None
        old_sh = float(old_sh) if old_sh else None
    except (TypeError, ValueError):
        cur_sh = old_sh = None
    if cur_ni is not None and old_ni is not None and cur_sh and old_sh:
        cur_eps, old_eps = cur_ni / cur_sh, old_ni / old_sh
        if old_eps != 0:
            out["epsGrowthTTM"] = (cur_eps - old_eps) / abs(old_eps)

    if out:
        out["growthBasisPeriod"] = str(recent[0]["date"])[:10]
    return out


def refresh_fundamentals(db: Session, fmp: FMPClient, max_tickers: int = 400) -> int:
    # Held positions are ALWAYS refreshed, whatever their size. Ranking by market
    # cap alone dropped 7 of 8 real holdings outside the cut, and an unscored
    # holding is invisible to `_removal_signals` (it skips any position with no
    # score) — the book would silently stop being evaluated for sells. Every
    # book, not just the live one: the DCA sample needs scores to fire exits.
    held = held_tickers(db)
    # NULLS LAST matters: Postgres sorts NULL first on DESC, so unpriced shells
    # would otherwise consume the budget ahead of the largest real companies.
    ranked = (
        db.query(Stock)
        .filter(Stock.is_active == True)  # noqa: E712
        .order_by(Stock.market_cap.desc().nullslast())
        .limit(max_tickers)
        .all()
    )
    stocks = list(ranked)
    seen = {s.ticker for s in stocks}
    for ticker in sorted(held - seen):
        stock = db.get(Stock, ticker)
        if stock is not None:
            stocks.append(stock)
    as_of = date.today()
    n = 0
    revisions_available = 0
    growth_available = 0
    earnings_supported = True
    price_targets_supported = True
    # Growth is one endpoint among several here. `_get` raises FMPAccessError on
    # 401/402/403 so a plan restriction can never masquerade as "no data" — but
    # unhandled that would abort refresh_fundamentals and take the rest of
    # weekly_refresh with it, including refresh_marks. Losing marks means stale
    # position prices and a hole in the published equity curve, which is far
    # worse than losing one factor for a day. Trip a breaker instead.
    growth_supported = True
    for s in stocks:
        metrics = fmp.key_metrics_ttm(s.ticker) or {}
        ratios = fmp.ratios_ttm(s.ticker) or {}
        data = {**metrics, **ratios}
        if growth_supported:
            try:
                growth = compute_ttm_growth(fmp.income_statement_quarterly(s.ticker))
            except FMPAccessError:
                log.exception(
                    "income-statement is not available on this FMP plan; growth "
                    "will be null for the rest of this run, which blocks every "
                    "buy via min_growth_grade. Continuing so marks still update."
                )
                growth_supported = False
                growth = {}
            if growth:
                growth_available += 1
                data.update(growth)
        estimates = fmp.analyst_estimates(s.ticker)
        estimate = _forward_estimate(estimates, as_of)
        if estimate:
            data.update(estimate)
            revision = compute_estimate_revisions(db, s.ticker, estimate, as_of)
            if revision:
                revisions_available += 1
            data.update(revision)
            data.update(
                compute_fy2_revisions(
                    db, s.ticker, _forward_estimate(estimates, as_of, nth=1), as_of
                )
            )
        # Earnings actuals are a subscriber-facing holding annotation, not a
        # scoring factor. Restrict this endpoint to held names so adding the
        # display does not make hundreds of extra calls per weekly refresh.
        # Every refreshed name, not only holdings: the rows feed the
        # earnings-blackout and surprise research switches, which read
        # `earnings_history` the same way live and in the backtest.
        if earnings_supported:
            try:
                reports = fmp.earnings(s.ticker)
                upsert_earnings_history(db, s.ticker, reports)
                if s.ticker in held:
                    data.update(_latest_reported_earnings(reports, as_of))
            except FMPAccessError:
                log.exception(
                    "earnings is not available on this FMP plan; latest "
                    "actual-versus-estimate data will remain unavailable"
                )
                earnings_supported = False
        # Street price targets are subscriber-facing context (insights,
        # fundamentals tab, pick email), not a scoring factor. Restrict to
        # held names so the weekly refresh does not add hundreds of calls.
        if price_targets_supported and s.ticker in held:
            try:
                data.update(_price_target_consensus(fmp.price_target_consensus(s.ticker)))
            except FMPAccessError:
                log.exception(
                    "price-target-consensus is not available on this FMP plan; "
                    "Street range will remain unavailable"
                )
                price_targets_supported = False
        if not data:
            continue
        # Update in place: (ticker, as_of) is unique, so a second run on the
        # same day must overwrite rather than insert alongside.
        row = (
            db.query(Fundamentals)
            .filter(Fundamentals.ticker == s.ticker, Fundamentals.as_of == as_of)
            .one_or_none()
        )
        if row is None:
            db.add(Fundamentals(ticker=s.ticker, as_of=as_of, data=data))
        else:
            row.data = data
        profile = fmp.profile(s.ticker)
        if profile:
            s.sector = profile.get("sector") or s.sector
            s.industry = profile.get("industry") or s.industry
            # `/stable` renamed this from the legacy `mktCap`. Reading only the
            # old name left market_cap NULL for every stock not in the screener
            # (i.e. the hand-seeded holdings), and score_universe filters on
            # `market_cap >= min_universe_market_cap` — so those names were
            # dropped from scoring entirely. Accept both, newest name first.
            s.market_cap = (
                profile.get("marketCap") or profile.get("mktCap") or s.market_cap
            )
            s.name = profile.get("companyName") or s.name
        n += 1
        if n % 25 == 0:
            db.commit()
            log.info("Fundamentals progress: %s", n)
    db.commit()
    if n and not revisions_available:
        log.warning(
            "Fundamentals refresh stored %s tickers but computed 0 estimate "
            "revisions — not enough consensus history yet. The revisions factor "
            "(weight 0.30) will grade F and block all buys until a second "
            "snapshot exists.",
            n,
        )
    else:
        log.info("Estimate revisions computed for %s/%s tickers", revisions_available, n)
    if n and not growth_available:
        log.warning(
            "Fundamentals refresh stored %s tickers but computed 0 TTM growth "
            "values. Growth carries weight 0.35 and gates every buy via "
            "min_growth_grade, and under the factor-coverage floor a null growth "
            "value makes the ticker unscoreable outright.",
            n,
        )
    else:
        log.info("TTM growth computed for %s/%s tickers", growth_available, n)
    return n


def backfill_price_history(
    db: Session,
    fmp: FMPClient,
    lookback_days: int = 430,
    min_bars: int = 200,
    max_stale_days: int = 5,
    overlap_days: int = 10,
    max_tickers: int | None = None,
) -> dict:
    """Fetch daily closes so the 12-month momentum factor can be computed.

    Momentum needs a bar at or before `as_of - 365d`. Fetching exactly 365 days
    lands the first bar *after* the target once weekends and holidays are
    accounted for, so the lookup finds nothing — hence 430.

    A ticker is fetched when its series is **short** (< `min_bars`) OR **stale**
    (newest bar older than `max_stale_days`). Bar count alone was the original
    condition and it only covered the first case: a name with a full year of
    history frozen at the date of the last backfill looked well covered forever,
    so it was never topped up while the `as_of - 365d` anchor kept moving under
    it (BUG-W2). Freshness alone would be the mirror mistake — a held position
    gets a daily bar from `refresh_marks`, so it is never stale but may hold only
    a few months of history. Both conditions are needed.

    Stale-but-long tickers are re-fetched from `overlap_days` before their newest
    bar rather than from the full lookback: that is the difference between a
    weekly top-up and re-downloading 14 months for the entire universe every
    Saturday. Short tickers still get the full window. Today is excluded so this
    never contends with `refresh_marks`.
    """
    start = date.today() - timedelta(days=lookback_days)
    cutoff = date.today()
    stale_before = date.today() - timedelta(days=max_stale_days)

    # func.max over a Date needs an explicit type_ or SQLite hands back the
    # stored string and every comparison below is against the wrong type.
    coverage = {
        ticker: (int(n or 0), newest)
        for ticker, n, newest in db.query(
            PriceBar.ticker,
            func.count(PriceBar.id),
            func.max(PriceBar.date, type_=PriceBar.date.type),
        )
        .group_by(PriceBar.ticker)
        .all()
    }
    universe = (
        db.query(Stock.ticker)
        .filter(Stock.is_active == True)  # noqa: E712
        .order_by(Stock.market_cap.desc().nullslast())
        .all()
    )
    held = held_tickers(db)

    def _is_short(ticker: str) -> bool:
        return coverage.get(ticker, (0, None))[0] < min_bars

    def _is_stale(ticker: str) -> bool:
        newest = coverage.get(ticker, (0, None))[1]
        return newest is None or newest < stale_before

    def _fetch_from(ticker: str) -> date:
        """Full window for a short series, incremental top-up for a stale one."""
        n, newest = coverage.get(ticker, (0, None))
        if n < min_bars or newest is None:
            return start
        return max(start, newest - timedelta(days=overlap_days))

    # Comparison ETFs and holdings first. The universe can be hundreds of stale
    # names; with max_tickers set they used to consume the whole budget and a
    # newly added benchmark (QQQ) never got a history fetch.
    priority = [
        t for t in sorted(held | set(INGEST_ETFS)) if _is_short(t) or _is_stale(t)
    ]
    seen_priority = set(priority)
    rest = [
        t
        for (t,) in universe
        if t not in seen_priority and (_is_short(t) or _is_stale(t))
    ]
    candidates = priority + rest
    tickers = candidates[:max_tickers] if max_tickers is not None else candidates
    short = sum(1 for t in tickers if _is_short(t))

    fetched = 0
    inserted = 0
    rows_seen = 0
    rows_adjusted = 0
    for ticker in tickers:
        try:
            seen, adjusted, n = ingest_ticker_history(
                db, fmp, ticker, _fetch_from(ticker), cutoff
            )
        except FMPAccessError:
            log.exception("historical prices unavailable on this plan; stopping")
            break
        rows_seen += seen
        rows_adjusted += adjusted
        inserted += n
        fetched += 1
        if fetched % 25 == 0:
            log.info("Price backfill progress: %s/%s tickers", fetched, len(tickers))

    log.info(
        "Price backfill: %s tickers (%s short, %s stale top-up), %s bars attempted",
        fetched,
        short,
        len(tickers) - short,
        inserted,
    )
    # Settles, from live data, a question the code cannot answer offline: does
    # `/stable/historical-price-eod/full` actually carry adjClose? If it does
    # not, the whole series is unadjusted and EVERY recent split fabricates a
    # large negative 12-month return for the affected ticker. Momentum is 15% of
    # the composite and drags a further momentum_penalty when negative, so this
    # is not a rounding concern. Log it either way rather than assuming.
    if rows_seen and not rows_adjusted:
        log.warning(
            "Price backfill: 0/%s FMP rows carried adjClose — the stored series "
            "is UNADJUSTED, so any split in the last 12 months fabricates a "
            "large negative momentum reading for that ticker",
            rows_seen,
        )
    else:
        log.info("Price backfill: %s/%s rows carried adjClose", rows_adjusted, rows_seen)
    return {
        "tickers": fetched,
        "bars": inserted,
        "candidates": len(tickers),
        "short": short,
        "stale": len(tickers) - short,
        "rows_seen": rows_seen,
        "rows_adjusted": rows_adjusted,
    }


def refresh_marks(db: Session, fmp: FMPClient) -> int:
    """Update marks for open positions, recent candidates, and comparison ETFs."""
    ensure_benchmark_history(db, fmp)
    ensure_default_portfolio(db)
    pos_tickers = list(held_tickers(db))
    # Top scored candidates, by RATING, from the latest scoring date.
    #
    # This was `ORDER BY composite_scores.id DESC LIMIT 100` with no as_of
    # filter, which is neither. `score_universe` UPDATEs rows in place and only
    # INSERTs for tickers it has never seen, so ids are frozen at first sight:
    # the 100 rows selected were whichever tickers happened to be written last
    # on the very FIRST scoring run, permanently. With no as_of bound one
    # ticker's rows from several dates could also occupy several of the 100
    # slots, shrinking the set further. The #1-rated name — the one on the
    # dashboard, the one evaluate() buys — could sit outside that slice forever,
    # so its Stock.last_price and its daily PriceBar simply stopped updating,
    # feeding a stale mark into momentum and into the published price.
    #
    # Ticker is the tie-break so the cut is deterministic across runs rather
    # than dependent on row order.
    from app.db.models import CompositeScore

    latest_as_of = db.query(func.max(CompositeScore.as_of)).scalar()
    candidates = (
        db.query(CompositeScore.ticker)
        .filter(CompositeScore.as_of == latest_as_of)
        .order_by(CompositeScore.quant_rating.desc().nullslast(), CompositeScore.ticker.asc())
        .limit(100)
        .all()
        if latest_as_of is not None
        else []
    )
    held = set(pos_tickers)
    # Comparison ETFs must be marked every session. SPY already was; MAGS and
    # VTI were only written during snapshot backfill, so their series stopped
    # weeks before the picks curve and the Mag 7 line looked like missing data.
    tickers = list({*pos_tickers, *[c[0] for c in candidates], *INGEST_ETFS})
    quotes = fmp.batch_quotes(tickers)
    # Date the bar to the session it actually belongs to. FMP returns the last
    # close when the market is shut, so stamping it with date.today() invented a
    # Saturday bar carrying Friday's price — 115 such phantom rows accumulated.
    # They distort any date-windowed price lookup and put flat points on the
    # curve. job_daily_marks already guards this by skipping non-trading days;
    # weekly_refresh calls refresh_marks directly and did not.
    today = last_trading_day_on_or_before(date.today())
    n = 0
    by_sym = {q.get("symbol"): q for q in quotes if q.get("symbol")}
    for ticker in tickers:
        q = by_sym.get(ticker)
        if not q:
            continue
        price = q.get("price") or q.get("previousClose")
        if not price:
            continue
        stock = db.get(Stock, ticker)
        if not stock:
            # A ticker can be held without ever having come through
            # refresh_universe — manually entered positions are the common
            # case. Skipping them here silently left every hand-entered
            # position marked at its entry price forever.
            stock = Stock(
                ticker=ticker,
                name=q.get("name"),
                is_active=True,
                is_etf=ticker in INGEST_ETFS,
            )
            db.add(stock)
        # Backfill market cap whenever it is unknown, including on rows this
        # function created earlier.
        #
        # compute_scores filters the universe with
        # `Stock.market_cap >= min_universe_market_cap`, and in SQL a NULL fails
        # that comparison. A hand-entered position therefore was not merely
        # unscored, it was never CONSIDERED — permanently "unrated" on the
        # dashboard no matter how often scoring ran. Worse, `_removal_signals`
        # skips holdings with no score, so no exit rule could ever fire on one
        # either. Unknown is not the same as small, and it must not be resolved
        # by silently dropping the row.
        if stock.market_cap is None:
            raw_cap = q.get("marketCap") or q.get("marketCapitalization")
            if raw_cap:
                try:
                    stock.market_cap = float(raw_cap)
                except (TypeError, ValueError):
                    pass
        # Sector is the second gate, and clearing market_cap alone does not get
        # a ticker scored. `compute_scores` builds its peer groups with
        # `if s.ticker in funds and s.sector` — a NULL sector drops the row
        # before `considered` is even incremented, so it appears in no count and
        # no log line. Sector is not on the quote payload, so fetch the profile,
        # but only for rows that lack one: this is a per-ticker call and the
        # gap it closes is rare and permanent, not recurring.
        #
        # `refresh_fundamentals` also resolves sector from the same endpoint,
        # but only on the weekly refresh. A held position that cannot be scored
        # is not merely unrated on the dashboard — `_removal_signals` skips
        # holdings with no score, so no exit rule can fire on it. Waiting until
        # Saturday for that is too long.
        #
        # Scoped to HELD tickers. Candidates arrive via refresh_universe with a
        # sector already set, and SPY is a benchmark that legitimately has none
        # — looking it up every run would spend a call and log a warning
        # forever for a row that is not a candidate for anything.
        if not stock.sector and ticker in held:
            try:
                profile = fmp.profile(ticker)
            except Exception:  # never let a marks run die on one lookup
                profile = None
            if profile:
                stock.sector = profile.get("sector") or stock.sector
                stock.industry = profile.get("industry") or stock.industry
                stock.name = stock.name or profile.get("companyName")
            if not stock.sector:
                log.warning(
                    "%s has no sector; it cannot be scored, rated, or exited "
                    "by any rule until one is resolved",
                    ticker,
                )
        stock.last_price = float(price)
        stock.updated_at = datetime.now(timezone.utc)
        upsert_price_bar(db, ticker, today, float(price))
        n += 1

    db.flush()

    # Update open position marks on every book.
    marked = 0
    open_positions = db.query(Position).all()
    for p in open_positions:
        stock = db.get(Stock, p.ticker)
        if stock and stock.last_price:
            p.current_price = stock.last_price
            marked += 1
        else:
            log.warning("No mark available for held position %s", p.ticker)
    log.info("Marked %s/%s open positions", marked, len(open_positions))

    spy = db.get(Stock, "SPY")
    spy_px = spy.last_price if spy else None
    for portfolio in db.query(Portfolio).all():
        _upsert_daily_snapshot(db, portfolio, today, spy_px)
    db.commit()
    log.info("Updated %s marks", n)
    return n


def _upsert_daily_snapshot(
    db: Session, portfolio: Portfolio, as_of: date, spy_px: float | None
) -> None:
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    invested = sum(p.market_value for p in positions)
    cash = portfolio.cash or 0.0
    existing = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.portfolio_id == portfolio.id,
            PortfolioSnapshot.date == as_of,
        )
        .first()
    )
    if existing:
        existing.cash = cash
        existing.invested_value = invested
        existing.total_value = cash + invested
        existing.position_count = len(positions)
        existing.spy_value = spy_px
    else:
        db.add(
            PortfolioSnapshot(
                portfolio_id=portfolio.id,
                date=as_of,
                cash=cash,
                invested_value=invested,
                total_value=cash + invested,
                spy_value=spy_px,
                position_count=len(positions),
            )
        )


#: Tenors the week-ahead thread is allowed to quote. The 2s/10s pair is the
#: whole point — a Fed repricing shows up at the front end first, and a thread
#: that only ever cites the 10-year cannot see it.
MACRO_TENORS: dict[str, str] = {
    "year2": "treasury_2y",
    "year10": "treasury_10y",
    "year30": "treasury_30y",
}

#: How far forward the econ calendar is pulled. One week: the thread is written
#: on Sunday about the week that starts Monday, and a release three weeks out
#: is not something it should be mentioning.
MACRO_CALENDAR_DAYS = 8

#: Releases worth a Sunday thread. The full US calendar runs to dozens of rows
#: a week (mortgage applications, regional Fed surveys); a thread that lists
#: all of them reads as a data dump. Matched case-insensitively on a substring
#: so "Nonfarm Payrolls" catches "US Nonfarm Payrolls".
MACRO_EVENT_MARKERS: tuple[str, ...] = (
    "nonfarm payroll",
    "unemployment rate",
    "average hourly earnings",
    "ism manufacturing",
    "ism services",
    "cpi",
    "ppi",
    "pce",
    "fomc",
    "gdp",
    "retail sales",
    "initial jobless claims",
)

#: Macro rows older than this are dropped on every run. Longer than the news
#: window because a rate series only makes sense with a little history behind
#: it — "the 10-year is up 40bp in a month" needs the month.
MACRO_RETENTION_DAYS = 90


def _is_tracked_macro_event(name: str | None) -> bool:
    if not name:
        return False
    lowered = name.lower()
    return any(marker in lowered for marker in MACRO_EVENT_MARKERS)


def _as_float(raw) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _upsert_macro(
    db: Session,
    *,
    kind: str,
    label: str,
    as_of: date,
    value: float | None = None,
    consensus: float | None = None,
    previous: float | None = None,
    unit: str | None = None,
) -> bool:
    """Insert or update one reading. Returns True if a new row was created.

    Update rather than skip: an econ event is ingested before it happens, with
    a consensus and no actual, and the same row has to gain its actual once
    the release lands. Skipping on conflict would leave the thread reading
    "Nonfarm Payrolls: consensus 45k" forever.
    """
    existing = (
        db.query(MacroReading)
        .filter(
            MacroReading.kind == kind,
            MacroReading.as_of == as_of,
            MacroReading.label == label,
        )
        .one_or_none()
    )
    if existing is None:
        db.add(
            MacroReading(
                kind=kind,
                label=label,
                as_of=as_of,
                value=value,
                consensus=consensus,
                previous=previous,
                unit=unit,
            )
        )
        return True
    existing.value = value
    existing.consensus = consensus
    existing.previous = previous
    existing.unit = unit
    existing.fetched_at = datetime.now(timezone.utc)
    return False


def refresh_macro(db: Session, fmp: FMPClient, today: date | None = None) -> dict:
    """Pull Treasury yields and the week's US econ calendar into `macro_readings`.

    Deliberately narrow. This is not a macro data warehouse — it is the set of
    facts the Sunday week-ahead thread is permitted to cite, and every one of
    them is a published number with a date attached. Anything the thread wants
    that is not here (Fed funds pricing, index levels, positioning) stays in
    the payload's `missing` array so the model writes around it rather than
    inventing it.
    """
    today = today or datetime.now(timezone.utc).date()
    # Two weeks back so a Monday holiday or a stale vendor still leaves a
    # recent session to quote, rather than an empty series.
    rates_start = today - timedelta(days=14)

    rates_rows = fmp.treasury_rates(rates_start.isoformat(), today.isoformat())
    inserted = 0
    for row in rates_rows:
        as_of = _parse_macro_date(row.get("date"))
        if as_of is None:
            continue
        for field, label in MACRO_TENORS.items():
            value = _as_float(row.get(field))
            if value is None:
                continue
            if _upsert_macro(
                db,
                kind="treasury",
                label=label,
                as_of=as_of,
                value=value,
                unit="percent",
            ):
                inserted += 1

    calendar_rows = fmp.economics_calendar(
        today.isoformat(),
        (today + timedelta(days=MACRO_CALENDAR_DAYS)).isoformat(),
    )
    events = 0
    for row in calendar_rows:
        name = row.get("event")
        if not _is_tracked_macro_event(name):
            continue
        as_of = _parse_macro_date(row.get("date"))
        if as_of is None:
            continue
        if _upsert_macro(
            db,
            kind="econ_event",
            label=name[:128],
            as_of=as_of,
            value=_as_float(row.get("actual")),
            consensus=_as_float(row.get("estimate")),
            previous=_as_float(row.get("previous")),
            unit=(row.get("unit") or None),
        ):
            events += 1

    cutoff = today - timedelta(days=MACRO_RETENTION_DAYS)
    deleted = (
        db.query(MacroReading)
        .filter(MacroReading.as_of < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {
        "rate_rows": len(rates_rows),
        "events": events,
        "inserted": inserted,
        "deleted": deleted,
    }


def _parse_macro_date(raw) -> date | None:
    """FMP hands back both `YYYY-MM-DD` and `YYYY-MM-DD HH:MM:SS` here."""
    if not raw or not isinstance(raw, str):
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None
