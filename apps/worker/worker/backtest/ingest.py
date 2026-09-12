"""Resumable FMP historical ingest into a dataset sqlite file."""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS
from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import (
    Delisting,
    EarningsHistory,
    Filing,
    MarketCapHistory,
    Stock,
)
from worker.backtest.membership import write_universe_membership
from worker.backtest.pit import filing_available_from, parse_fmp_date
from worker.backtest.store import bulk_insert
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.ingest import (
    SNAPSHOT_MARKET_CAP_FLOOR,
    SNAPSHOT_SHARE_PRICE_FLOOR,
    ingest_ticker_history,
    snapshot_universe_tickers,
)

log = logging.getLogger(__name__)

STATEMENT_LIMIT = 12
DELISTED_PAGE_SIZE = 100
DELISTED_MAX_PAGES = 50


def ingest_filings(
    db: Session,
    ticker: str,
    statement_type: str,
    rows: list[dict],
) -> int:
    parsed: list[dict] = []
    for row in rows or []:
        period = parse_fmp_date(row.get("date") or row.get("fillingDate"))
        available = filing_available_from(row)
        if period is None or available is None:
            continue
        parsed.append(
            {
                "ticker": ticker,
                "statement_type": statement_type,
                "period": period,
                "available_from": available,
                "data": dict(row),
            }
        )
    unique = {
        (r["ticker"], r["statement_type"], r["period"]): r for r in parsed
    }
    return bulk_insert(
        db, Filing.__table__, list(unique.values()), ["ticker", "statement_type", "period"]
    )


def ingest_market_caps(db: Session, ticker: str, rows: list[dict]) -> int:
    parsed: list[dict] = []
    for row in rows or []:
        day = parse_fmp_date(row.get("date"))
        cap = row.get("marketCap") if row.get("marketCap") is not None else row.get(
            "marketCapitalization"
        )
        if day is None or cap is None:
            continue
        try:
            cap = float(cap)
        except (TypeError, ValueError):
            continue
        if cap <= 0:
            continue
        parsed.append({"ticker": ticker, "date": day, "market_cap": cap})
    unique = {(r["ticker"], r["date"]): r for r in parsed}
    return bulk_insert(
        db, MarketCapHistory.__table__, list(unique.values()), ["ticker", "date"]
    )


def ingest_earnings_history(db: Session, ticker: str, rows: list[dict]) -> int:
    parsed: list[dict] = []
    for row in rows or []:
        day = parse_fmp_date(row.get("date"))
        if day is None:
            continue
        parsed.append({"ticker": ticker, "date": day, "data": dict(row)})
    unique = {(r["ticker"], r["date"]): r for r in parsed}
    return bulk_insert(
        db, EarningsHistory.__table__, list(unique.values()), ["ticker", "date"]
    )


def ingest_delistings(db: Session, fmp: FMPClient) -> int:
    written = 0
    for page in range(DELISTED_MAX_PAGES):
        try:
            rows = fmp.delisted_companies(page=page, limit=DELISTED_PAGE_SIZE)
        except FMPAccessError:
            log.warning(
                "delisted-companies is not on this FMP plan; continuing with an "
                "empty delisted set (log-and-drop)"
            )
            return written
        if not rows:
            break
        parsed: list[dict] = []
        for row in rows:
            ticker = (row.get("symbol") or "").upper()
            day = parse_fmp_date(row.get("delistedDate") or row.get("date"))
            if not ticker or day is None:
                continue
            parsed.append(
                {
                    "ticker": ticker,
                    "date": day,
                    "name": row.get("companyName") or row.get("name"),
                }
            )
        unique = {r["ticker"]: r for r in parsed}
        written += bulk_insert(db, Delisting.__table__, list(unique.values()), ["ticker"])
        if len(rows) < DELISTED_PAGE_SIZE:
            break
    return written


def _upsert_stock_from_profile(db: Session, ticker: str, profile: dict | None) -> None:
    if not profile:
        return
    stock = db.get(Stock, ticker)
    if stock is None:
        stock = Stock(ticker=ticker, is_active=True)
        db.add(stock)
    stock.name = profile.get("companyName") or stock.name
    stock.sector = profile.get("sector") or stock.sector
    stock.industry = profile.get("industry") or stock.industry
    stock.market_cap = (
        profile.get("marketCap") or profile.get("mktCap") or stock.market_cap
    )
    is_etf = profile.get("isEtf") or profile.get("isFund")
    if is_etf is not None:
        stock.is_etf = bool(is_etf)
    country = (profile.get("country") or "").upper()
    if country and country != "US":
        stock.is_active = False
    db.commit()


def ingest_ticker(
    db: Session,
    fmp: FMPClient,
    ticker: str,
    start: date,
    cutoff: date,
) -> dict:
    """Pull one name's history. Idempotent. Raises FMPAccessError to the caller."""
    seen, adjusted, bars = ingest_ticker_history(db, fmp, ticker, start, cutoff)
    income = ingest_filings(
        db, ticker, "income", fmp.income_statement_quarterly(ticker, limit=STATEMENT_LIMIT)
    )
    balance = ingest_filings(
        db, ticker, "balance", fmp.balance_sheet_quarterly(ticker, limit=STATEMENT_LIMIT)
    )
    cashflow = 0
    try:
        cashflow = ingest_filings(
            db, ticker, "cashflow", fmp.cash_flow_quarterly(ticker, limit=STATEMENT_LIMIT)
        )
    except FMPAccessError:
        log.warning("cash-flow-statement not available on this plan; continuing")
    try:
        caps = ingest_market_caps(
            db, ticker, fmp.historical_market_cap(ticker, from_date=start, to_date=cutoff)
        )
    except FMPAccessError:
        log.warning("historical-market-capitalization not on this plan; continuing")
        caps = 0
    earnings = ingest_earnings_history(db, ticker, fmp.earnings(ticker, limit=16))
    _upsert_stock_from_profile(db, ticker, fmp.profile(ticker))
    return {
        "ticker": ticker,
        "price_rows_seen": seen,
        "price_rows_adjusted": adjusted,
        "bars": bars,
        "income": income,
        "balance": balance,
        "cashflow": cashflow,
        "market_caps": caps,
        "earnings": earnings,
    }


def already_ingested(db: Session) -> set[str]:
    from app.db.models import PriceBar

    return {t for (t,) in db.query(PriceBar.ticker).distinct().all()}


def ingest_dataset(
    db: Session,
    fmp: FMPClient,
    *,
    start: date,
    end: date,
    resume: bool = True,
    extra_tickers: list[str] | None = None,
) -> dict:
    """Pull ~3y of bars/statements/mcap/delistings for the eligible set.

    Does not write into a live Postgres book — the caller opens a dataset
    sqlite session. Delisted names with no price history are logged and
    dropped; the count is returned so every report can show it.
    """
    params = RUN118_PARAMS
    delisted_n = ingest_delistings(db, fmp)
    tickers = set(snapshot_universe_tickers(db, fmp))
    for (ticker,) in db.query(Delisting.ticker).all():
        tickers.add(ticker)
    for ticker in extra_tickers or []:
        tickers.add(ticker.upper())
    tickers = sorted(t for t in tickers if t and "." not in t)

    done = already_ingested(db) if resume else set()
    dropped_no_prices: list[str] = []
    ingested = 0
    errors_stopped = False
    cutoff = end + timedelta(days=1)
    for i, ticker in enumerate(tickers, 1):
        if ticker in done:
            continue
        try:
            result = ingest_ticker(db, fmp, ticker, start, cutoff)
        except FMPAccessError:
            log.exception("FMP access error on %s; stopping so the hole is visible", ticker)
            errors_stopped = True
            break
        if result["bars"] == 0 and result["price_rows_seen"] == 0:
            dropped_no_prices.append(ticker)
            log.warning("No FMP price history for %s; dropping from membership", ticker)
        ingested += 1
        if i % 25 == 0:
            log.info("Ingest progress: %s/%s", i, len(tickers))

    membership = write_universe_membership(db, start, end, params)
    return {
        "tickers": len(tickers),
        "ingested": ingested,
        "skipped_resume": len(done),
        "delistings": delisted_n,
        "dropped_no_prices": dropped_no_prices,
        "dropped_no_prices_count": len(dropped_no_prices),
        "membership_rows": membership,
        "stopped_on_access_error": errors_stopped,
        "screener_floor_cap": SNAPSHOT_MARKET_CAP_FLOOR,
        "screener_floor_price": SNAPSHOT_SHARE_PRICE_FLOOR,
        "evaluation_fridays": len(evaluation_fridays_between(start, end)),
    }
