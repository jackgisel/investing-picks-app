"""Ingest universe + fundamentals + marks via FMP."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS

from app.db.models import Fundamentals, Portfolio, PortfolioSnapshot, Position, PriceBar, Stock
from app.services.portfolio import ensure_default_portfolio
from worker.services.fmp import FMPClient

log = logging.getLogger(__name__)

# How far back to look for the consensus estimate we compare against. Weekly
# fundamentals refreshes mean roughly one snapshot per 7 days, so ~3 weeks
# approximates the conventional 1-month revision window.
REVISION_LOOKBACK_DAYS = 21


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


def _forward_estimate(estimates: list[dict], as_of: date) -> dict | None:
    """The consensus row for the nearest fiscal period ending on/after `as_of`.

    FMP returns one row per fiscal year, past and future, unordered in practice.
    Revisions must always be measured against the *same* fiscal period, so we
    pin the period explicitly rather than trusting list position.
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
    period, row = upcoming[0] if upcoming else max(rows, key=lambda r: r[0])
    return {
        "estimatePeriod": period.isoformat(),
        # `/stable` dropped the `estimated` prefix the legacy API used; accept
        # both so stored snapshots taken under either shape stay comparable.
        "epsEstimateAvg": row.get("epsAvg", row.get("estimatedEpsAvg")),
        "revenueEstimateAvg": row.get(
            "revenueAvg", row.get("estimatedRevenueAvg")
        ),
    }


def _prior_estimate_snapshot(db: Session, ticker: str, as_of: date) -> Fundamentals | None:
    """Most recent stored fundamentals at least REVISION_LOOKBACK_DAYS old.

    Falls back to the oldest snapshot strictly before `as_of` so that a young
    history still yields a (shorter-window) revision rather than nothing.
    """
    cutoff = as_of - timedelta(days=REVISION_LOOKBACK_DAYS)
    row = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of <= cutoff)
        .order_by(Fundamentals.as_of.desc(), Fundamentals.id.desc())
        .first()
    )
    if row:
        return row
    return (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of < as_of)
        .order_by(Fundamentals.as_of.asc(), Fundamentals.id.asc())
        .first()
    )


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
    db: Session, ticker: str, current: dict, as_of: date
) -> dict:
    """Period-over-period change in consensus estimates — a real revision.

    The previous implementation stored `estimatedEpsAvg` / `estimatedRevenueAvg`
    directly, i.e. estimate *levels*. Percentile-ranked within a sector that is
    largely a company-size factor, not a revisions factor, and it carries weight
    0.30 and gates every buy via `min_revisions_grade`.

    KNOWN GAP: FMP's v3 `analyst-estimates` endpoint only exposes the *current*
    consensus, not a consensus history, so a genuine revision cannot be computed
    on the very first fundamentals refresh for a ticker. We derive it from our
    own stored `Fundamentals` history instead, which means the factor is null
    (grade "F") until a ticker has two snapshots spanning the lookback, and null
    again for one cycle when the forward fiscal period rolls over. Null revisions
    fail `min_revisions_grade: "B+"`, so buys are blocked rather than made on a
    factor the backtest never used. `score_universe` logs coverage each run.
    """
    period = current.get("estimatePeriod")
    if not period:
        return {}
    prior_row = _prior_estimate_snapshot(db, ticker, as_of)
    prior = (prior_row.data or {}) if prior_row else {}
    if not prior or prior.get("estimatePeriod") != period:
        return {}
    out: dict = {}
    eps_rev = _pct_change(current.get("epsEstimateAvg"), prior.get("epsEstimateAvg"))
    rev_rev = _pct_change(
        current.get("revenueEstimateAvg"), prior.get("revenueEstimateAvg")
    )
    if eps_rev is not None:
        out["epsRevisionPct"] = eps_rev
    if rev_rev is not None:
        out["revenueRevisionPct"] = rev_rev
    if out:
        out["revisionBasisDate"] = prior_row.as_of.isoformat()
        out["revisionLookbackDays"] = (as_of - prior_row.as_of).days
    return out


def refresh_fundamentals(db: Session, fmp: FMPClient, max_tickers: int = 400) -> int:
    # Held positions are ALWAYS refreshed, whatever their size. Ranking by market
    # cap alone dropped 7 of 8 real holdings outside the cut, and an unscored
    # holding is invisible to `_removal_signals` (it skips any position with no
    # score) — the book would silently stop being evaluated for sells.
    held = {
        row[0]
        for row in db.query(Position.ticker).filter(Position.portfolio_id == 1).all()
    }
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
    for s in stocks:
        metrics = fmp.key_metrics_ttm(s.ticker) or {}
        ratios = fmp.ratios_ttm(s.ticker) or {}
        data = {**metrics, **ratios}
        estimate = _forward_estimate(fmp.analyst_estimates(s.ticker), as_of)
        if estimate:
            data.update(estimate)
            revision = compute_estimate_revisions(db, s.ticker, estimate, as_of)
            if revision:
                revisions_available += 1
            data.update(revision)
        if not data:
            continue
        db.add(Fundamentals(ticker=s.ticker, as_of=as_of, data=data))
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
        if not stock:
            # A ticker can be held without ever having come through
            # refresh_universe — manually entered positions are the common
            # case. Skipping them here silently left every hand-entered
            # position marked at its entry price forever.
            stock = Stock(ticker=ticker, name=q.get("name"), is_active=True)
            db.add(stock)
        stock.last_price = float(price)
        stock.updated_at = datetime.now(timezone.utc)
        upsert_price_bar(db, ticker, today, float(price))
        n += 1

    db.flush()

    # Update open position marks
    marked = 0
    for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all():
        stock = db.get(Stock, p.ticker)
        if stock and stock.last_price:
            p.current_price = stock.last_price
            marked += 1
        else:
            log.warning("No mark available for held position %s", p.ticker)
    log.info("Marked %s/%s open positions", marked, len(pos_tickers))

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
