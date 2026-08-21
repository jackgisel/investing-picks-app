"""Score universe from stored fundamentals + price bars."""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, ScoreSnapshot, StrategyParams
from outpick_strategy.scoring import (
    composite_from_factor_pcts,
    factor_percentile_score,
    quant_rating_from_composite,
)

from app.db.models import CompositeScore, Fundamentals, Position, PriceBar, Stock

log = logging.getLogger(__name__)

# A snapshot older than this is not evidence about the company today. Scoring a
# stale row against freshly-refreshed peers ranks it on out-of-date inputs.
FUNDAMENTALS_MAX_AGE_DAYS = 45

# Fewest names a sector must contain before a percentile rank within it means
# anything. The previous system of record (Run 118) required 15; this matches it.
#
# `factor_percentile_score` maps the better of two values to 100.0 and the worse
# to 0.0. With five factors that hands the better of a two-name sector a
# composite of 100 -> quant_rating 5.0 with A+ on valuation, growth,
# profitability, momentum AND revisions, clearing min_quant_rating 4.0 and every
# grade floor in BuyCriteria at once — on no information, from being marginally
# the less bad of two mediocre names. n=1 is accidentally safe (50.0 -> QR 3.0,
# under the buy gate), which is what makes n=2 a cliff rather than a slope.
# min_factor_coverage = 1.0 shrinks the covered population of every sector, so
# small sectors are ordinary rather than exotic.
#
# Below this the sector is not ranked at all: its tickers are counted in
# `considered` and named in a warning, never scored. Ranking them anyway is the
# bug; dropping them silently is BUG-W3's failure mode.
MIN_SECTOR_POPULATION = 15

# BUG-P3. `composite_from_factor_pcts` takes a `z_score` and rejects anything
# below `params.z_score_floor` (1.8 in Run 118) as a bankruptcy-risk name — but
# the parameter defaults to None and None means "skip the check", so a caller
# that simply omits it disables the filter with no error anywhere. This caller
# is the only production caller.
#
# We pass it EXPLICITLY as None because the input genuinely cannot be sourced
# today, not because the check is unwanted: an Altman Z needs working capital,
# retained earnings, EBIT, market cap, total liabilities, sales and total
# assets, and `FMPClient` exposes no balance-sheet or financial-scores endpoint
# at all. `Fundamentals.data` is `{**key_metrics_ttm, **ratios_ttm}` plus
# derived growth/revisions, and no field in it carries a Z-score. Deriving one
# from what IS there would be inventing a solvency number, which is worse than
# not having one. `score_universe` warns every run so the gap stays visible
# instead of reading as a filter that passes everything.
Z_SCORE_UNAVAILABLE = None

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

# How stale the NEWEST bar may be and still be treated as "the price now".
#
# Only held positions, the top-rated candidate slice and the comparison ETFs
# get a fresh bar from `refresh_marks`; `backfill_price_history` skips any
# ticker that already has 200 bars. So for much of the universe the newest bar
# is frozen at the backfill date while the `as_of - 365d` anchor keeps
# advancing, and dividing a months-old close by that anchor is not a 12-month
# return — it is a return over some shorter, unknown window, percentile-ranked
# against candidates whose newest bar really is today. A name that doubled into
# its last recorded close and has since halved reports +100% and tops its sector
# on momentum.
#
# Same magnitude as the anchor tolerance, and for the same reason: it bounds how
# far the measured window may drift from 365 days, which is a property of the
# measurement rather than of the job schedule. Symmetric drift at both ends
# keeps the window within roughly +/- 7% of a year.
MOMENTUM_LATEST_MAX_AGE_DAYS = 25


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
    latest_date, latest = bars[0]
    # Both ends of the window must be real. Refusing here makes the ticker
    # unscoreable under min_factor_coverage = 1.0 rather than scored on a
    # fabricated return — and an unscoreable ticker is neither bought nor, for a
    # holding, exited, so this is the conservative direction on both sides.
    if (as_of - latest_date).days > MOMENTUM_LATEST_MAX_AGE_DAYS:
        return None
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


@dataclass
class ScoredTicker:
    ticker: str
    sector: str
    composite: float
    quant_rating: float
    grades: dict[str, str]
    factor_pcts: dict[str, float | None]
    momentum_12m: float | None


@dataclass(frozen=True)
class UnscoredHolding:
    """A live position with no row in the latest CompositeScore run.

    The dashboard renders this as "unrated". `_removal_signals` skips the name,
    so it cannot be sold either. That is a production incident, not a Hold.
    """

    ticker: str
    reason: str
    as_of: date | None


def _load_scoring_universe(
    db: Session, params: StrategyParams, as_of: date
) -> tuple[dict[str, dict], dict[str, list[str]]]:
    """Latest-in-window fundamentals and sector peer groups.

    The SQL universe filter lives here so `diagnose_unscored_holdings` walks the
    same gates `compute_scores` does. A held ticker missing from `by_sector`
    failed one of: inactive, ETF, market-cap floor, no sector, no recent
    fundamentals.
    """
    stocks = (
        db.query(Stock)
        .filter(Stock.is_active == True, Stock.is_etf == False)  # noqa: E712
        .filter(Stock.market_cap >= params.min_universe_market_cap)
        .all()
    )
    oldest_allowed = as_of - timedelta(days=FUNDAMENTALS_MAX_AGE_DAYS)
    latest_ids = (
        db.query(func.max(Fundamentals.id))
        # BUG-P4. The upper bound is the point-in-time half. Prices are already
        # bounded on both sides (`PriceBar.date <= as_of` in
        # load_price_history); fundamentals had only the lower bound, so a call
        # with a historical `as_of` would rank honest prices against
        # fundamentals published after the date being simulated. Live scoring
        # never noticed because `as_of` is always today — which is exactly why
        # this had to be fixed BEFORE a backtester exists rather than after,
        # since the look-ahead would show up as skill.
        .filter(Fundamentals.as_of >= oldest_allowed, Fundamentals.as_of <= as_of)
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
    return funds, by_sector


def _rank_sector(
    sector: str,
    tickers: list[str],
    funds: dict[str, dict],
    history: dict[str, list[tuple[date, float]]],
    params: StrategyParams,
    as_of: date,
) -> tuple[list[ScoredTicker], dict[str, list[str]]]:
    """Percentile-rank `tickers` as one peer group.

    Caller guarantees `len(tickers) >= MIN_SECTOR_POPULATION`. Returns the
    scored subset and, for every name that failed the coverage floor, the
    factor names that were null.
    """

    def col(keys) -> dict[str, list[float | None]]:
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

    def avg_factor(cols, keys):
        pct_matrix = [
            factor_percentile_score(cols[aliases[0]], hib) for aliases, hib in keys
        ]
        result = []
        for i in range(len(tickers)):
            vals = [row[i] for row in pct_matrix if row[i] is not None]
            result.append(sum(vals) / len(vals) if vals else None)
        return result

    val_pcts = avg_factor(col(VALUATION_KEYS), VALUATION_KEYS)
    gro_pcts = avg_factor(col(GROWTH_KEYS), GROWTH_KEYS)
    pro_pcts = avg_factor(col(PROFIT_KEYS), PROFIT_KEYS)
    rev_pcts = avg_factor(col(REVISION_KEYS), REVISION_KEYS)
    mom_raw = [_momentum_12m(history, t, as_of) for t in tickers]
    mom_pcts = factor_percentile_score(mom_raw, True)

    scored: list[ScoredTicker] = []
    missing_by_ticker: dict[str, list[str]] = {}
    for i, ticker in enumerate(tickers):
        factor_pcts = {
            "valuation": val_pcts[i],
            "growth": gro_pcts[i],
            "profitability": pro_pcts[i],
            "momentum": mom_pcts[i],
            "revisions": rev_pcts[i],
        }
        composite, grades = composite_from_factor_pcts(
            factor_pcts,
            params,
            momentum_12m=mom_raw[i],
            # Explicit, not omitted — see Z_SCORE_UNAVAILABLE. Passing the
            # argument by name is what stops this reading as an oversight
            # the next person "fixes" by deleting the parameter.
            z_score=Z_SCORE_UNAVAILABLE,
        )
        if composite is None:
            missing_by_ticker[ticker] = [
                name for name, pct in factor_pcts.items() if pct is None
            ]
            continue
        scored.append(
            ScoredTicker(
                ticker=ticker,
                sector=sector,
                composite=composite,
                quant_rating=quant_rating_from_composite(composite),
                grades=grades,
                factor_pcts=factor_pcts,
                momentum_12m=mom_raw[i],
            )
        )
    return scored, missing_by_ticker


def compute_scores(
    db: Session, params: StrategyParams, as_of: date
) -> tuple[list[ScoredTicker], dict[str, int], int]:
    """Score the universe in memory. Writes nothing.

    Shared by the persisting `score_universe` and the read-only simulation
    behind the ops dry-run, so the two can never drift — the repo's rule is that
    live and simulated paths run the same code.

    Returns (scored, missing_factor_counts, considered).
    """
    funds, by_sector = _load_scoring_universe(db, params, as_of)
    if not by_sector:
        return [], {}, 0

    scored: list[ScoredTicker] = []
    missing_factor: dict[str, int] = defaultdict(int)
    considered = 0
    thin_sectors: dict[str, int] = {}

    for sector, tickers in by_sector.items():
        if len(tickers) < MIN_SECTOR_POPULATION:
            # Counted, named, and not ranked. `considered` still moves so these
            # tickers show up in score_universe's unscoreable arithmetic instead
            # of vanishing the way a NULL sector used to (BUG-W3).
            considered += len(tickers)
            thin_sectors[sector] = len(tickers)
            continue

        history = load_price_history(db, tickers, as_of)
        ranked, missing_by_ticker = _rank_sector(
            sector, tickers, funds, history, params, as_of
        )
        considered += len(tickers)
        scored.extend(ranked)
        for names in missing_by_ticker.values():
            for name in names:
                missing_factor[name] += 1

    if thin_sectors:
        log.warning(
            "%s tickers were not ranked: their sector holds fewer than %s names "
            "with usable fundamentals, and a percentile within a population that "
            "small is not evidence. Sectors: %s. These tickers cannot be bought, "
            "and any held position among them is skipped by the sell rules too.",
            sum(thin_sectors.values()),
            MIN_SECTOR_POPULATION,
            dict(sorted(thin_sectors.items(), key=lambda kv: -kv[1])),
        )
    return scored, dict(missing_factor), considered


def _held_tickers(db: Session) -> list[str]:
    return sorted(
        {
            row[0]
            for row in db.query(Position.ticker)
            .filter(Position.portfolio_id == 1)
            .all()
        }
    )


def _missing_factor_reason(missing: list[str]) -> str:
    names = ", ".join(missing)
    if missing == ["revisions"]:
        return (
            "missing factors: revisions. Revisions go null for one cycle when "
            "the forward fiscal period rolls over, and min_factor_coverage = 1.0 "
            "then refuses to rate the ticker."
        )
    if missing == ["momentum"]:
        return (
            "missing factors: momentum. Momentum needs a bar near as_of minus "
            "365 days; a short or gapped series makes the whole ticker "
            "unscoreable under min_factor_coverage = 1.0."
        )
    return f"missing factors: {names}"


def diagnose_unscored_holdings(
    db: Session, params: StrategyParams | None = None
) -> list[UnscoredHolding]:
    """Why each open position is missing from the latest score run.

    Matches `_latest_ratings` / the dashboard: a name is unrated when it has no
    row on `max(composite_scores.as_of)`, even if an older row still exists.
    Structural gates are checked in the same order as `compute_scores`.
    """
    params = params or RUN118_PARAMS
    held = _held_tickers(db)
    if not held:
        return []

    latest = db.query(func.max(CompositeScore.as_of)).scalar()
    if latest is None:
        return [
            UnscoredHolding(
                ticker=ticker,
                reason="universe has never been scored",
                as_of=None,
            )
            for ticker in held
        ]

    scored = {
        row[0]
        for row in db.query(CompositeScore.ticker)
        .filter(CompositeScore.as_of == latest)
        .all()
    }
    missing = [ticker for ticker in held if ticker not in scored]
    if not missing:
        return []

    funds, by_sector = _load_scoring_universe(db, params, latest)
    oldest_allowed = latest - timedelta(days=FUNDAMENTALS_MAX_AGE_DAYS)
    sector_drops: dict[str, dict[str, list[str]]] = {}
    out: list[UnscoredHolding] = []
    for ticker in missing:
        reason = _diagnose_ticker(
            db,
            ticker,
            params,
            latest,
            oldest_allowed,
            funds,
            by_sector,
            sector_drops,
        )
        out.append(UnscoredHolding(ticker=ticker, reason=reason, as_of=latest))
    return out


def _diagnose_ticker(
    db: Session,
    ticker: str,
    params: StrategyParams,
    as_of: date,
    oldest_allowed: date,
    funds: dict[str, dict],
    by_sector: dict[str, list[str]],
    sector_drops: dict[str, dict[str, list[str]]],
) -> str:
    stock = db.get(Stock, ticker)
    if stock is None:
        return "no stock row; it was never ingested"
    if stock.is_etf:
        return "marked as an ETF; scoring excludes ETFs"
    if not stock.is_active:
        return "inactive; scoring skips inactive names"
    if stock.market_cap is None:
        return (
            "market cap unknown; scoring requires "
            f">= {params.min_universe_market_cap:,.0f}"
        )
    if stock.market_cap < params.min_universe_market_cap:
        return (
            f"market cap {stock.market_cap:,.0f} is below the "
            f"{params.min_universe_market_cap:,.0f} universe floor"
        )
    if not stock.sector:
        return "no sector; cannot be peer-ranked"
    if ticker not in funds:
        return (
            f"no fundamentals on or after {oldest_allowed.isoformat()} "
            f"(scoring as_of {as_of.isoformat()})"
        )
    peers = by_sector.get(stock.sector, [])
    if len(peers) < MIN_SECTOR_POPULATION:
        return (
            f"{stock.sector} has {len(peers)} names with usable fundamentals; "
            f"need {MIN_SECTOR_POPULATION} before a percentile is evidence"
        )
    if stock.sector not in sector_drops:
        history = load_price_history(db, peers, as_of)
        _ranked, missing_by_ticker = _rank_sector(
            stock.sector, peers, funds, history, params, as_of
        )
        sector_drops[stock.sector] = missing_by_ticker
    missing_factors = sector_drops[stock.sector].get(ticker)
    if missing_factors:
        return _missing_factor_reason(missing_factors)
    return "unscoreable for an unclassified reason"


def preview_scores(
    db: Session, params: StrategyParams, as_of: date
) -> tuple[dict[str, ScoreSnapshot], dict[str, int], int]:
    """Scores as ScoreSnapshots for `evaluate()`, without touching the database."""
    scored, missing, considered = compute_scores(db, params, as_of)
    snapshots = {
        s.ticker: ScoreSnapshot(
            ticker=s.ticker,
            quant_rating=s.quant_rating,
            valuation_grade=s.grades.get("valuation", "F"),
            growth_grade=s.grades.get("growth", "F"),
            profitability_grade=s.grades.get("profitability", "F"),
            momentum_grade=s.grades.get("momentum", "F"),
            revisions_grade=s.grades.get("revisions", "F"),
            sector=s.sector,
        )
        for s in scored
    }
    return snapshots, missing, considered


def score_universe(db: Session, params: StrategyParams | None = None) -> int:
    params = params or RUN118_PARAMS
    as_of = date.today()

    scored, missing_factor, considered = compute_scores(db, params, as_of)
    if not considered:
        log.warning("No stocks to score")
        return 0

    # (ticker, as_of) is unique, so a re-run on the same day must update in
    # place. Blind inserts would either violate the constraint or, before it
    # existed, create a duplicate "prior" row for the same day.
    existing_today = {
        row.ticker: row
        for row in db.query(CompositeScore).filter(CompositeScore.as_of == as_of).all()
    }

    written = 0
    with_revisions = 0
    dropped = 0
    for s in scored:
        if s.factor_pcts.get("revisions") is not None:
            with_revisions += 1
        row = existing_today.pop(s.ticker, None)
        if row is None:
            row = CompositeScore(ticker=s.ticker, as_of=as_of)
            db.add(row)
        row.quant_rating = round(s.quant_rating, 3)
        row.composite = round(s.composite, 3)
        row.valuation_grade = s.grades.get("valuation", "F")
        row.growth_grade = s.grades.get("growth", "F")
        row.profitability_grade = s.grades.get("profitability", "F")
        row.momentum_grade = s.grades.get("momentum", "F")
        row.revisions_grade = s.grades.get("revisions", "F")
        row.sector = s.sector
        written += 1

    # Anything still in existing_today was scored by an earlier run today and is
    # unscoreable now. Leaving it makes `load_latest_scores` serve a stale rating
    # as current — the strategy would trade on a number this run just decided it
    # cannot stand behind.
    for stale in existing_today.values():
        db.delete(stale)
        dropped += 1

    unscoreable = considered - written

    db.commit()
    log.info(
        "Wrote %s composite scores (%s unscoreable, %s stale rows dropped)",
        written,
        unscoreable,
        dropped,
    )
    unrated = diagnose_unscored_holdings(db, params)
    if unrated:
        # Named, not folded into the coverage-floor warning above. That warning
        # is an aggregate over the whole universe; a held ticker vanishing
        # inside it is how WDC sat "unrated" on the dashboard with nobody
        # mailed. Sell rules skip any name with no score.
        log.error(
            "UNRATED HOLDINGS as of %s. Sell rules skip these names: %s",
            as_of,
            {row.ticker: row.reason for row in unrated},
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
    if written:
        # BUG-P3, stated every run rather than left to be rediscovered. A
        # configured floor that never rejects anything is indistinguishable, in
        # the params and in the ops UI, from one that passes every name.
        log.warning(
            "The z_score_floor=%.2f bankruptcy filter did NOT run on any of the "
            "%s scored tickers: no FMP endpoint on this client supplies a "
            "Z-score, so distressed names the backtest excluded are buyable.",
            params.z_score_floor,
            written,
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
