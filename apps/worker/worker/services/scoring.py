"""Score universe from stored fundamentals + price bars."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.scoring import (
    average_percentile,
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
REVISION_KEYS = [
    ("epsRevision", True),
    ("revenueRevision", True),
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

    written = 0
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

        val_pcts = [
            average_percentile(
                [
                    factor_percentile_score(val_cols[k], hib)[i]
                    for k, hib in VALUATION_KEYS
                ]
            )
            for i in range(len(tickers))
        ]
        # Simpler: average of per-metric percentiles
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
            qr = quant_rating_from_composite(composite)
            db.add(
                CompositeScore(
                    ticker=ticker,
                    as_of=as_of,
                    quant_rating=round(qr, 3),
                    composite=round(composite, 3),
                    valuation_grade=grades.get("valuation", "F"),
                    growth_grade=grades.get("growth", "F"),
                    profitability_grade=grades.get("profitability", "F"),
                    momentum_grade=grades.get("momentum", "F"),
                    revisions_grade=grades.get("revisions", "F"),
                    sector=sector,
                )
            )
            written += 1

    db.commit()
    log.info("Wrote %s composite scores", written)
    return written
