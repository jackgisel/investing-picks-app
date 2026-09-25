"""Point-in-time fundamentals for one as-of date.

A score on date d may only read filings with `available_from <= d`, closes and
market caps on or before d, and consensus snapshots with `as_of <= d`. The
payload uses the same JSON keys `scoring.py` already reads so
`compute_scores()` is unchanged aside from the optional universe hook.
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.db.models import (
    ConsensusSnapshot,
    Filing,
    Fundamentals,
    MarketCapHistory,
    PriceBar,
)
from worker.services.ingest import (
    _forward_estimate,
    compute_estimate_revisions,
    compute_fy2_revisions,
    compute_ttm_growth,
    first_present,
)

log = logging.getLogger(__name__)

SOURCE_PIT = "pit"
# Tape stamp. Bump when derivation pairing rules change so score_dataset and
# walk-forward re-derive Fridays that still carry an older pit payload.
DERIVE_VERSION = 2


def _num(row: dict | None, *keys) -> float | None:
    if not row:
        return None
    raw = first_present(row, *keys)
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value != value:  # NaN
        return None
    return value


def _ttm_sum(rows: list[dict], *keys) -> float | None:
    if len(rows) < 4:
        return None
    total = 0.0
    for row in rows[:4]:
        value = _num(row, *keys)
        if value is None:
            return None
        total += value
    return total


def filings_as_of(
    db: Session, ticker: str, statement_type: str, as_of: date, limit: int = 12
) -> list[dict]:
    rows = (
        db.query(Filing)
        .filter(
            Filing.ticker == ticker,
            Filing.statement_type == statement_type,
            Filing.available_from <= as_of,
        )
        .order_by(Filing.period.desc())
        .limit(limit)
        .all()
    )
    return [dict(row.data or {}) for row in rows]


def close_as_of(db: Session, ticker: str, as_of: date) -> float | None:
    row = (
        db.query(PriceBar)
        .filter(PriceBar.ticker == ticker, PriceBar.date <= as_of)
        .order_by(PriceBar.date.desc())
        .first()
    )
    return None if row is None else row.close


def market_cap_as_of(db: Session, ticker: str, as_of: date) -> float | None:
    row = (
        db.query(MarketCapHistory)
        .filter(MarketCapHistory.ticker == ticker, MarketCapHistory.date <= as_of)
        .order_by(MarketCapHistory.date.desc())
        .first()
    )
    return None if row is None else row.market_cap


def _latest_snapshots_as_of(db: Session, ticker: str, as_of: date) -> list[dict]:
    """Newest vintage per fiscal period with snapshot.as_of <= d."""
    latest: dict[date, ConsensusSnapshot] = {}
    for row in (
        db.query(ConsensusSnapshot)
        .filter(ConsensusSnapshot.ticker == ticker, ConsensusSnapshot.as_of <= as_of)
        .all()
    ):
        prior = latest.get(row.fiscal_period)
        if prior is None or row.as_of > prior.as_of:
            latest[row.fiscal_period] = row
    estimates = []
    for period, row in latest.items():
        estimates.append(
            {
                "date": period.isoformat() if isinstance(period, date) else str(period),
                "epsAvg": row.eps_avg,
                "revenueAvg": row.revenue_avg,
                "_vintage_as_of": row.as_of,
            }
        )
    return estimates


def _estimate_from_fundamentals(data: dict) -> dict | None:
    if not data.get("estimatePeriod"):
        return None
    return {
        "estimatePeriod": data.get("estimatePeriod"),
        "epsEstimateAvg": data.get("epsEstimateAvg"),
        "revenueEstimateAvg": data.get("revenueEstimateAvg"),
    }


def _segment_a_estimate(
    db: Session, ticker: str, as_of: date
) -> tuple[dict | None, date | None]:
    """Fall back to an exported live fundamentals vintage (Segment A).

    Skip `source=pit` rows: those are this module's own writes and must never
    supply the current estimate (or a prior) on a re-derive.
    """
    rows = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of <= as_of)
        .order_by(Fundamentals.as_of.desc(), Fundamentals.id.desc())
        .all()
    )
    for row in rows:
        data = dict(row.data or {})
        if data.get("source") == SOURCE_PIT:
            continue
        estimate = _estimate_from_fundamentals(data)
        if estimate is None:
            continue
        return estimate, row.as_of
    return None, None


def _vintage_for_estimate(snapshots: list[dict], estimate: dict) -> date | None:
    period = estimate.get("estimatePeriod")
    for snap in snapshots:
        if str(snap.get("date") or "") == str(period or ""):
            vintage = snap.get("_vintage_as_of")
            if isinstance(vintage, date):
                return vintage
    vintages = [
        snap["_vintage_as_of"]
        for snap in snapshots
        if isinstance(snap.get("_vintage_as_of"), date)
    ]
    return max(vintages) if vintages else None


def current_estimate(
    db: Session, ticker: str, as_of: date
) -> tuple[dict | None, date | None]:
    """Return (estimate, vintage_as_of). Vintage is the snapshot/row `as_of`
    that supplied the estimate, never a `source=pit` row."""
    snapshots = _latest_snapshots_as_of(db, ticker, as_of)
    estimate = _forward_estimate(snapshots, as_of)
    if estimate:
        return estimate, _vintage_for_estimate(snapshots, estimate)
    return _segment_a_estimate(db, ticker, as_of)


def current_fy2_estimate(
    db: Session, ticker: str, as_of: date
) -> tuple[dict | None, date | None]:
    """Next-fiscal-year estimate and its vintage. Snapshots only; see FY1."""
    snapshots = _latest_snapshots_as_of(db, ticker, as_of)
    estimate = _forward_estimate(snapshots, as_of, nth=1)
    if not estimate:
        return None, None
    return estimate, _vintage_for_estimate(snapshots, estimate)


def _profitability(income: list[dict], balance: list[dict]) -> dict:
    ttm_rev = _ttm_sum(income, "revenue")
    ttm_gp = _ttm_sum(income, "grossProfit")
    ttm_oi = _ttm_sum(income, "operatingIncome")
    ttm_ni = _ttm_sum(income, "netIncome")
    ttm_ebit = _ttm_sum(income, "ebit", "operatingIncome")
    latest_bs = balance[0] if balance else None
    equity = _num(latest_bs, "totalStockholdersEquity", "totalEquity")
    assets = _num(latest_bs, "totalAssets")
    current_liab = _num(latest_bs, "totalCurrentLiabilities")
    out: dict = {}
    if ttm_rev and ttm_rev != 0:
        if ttm_gp is not None:
            out["grossProfitMarginTTM"] = ttm_gp / ttm_rev
        if ttm_oi is not None:
            out["operatingProfitMarginTTM"] = ttm_oi / ttm_rev
        if ttm_ni is not None:
            out["netProfitMarginTTM"] = ttm_ni / ttm_rev
    if ttm_ni is not None and equity and equity != 0:
        out["returnOnEquityTTM"] = ttm_ni / equity
    if ttm_ni is not None and assets and assets != 0:
        out["returnOnAssetsTTM"] = ttm_ni / assets
    capital = None
    if assets is not None and current_liab is not None:
        capital = assets - current_liab
    if ttm_ebit is not None and capital and capital != 0:
        out["returnOnCapitalEmployedTTM"] = ttm_ebit / capital
    return out


def _valuation(
    *,
    close: float | None,
    market_cap: float | None,
    income: list[dict],
    balance: list[dict],
    eps_growth: float | None,
) -> dict:
    ttm_ni = _ttm_sum(income, "netIncome")
    ttm_rev = _ttm_sum(income, "revenue")
    ttm_ebitda = _ttm_sum(income, "ebitda")
    shares = _num(income[0], "weightedAverageShsOutDil") if income else None
    latest_bs = balance[0] if balance else None
    equity = _num(latest_bs, "totalStockholdersEquity", "totalEquity")
    cash = _num(latest_bs, "cashAndCashEquivalents", "cashAndShortTermInvestments") or 0.0
    debt = _num(latest_bs, "totalDebt")
    if debt is None and latest_bs is not None:
        st = _num(latest_bs, "shortTermDebt") or 0.0
        lt = _num(latest_bs, "longTermDebt") or 0.0
        debt = st + lt
    if market_cap is None and close is not None and shares:
        market_cap = close * shares
    ttm_eps = (ttm_ni / shares) if ttm_ni is not None and shares else None
    out: dict = {}
    pe = None
    if close is not None and ttm_eps and ttm_eps > 0:
        pe = close / ttm_eps
        out["priceToEarningsRatioTTM"] = pe
    if pe is not None and eps_growth and eps_growth > 0:
        out["priceToEarningsGrowthRatioTTM"] = pe / (eps_growth * 100.0)
    if market_cap is not None and ttm_rev and ttm_rev > 0:
        out["priceToSalesRatioTTM"] = market_cap / ttm_rev
    if market_cap is not None and equity and equity > 0:
        out["priceToBookRatioTTM"] = market_cap / equity
    if market_cap is not None and ttm_ebitda and ttm_ebitda > 0:
        ev = market_cap + (debt or 0.0) - cash
        out["evToEBITDATTM"] = ev / ttm_ebitda
    return out


def altman_z(
    *,
    market_cap: float | None,
    income: list[dict],
    balance: list[dict],
) -> float | None:
    """Classic five-factor Altman Z. None if any required input is missing."""
    latest_bs = balance[0] if balance else None
    assets = _num(latest_bs, "totalAssets")
    if not assets:
        return None
    current_assets = _num(latest_bs, "totalCurrentAssets")
    current_liab = _num(latest_bs, "totalCurrentLiabilities")
    retained = _num(latest_bs, "retainedEarnings")
    liabilities = _num(latest_bs, "totalLiabilities")
    ttm_ebit = _ttm_sum(income, "ebit", "operatingIncome")
    ttm_rev = _ttm_sum(income, "revenue")
    if (
        current_assets is None
        or current_liab is None
        or retained is None
        or liabilities is None
        or not liabilities
        or ttm_ebit is None
        or ttm_rev is None
        or market_cap is None
    ):
        return None
    working_capital = current_assets - current_liab
    a = working_capital / assets
    b = retained / assets
    c = ttm_ebit / assets
    d = market_cap / liabilities
    e = ttm_rev / assets
    return 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e


def derive_ticker(db: Session, ticker: str, as_of: date, universe_scope: str | None = None) -> dict:
    """Build the scoring JSON for one name as of d. Does not write."""
    income = filings_as_of(db, ticker, "income", as_of)
    balance = filings_as_of(db, ticker, "balance", as_of)
    close = close_as_of(db, ticker, as_of)
    market_cap = market_cap_as_of(db, ticker, as_of)
    shares = _num(income[0], "weightedAverageShsOutDil") if income else None
    if market_cap is None and close is not None and shares:
        market_cap = close * shares

    data: dict = {"source": SOURCE_PIT, "deriveVersion": DERIVE_VERSION}
    if universe_scope:
        data["universe_scope"] = universe_scope
    data.update(compute_ttm_growth(income))
    data.update(_profitability(income, balance))
    data.update(
        _valuation(
            close=close,
            market_cap=market_cap,
            income=income,
            balance=balance,
            eps_growth=data.get("epsGrowthTTM"),
        )
    )
    z_score = altman_z(market_cap=market_cap, income=income, balance=balance)
    if z_score is not None:
        data["altmanZ"] = z_score
    estimate, vintage_as_of = current_estimate(db, ticker, as_of)
    if estimate:
        data.update(estimate)
        if vintage_as_of is not None:
            data["estimateVintageAsOf"] = vintage_as_of.isoformat()
        data.update(
            compute_estimate_revisions(
                db, ticker, estimate, as_of, vintage_as_of=vintage_as_of
            )
        )
        fy2, fy2_vintage = current_fy2_estimate(db, ticker, as_of)
        data.update(
            compute_fy2_revisions(db, ticker, fy2, as_of, vintage_as_of=fy2_vintage)
        )
    return data


def upsert_derived_fundamentals(
    db: Session, ticker: str, as_of: date, data: dict
) -> None:
    row = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of == as_of)
        .one_or_none()
    )
    if row is None:
        db.add(Fundamentals(ticker=ticker, as_of=as_of, data=data))
    else:
        row.data = data


def derive_universe(
    db: Session,
    as_of: date,
    tickers: list[str],
    universe_scope: str | None = None,
) -> int:
    """Write PIT fundamentals for every ticker on d. Returns rows written."""
    written = 0
    for ticker in tickers:
        data = derive_ticker(db, ticker, as_of, universe_scope=universe_scope)
        upsert_derived_fundamentals(db, ticker, as_of, data)
        written += 1
    db.commit()
    return written
