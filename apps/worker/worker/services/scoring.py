"""Score universe from stored fundamentals + price bars."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.scoring import (
    composite_from_factor_pcts,
    factor_percentile_score,
    quant_rating_from_composite,
)

from app.db.models import CompositeScore, Fundamentals, PriceBar, Stock

log = logging.getLogger(__name__)

# A snapshot older than this is not evidence about the company today. Scoring a
# stale row against freshly-refreshed peers ranks it on out-of-date inputs.
FUNDAMENTALS_MAX_AGE_DAYS = 45

# Each entry is (aliases, higher_is_better). Aliases are tried in order and
# collapse to ONE percentile column: listing an old and new name as separate
# metrics would percentile-rank two disjoint populations (snapshots written
# under each shape) and average across them, which means nothing.
#
# `/stable` renamed several of these and the migration missed them, so four of
# the six valuation metrics silently resolved to None on every ticker. Legacy
# names are kept as fallbacks so snapshots taken under either shape score.
VALUATION_KEYS = [
    (("priceToEarningsRatioTTM", "peRatioTTM"), False),
    (("priceToEarningsGrowthRatioTTM", "pegRatioTTM"), False),
    (("evToEBITDATTM", "enterpriseValueOverEBITDATTM"), False),
    (("priceToBookRatioTTM",), False),
    (("priceToSalesRatioTTM",), False),
]
# Derived in `compute_ttm_growth` from quarterly income statements — FMP exposes
# no TTM growth metric of its own. The legacy `epsgrowthTTM` name is NOT aliased
# here: it never carried a value, so there is nothing to stay compatible with.
GROWTH_KEYS = [
    (("revenueGrowthTTM",), True),
    (("epsGrowthTTM",), True),
    (("netIncomeGrowthTTM",), True),
]
PROFIT_KEYS = [
    (("grossProfitMarginTTM",), True),
    (("operatingProfitMarginTTM",), True),
    (("netProfitMarginTTM",), True),
    (("returnOnEquityTTM",), True),
    (("returnOnAssetsTTM",), True),
    (("returnOnCapitalEmployedTTM",), True),
]
# Period-over-period change in consensus estimates (see
# worker.services.ingest.compute_estimate_revisions). These replace the old
# `epsRevision` / `revenueRevision` keys, which held estimate *levels* and so
# ranked companies by size rather than by revision direction.
REVISION_KEYS = [
    (("epsRevisionPct",), True),
    (("revenueRevisionPct",), True),
]


# How far before the 365-day mark an anchor bar may sit and still count as a
# 12-month return. Holidays and thin trading move the exact anniversary around;
# beyond this the window is a different measurement.
MOMENTUM_ANCHOR_TOLERANCE_DAYS = 25


def load_price_history(
    db: Session, tickers: list[str], as_of: date
) -> dict[str, list[tuple[date, float]]]:
    """All bars we need for momentum, newest first, in ONE query.

    Previously this was a per-ticker query returning up to 280 full ORM
    PriceBar objects. That was nearly free only because the table was almost
    empty; a populated universe makes it hundreds of round trips and >100k
    instances pinned in the identity map for the whole scoring pass.
    """
    if not tickers:
        return {}
    window_start = as_of - timedelta(days=365 + MOMENTUM_ANCHOR_TOLERANCE_DAYS + 40)
    rows = (
        db.query(PriceBar.ticker, PriceBar.date, PriceBar.close)
        .filter(
            PriceBar.ticker.in_(tickers),
            PriceBar.date <= as_of,
            PriceBar.date >= window_start,
        )
        .order_by(PriceBar.ticker, PriceBar.date.desc())
        .all()
    )
    out: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for ticker, bar_date, close in rows:
        out[ticker].append((bar_date, close))
    return out


def _momentum_12m(
    history: dict[str, list[tuple[date, float]]], ticker: str, as_of: date
) -> float | None:
    """12-month return, or None when we cannot actually measure 12 months.

    The old fallback used the OLDEST available bar whenever nothing sat at or
    before the 365-day mark, then returned it as a 12-month figure. A ticker
    with six months of history produced a six-month return, percentile-ranked
    against real annual ones and fed to `momentum_penalty`. Refuse instead.
    """
    bars = history.get(ticker) or []
    if len(bars) < 2:
        return None
    latest = bars[0][1]
    target = as_of - timedelta(days=365)
    earliest_ok = target - timedelta(days=MOMENTUM_ANCHOR_TOLERANCE_DAYS)
    past = None
    for bar_date, close in bars:
        if bar_date <= target:
            past = close if bar_date >= earliest_ok else None
            break
    if not past or past <= 0 or not latest or latest <= 0:
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

    # Latest fundamentals per ticker, and ONLY the latest. This used to load
    # every row ever written — JSON payload included — and discard all but the
    # newest per ticker immediately after. At ~405 rows a week that grows without
    # bound, and the same code runs inside the API process for on-demand
    # refreshes.
    #
    # The max-age cut matters just as much: `refresh_fundamentals` caps at
    # max_tickers, so a name that drops out of the budget keeps an old snapshot
    # and would otherwise be scored against fresh peers forever.
    oldest_allowed = as_of - timedelta(days=FUNDAMENTALS_MAX_AGE_DAYS)
    latest_ids = (
        db.query(func.max(Fundamentals.id))
        .filter(Fundamentals.as_of >= oldest_allowed)
        .group_by(Fundamentals.ticker)
        .subquery()
    )
    funds: dict[str, dict] = {
        f.ticker: (f.data or {})
        for f in db.query(Fundamentals).filter(Fundamentals.id.in_(select(latest_ids)))
    }

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
    unscoreable = 0
    dropped = 0
    missing_factor: dict[str, int] = defaultdict(int)
    for sector, tickers in by_sector.items():
        # Build metric columns
        def col(keys) -> dict[str, list[float | None]]:
            """One column per metric, taking the first alias that has a value."""
            out = {aliases[0]: [] for aliases, _ in keys}
            for t in tickers:
                data = funds.get(t, {})
                for aliases, _ in keys:
                    value = None
                    for alias in aliases:
                        raw = data.get(alias)
                        if raw is None:
                            continue
                        try:
                            value = float(raw)
                        except (TypeError, ValueError):
                            value = None
                        if value is not None:
                            break
                    out[aliases[0]].append(value)
            return out

        val_cols = col(VALUATION_KEYS)
        gro_cols = col(GROWTH_KEYS)
        pro_cols = col(PROFIT_KEYS)
        rev_cols = col(REVISION_KEYS)

        # Average of per-metric percentiles.
        def avg_factor(cols, keys):
            pct_matrix = [
                factor_percentile_score(cols[aliases[0]], hib) for aliases, hib in keys
            ]
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
        history = load_price_history(db, tickers, as_of)
        mom_raw = [_momentum_12m(history, t, as_of) for t in tickers]
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
                # Unscoreable now, but an earlier run today may have written a
                # row. Leaving it makes `load_latest_scores` serve a stale
                # rating as current — the strategy would trade on a number this
                # run just decided it cannot stand behind.
                stale = existing_today.pop(ticker, None)
                if stale is not None:
                    db.delete(stale)
                    dropped += 1
                for name, pct in factor_pcts.items():
                    if pct is None:
                        missing_factor[name] += 1
                unscoreable += 1
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
    log.info(
        "Wrote %s composite scores (%s unscoreable, %s stale rows dropped)",
        written,
        unscoreable,
        dropped,
    )
    if unscoreable:
        log.warning(
            "%s/%s candidates failed the %.0f%% factor-coverage floor. Missing "
            "factor counts: %s. These tickers are NOT scored, so they cannot be "
            "bought and — importantly — any held position among them is skipped "
            "by the sell rules too.",
            unscoreable,
            unscoreable + written,
            params.min_factor_coverage * 100,
            dict(sorted(missing_factor.items(), key=lambda kv: -kv[1])),
        )
    if not written:
        log.error(
            "NO tickers scored. `load_latest_scores` falls back to the previous "
            "scoring date, so an evaluation would run on stale scores rather "
            "than fail — treat this as an outage."
        )
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
