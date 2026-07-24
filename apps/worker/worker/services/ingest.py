"""Ingest universe + fundamentals + marks via FMP."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS

from app.db.models import Fundamentals, Portfolio, PortfolioSnapshot, Position, PriceBar, Stock
from app.services.portfolio import ensure_default_portfolio
from worker.services.fmp import FMPClient

log = logging.getLogger(__name__)


def refresh_universe(db: Session, fmp: FMPClient, limit: int = 800) -> int:
    params = RUN118_PARAMS
    rows = fmp.stock_screener(min_market_cap=params.min_universe_market_cap, limit=limit)
    count = 0
    for row in rows:
        ticker = (row.get("symbol") or "").upper()
        if not ticker or "." in ticker:
            continue
        price = row.get("price") or 0
        if price and price < params.min_share_price:
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


def refresh_fundamentals(db: Session, fmp: FMPClient, max_tickers: int = 400) -> int:
    stocks = (
        db.query(Stock)
        .filter(Stock.is_active == True)  # noqa: E712
        .order_by(Stock.market_cap.desc())
        .limit(max_tickers)
        .all()
    )
    as_of = date.today()
    n = 0
    for s in stocks:
        metrics = fmp.key_metrics_ttm(s.ticker) or {}
        ratios = fmp.ratios_ttm(s.ticker) or {}
        data = {**metrics, **ratios}
        # crude revision proxy from estimates if present
        estimates = fmp.analyst_estimates(s.ticker)
        if estimates:
            data["epsRevision"] = estimates[0].get("estimatedEpsAvg")
            data["revenueRevision"] = estimates[0].get("estimatedRevenueAvg")
        if not data:
            continue
        db.add(Fundamentals(ticker=s.ticker, as_of=as_of, data=data))
        profile = fmp.profile(s.ticker)
        if profile:
            s.sector = profile.get("sector") or s.sector
            s.industry = profile.get("industry") or s.industry
            s.market_cap = profile.get("mktCap") or s.market_cap
            s.name = profile.get("companyName") or s.name
        n += 1
        if n % 25 == 0:
            db.commit()
            log.info("Fundamentals progress: %s", n)
    db.commit()
    return n


def refresh_marks(db: Session, fmp: FMPClient) -> int:
    """Update marks for open positions + recent candidates only (lean)."""
    portfolio = ensure_default_portfolio(db)
    pos_tickers = [
        p.ticker
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    ]
    # Top scored candidates
    from app.db.models import CompositeScore

    candidates = (
        db.query(CompositeScore.ticker)
        .order_by(CompositeScore.id.desc())
        .limit(100)
        .all()
    )
    tickers = list({*pos_tickers, *[c[0] for c in candidates], "SPY"})
    quotes = fmp.batch_quotes(tickers)
    today = date.today()
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
        if stock:
            stock.last_price = float(price)
            stock.updated_at = datetime.now(timezone.utc)
        db.merge(PriceBar(ticker=ticker, date=today, close=float(price)))
        n += 1

    # Update open position marks
    for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all():
        stock = db.get(Stock, p.ticker)
        if stock and stock.last_price:
            p.current_price = stock.last_price

    # Snapshot
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    invested = sum(p.market_value for p in positions)
    spy = db.get(Stock, "SPY")
    existing = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == portfolio.id, PortfolioSnapshot.date == today)
        .first()
    )
    if existing:
        existing.cash = portfolio.cash
        existing.invested_value = invested
        existing.total_value = portfolio.cash + invested
        existing.position_count = len(positions)
        existing.spy_value = spy.last_price if spy else None
    else:
        db.add(
            PortfolioSnapshot(
                portfolio_id=portfolio.id,
                date=today,
                cash=portfolio.cash,
                invested_value=invested,
                total_value=portfolio.cash + invested,
                spy_value=spy.last_price if spy else None,
                position_count=len(positions),
            )
        )
    db.commit()
    log.info("Updated %s marks", n)
    return n
