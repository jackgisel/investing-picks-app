"""Revenue per employee, and how headcount and revenue move together.

Built from two stored tables, never from live vendor calls: `employee_counts`
(one row per 10-K that stated a headcount) and `company_revenue` (annual
revenue). A headcount is paired with the revenue year ending within
`PAIR_TOLERANCE_DAYS` of its period of report — the same fiscal year, since
both come out of the same filing.

Leverage is revenue growth minus headcount growth over the same year: positive
means the company grew revenue faster than it grew its workforce.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from statistics import median

from sqlalchemy.orm import Session

from app.db.models import CompanyRevenue, EmployeeCount, Stock

PAIR_TOLERANCE_DAYS = 45
#: A prior year is the pair roughly twelve months before the latest one.
PRIOR_YEAR_WINDOW = (300, 430)
#: A headcount older than this is not what the company looks like now.
MAX_PERIOD_AGE_DAYS = 800
#: Peers needed before an in-industry rank means anything.
MIN_INDUSTRY_PEERS = 5
USD = "USD"

ORDERS = ("rev_per_employee", "leverage", "revenue")


def _series_by_ticker(db: Session) -> dict[str, list[dict]]:
    """Per ticker, paired (headcount, revenue) years, oldest first."""
    headcount: dict[str, dict[date, EmployeeCount]] = defaultdict(dict)
    # One headcount per period: the latest filing that stated it, so an
    # amendment supersedes the original without erasing it from storage.
    for row in db.query(EmployeeCount).order_by(EmployeeCount.filing_date).all():
        headcount[row.ticker][row.period_of_report] = row

    revenue: dict[str, list[CompanyRevenue]] = defaultdict(list)
    for row in db.query(CompanyRevenue).all():
        revenue[row.ticker].append(row)

    out: dict[str, list[dict]] = {}
    for ticker, by_period in headcount.items():
        years = revenue.get(ticker)
        if not years:
            continue
        pairs: list[dict] = []
        for period, hc in sorted(by_period.items()):
            match = min(years, key=lambda r: abs((r.period - period).days))
            if abs((match.period - period).days) > PAIR_TOLERANCE_DAYS:
                continue
            if match.currency and match.currency != USD:
                continue
            pairs.append(
                {
                    "period": period,
                    "filing_date": hc.filing_date,
                    "employees": hc.employee_count,
                    "revenue": match.revenue,
                    "rev_per_employee": (
                        match.revenue / hc.employee_count if hc.employee_count else None
                    ),
                }
            )
        if pairs:
            out[ticker] = pairs
    return out


def _growth(now: float | None, then: float | None) -> float | None:
    if not now or not then or then <= 0:
        return None
    return now / then - 1


def _prior(pairs: list[dict], latest: dict) -> dict | None:
    lo, hi = PRIOR_YEAR_WINDOW
    for p in reversed(pairs[:-1]):
        days = (latest["period"] - p["period"]).days
        if lo <= days <= hi:
            return p
    return None


def _row(stock: Stock, pairs: list[dict]) -> dict | None:
    latest = pairs[-1]
    if not latest["employees"]:
        return None
    prior = _prior(pairs, latest)
    hc_yoy = _growth(latest["employees"], prior["employees"]) if prior else None
    rev_yoy = _growth(latest["revenue"], prior["revenue"]) if prior else None
    return {
        "ticker": stock.ticker,
        "name": stock.name,
        "sector": stock.sector,
        "industry": stock.industry,
        "market_cap": stock.market_cap,
        "period": latest["period"].isoformat(),
        "filing_date": latest["filing_date"].isoformat(),
        "employees": latest["employees"],
        "revenue": latest["revenue"],
        "rev_per_employee": latest["rev_per_employee"],
        "employees_yoy": hc_yoy,
        "revenue_yoy": rev_yoy,
        "leverage": (
            rev_yoy - hc_yoy if rev_yoy is not None and hc_yoy is not None else None
        ),
        "industry_pct": None,
    }


def leaderboard(
    db: Session,
    *,
    limit: int = 100,
    min_revenue: float = 500_000_000,
    min_employees: int = 50,
    sector: str | None = None,
    order: str = "rev_per_employee",
    today: date | None = None,
) -> dict:
    """Companies ranked by revenue per employee (or by leverage / revenue).

    `industry_pct` is the share of in-industry peers this company out-earns
    per employee, so a bank is compared with banks and not with a software
    firm. It is None when the industry has fewer than `MIN_INDUSTRY_PEERS`
    names in the screen.
    """
    if order not in ORDERS:
        raise ValueError(f"order must be one of {ORDERS}")
    today = today or date.today()
    oldest = today - timedelta(days=MAX_PERIOD_AGE_DAYS)

    stocks = {
        s.ticker: s
        for s in db.query(Stock)
        .filter(Stock.is_active == True, Stock.is_etf == False)  # noqa: E712
        .all()
    }
    rows: list[dict] = []
    for ticker, pairs in _series_by_ticker(db).items():
        stock = stocks.get(ticker)
        if stock is None or pairs[-1]["period"] < oldest:
            continue
        row = _row(stock, pairs)
        if row is None:
            continue
        if row["revenue"] < min_revenue or row["employees"] < min_employees:
            continue
        rows.append(row)

    by_industry: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        if r["industry"]:
            by_industry[r["industry"]].append(r["rev_per_employee"])
    for r in rows:
        peers = by_industry.get(r["industry"] or "", [])
        if len(peers) >= MIN_INDUSTRY_PEERS:
            below = sum(1 for v in peers if v < r["rev_per_employee"])
            r["industry_pct"] = below / (len(peers) - 1) if len(peers) > 1 else None

    universe = len(rows)
    sectors = sorted({r["sector"] for r in rows if r["sector"]})
    if sector:
        rows = [r for r in rows if r["sector"] == sector]
    rows = [r for r in rows if r.get(order) is not None]
    rows.sort(key=lambda r: r[order], reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i

    return {
        "order": order,
        "universe": universe,
        "median_rev_per_employee": (
            median(r["rev_per_employee"] for r in rows) if rows else None
        ),
        "sectors": sectors,
        "count": min(len(rows), limit),
        "rows": rows[:limit],
    }


def company_history(db: Session, ticker: str) -> dict | None:
    """Every paired year we hold for one company, oldest first."""
    ticker = ticker.upper()
    pairs = _series_by_ticker(db).get(ticker)
    if not pairs:
        return None
    stock = db.get(Stock, ticker)
    series = []
    prev = None
    lo, hi = PRIOR_YEAR_WINDOW
    for p in pairs:
        # Growth only against a pair about a year earlier; a skipped year would
        # make it a two-year change under a one-year label.
        adjacent = prev is not None and lo <= (p["period"] - prev["period"]).days <= hi
        series.append(
            {
                "period": p["period"].isoformat(),
                "filing_date": p["filing_date"].isoformat(),
                "employees": p["employees"],
                "revenue": p["revenue"],
                "rev_per_employee": p["rev_per_employee"],
                "employees_yoy": _growth(p["employees"], prev["employees"]) if adjacent else None,
                "revenue_yoy": _growth(p["revenue"], prev["revenue"]) if adjacent else None,
            }
        )
        prev = p
    return {
        "ticker": ticker,
        "name": stock.name if stock else None,
        "sector": stock.sector if stock else None,
        "industry": stock.industry if stock else None,
        "series": series,
    }
