"""Score universe from stored fundamentals + price bars."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.scoring import (
    composite_from_factor_pcts,
    factor_percentile_score,
    quant_rating_from_composite,
)

from app.db.models import CompositeScore, Fundamentals, PriceBar, Stock

log = logging.getLogger(__name__)

VALUATION_KEYS = [
    ("peRatioTTM", False),
    ("forwardPE", False),
    ("pegRatioTTM", False),
    ("enterpriseValueOverEBITDATTM", False),
    ("priceToBookRatioTTM", False),
    ("priceToSalesRatioTTM", False),
]
GROWTH_KEYS = [
    ("revenueGrowthTTM", True),
    ("epsgrowthTTM", True),
    ("netIncomeGrowthTTM", True),
]
PROFIT_KEYS = [
    ("grossProfitMarginTTM", True),
    ("operatingProfitMarginTTM", True),
    ("netProfitMarginTTM", True),
    ("returnOnEquityTTM", True),
    ("returnOnAssetsTTM", True),
    ("returnOnCapitalEmployedTTM", True),
]
# Period-over-period change in consensus estimates (see
# worker.services.ingest.compute_estimate_revisions). These replace the old
# `epsRevision` / `revenueRevision` keys, which held estimate *levels* and so
# ranked companies by size rather than by revision direction.
REVISION_KEYS = [
    ("epsRevisionPct", True),
    ("revenueRevisionPct", True),
]


def _momentum_12m(db: Session, ticker: str, as_of: date) -> float | None:
    bars = (
        db.query(PriceBar)
        .filter(PriceBar.ticker == ticker, PriceBar.date <= as_of)
        .order_by(PriceBar.date.desc())
        .limit(280)
        .all()
    )
    if len(bars) < 2:
        return None
    latest = bars[0].close
    target = as_of - timedelta(days=365)
    past = None
    for b in bars:
        if b.date <= target:
            past = b.close
            break
    if not past or past <= 0:
        # fallback oldest
        past = bars[-1].close
    if not past or past <= 0:
        return None
    return (latest / past) - 1.0


def score_universe(db: Session, params: StrategyParams | None = None) -> int:
    params = params or RUN118_PARAMS
    as_of = date.today()
    stocks = (
        db.query(Stock)
        .filter(Stock.is_active == True, Stock.is_etf == False)  # noqa: E712
        .filter(Stock.market_cap >= params.min_universe_market_cap)
        .all()
    )
    if not stocks:
        log.warning("No stocks to score")
        return 0

    # Latest fundamentals per ticker
    fund_rows = db.query(Fundamentals).order_by(Fundamentals.id.desc()).all()
    funds: dict[str, dict] = {}
    for f in fund_rows:
        if f.ticker not in funds:
            funds[f.ticker] = f.data or {}

    by_sector: dict[str, list[str]] = defaultdict(list)
    for s in stocks:
        if s.ticker in funds and s.sector:
            by_sector[s.sector].append(s.ticker)

    # (ticker, as_of) is unique, so a re-run on the same day must update in
    # place. Blind inserts would either violate the constraint or, before it
    # existed, create a duplicate "prior" row for the same day.
    existing_today = {
        row.ticker: row
        for row in db.query(CompositeScore).filter(CompositeScore.as_of == as_of).all()
    }

    written = 0
    with_revisions = 0
    for sector, tickers in by_sector.items():
        # Build metric columns
        def col(keys: list[tuple[str, bool]]) -> dict[str, list[float | None]]:
            out = {k: [] for k, _ in keys}
            for t in tickers:
                data = funds.get(t, {})
                for k, _ in keys:
                    v = data.get(k)
                    try:
                        out[k].append(float(v) if v is not None else None)
                    except (TypeError, ValueError):
                        out[k].append(None)
            return out

        val_cols = col(VALUATION_KEYS)
        gro_cols = col(GROWTH_KEYS)
        pro_cols = col(PROFIT_KEYS)
        rev_cols = col(REVISION_KEYS)

        # Average of per-metric percentiles.
        def avg_factor(cols, keys):
            pct_matrix = [factor_percentile_score(cols[k], hib) for k, hib in keys]
            result = []
            for i in range(len(tickers)):
                vals = [row[i] for row in pct_matrix if row[i] is not None]
                result.append(sum(vals) / len(vals) if vals else None)
            return result

        val_pcts = avg_factor(val_cols, VALUATION_KEYS)
        gro_pcts = avg_factor(gro_cols, GROWTH_KEYS)
        pro_pcts = avg_factor(pro_cols, PROFIT_KEYS)
        rev_pcts = avg_factor(rev_cols, REVISION_KEYS)

        # Momentum from prices
        mom_raw = [_momentum_12m(db, t, as_of) for t in tickers]
        mom_pcts = factor_percentile_score(mom_raw, True)

        for i, ticker in enumerate(tickers):
            factor_pcts = {
                "valuation": val_pcts[i],
                "growth": gro_pcts[i],
                "profitability": pro_pcts[i],
                "momentum": mom_pcts[i],
                "revisions": rev_pcts[i],
            }
            composite, grades = composite_from_factor_pcts(
                factor_pcts, params, momentum_12m=mom_raw[i]
            )
            if composite is None:
                continue
            if rev_pcts[i] is not None:
                with_revisions += 1
            qr = quant_rating_from_composite(composite)
            row = existing_today.get(ticker)
            if row is None:
                row = CompositeScore(ticker=ticker, as_of=as_of)
                db.add(row)
                existing_today[ticker] = row
            row.quant_rating = round(qr, 3)
            row.composite = round(composite, 3)
            row.valuation_grade = grades.get("valuation", "F")
            row.growth_grade = grades.get("growth", "F")
            row.profitability_grade = grades.get("profitability", "F")
            row.momentum_grade = grades.get("momentum", "F")
            row.revisions_grade = grades.get("revisions", "F")
            row.sector = sector
            written += 1

    db.commit()
    log.info("Wrote %s composite scores", written)
    if written and not with_revisions:
        log.warning(
            "0/%s scored tickers have an estimate-revisions value. Revisions "
            "carries weight %.2f and gates every buy via min_revisions_grade=%s, "
            "so no buys will pass until consensus history accumulates.",
            written,
            params.weight_revisions,
            params.buy_criteria.min_revisions_grade,
        )
    else:
        log.info("Revisions coverage: %s/%s scored tickers", with_revisions, written)
    return written
