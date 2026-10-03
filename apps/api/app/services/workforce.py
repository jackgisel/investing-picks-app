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

#: How a company's year looked: revenue growth against headcount growth.
SHAPES = ("leaner", "efficient_growth", "hiring_ahead", "contracting", "hiring_into_decline")


def classify_shape(revenue_yoy: float | None, employees_yoy: float | None) -> str | None:
    """Name the quadrant a company sits in, or None without both growth rates.

    - leaner: revenue up (or flat), headcount down (or flat)
    - efficient_growth: both up, revenue faster
    - hiring_ahead: both up, headcount faster
    - contracting: revenue down, headcount down (or flat)
    - hiring_into_decline: revenue down, headcount up
    """
    if revenue_yoy is None or employees_yoy is None:
        return None
    if revenue_yoy >= 0:
        if employees_yoy <= 0:
            return "leaner"
        return "efficient_growth" if revenue_yoy >= employees_yoy else "hiring_ahead"
    return "contracting" if employees_yoy <= 0 else "hiring_into_decline"


def _series_by_ticker(db: Session, ticker: str | None = None) -> dict[str, list[dict]]:
    """Per ticker, paired (headcount, revenue) years, oldest first.

    `ticker` narrows the read to one company, so a history request does not
    load the whole universe.
    """
    headcount: dict[str, dict[date, EmployeeCount]] = defaultdict(dict)
    # One headcount per period: the latest filing that stated it, so an
    # amendment supersedes the original without erasing it from storage.
    hc_query = db.query(EmployeeCount).order_by(EmployeeCount.filing_date)
    rev_query = db.query(CompanyRevenue)
    if ticker:
        hc_query = hc_query.filter(EmployeeCount.ticker == ticker)
        rev_query = rev_query.filter(CompanyRevenue.ticker == ticker)
    for row in hc_query.all():
        headcount[row.ticker][row.period_of_report] = row

    revenue: dict[str, list[CompanyRevenue]] = defaultdict(list)
    for row in rev_query.all():
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
        "shape": classify_shape(rev_yoy, hc_yoy),
    }


def leaderboard(
    db: Session,
    *,
    limit: int = 100,
    min_revenue: float = 500_000_000,
    min_employees: int = 50,
    sector: str | None = None,
    order: str = "rev_per_employee",
    shape: str | None = None,
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
    if shape is not None and shape not in SHAPES:
        raise ValueError(f"shape must be one of {SHAPES}")
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
    # The screen's own median, before the sector and sort filters narrow it.
    screen_median = median(r["rev_per_employee"] for r in rows) if rows else None
    shape_counts = {s: sum(1 for r in rows if r["shape"] == s) for s in SHAPES}
    if sector:
        rows = [r for r in rows if r["sector"] == sector]
    if shape:
        rows = [r for r in rows if r["shape"] == shape]
    rows = [r for r in rows if r.get(order) is not None]
    rows.sort(key=lambda r: r[order], reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i

    return {
        "order": order,
        "universe": universe,
        "median_rev_per_employee": screen_median,
        "sectors": sectors,
        "shape_counts": shape_counts,
        "count": min(len(rows), limit),
        "rows": rows[:limit],
    }


def company_history(db: Session, ticker: str) -> dict | None:
    """Every paired year we hold for one company, oldest first."""
    ticker = ticker.upper()
    pairs = _series_by_ticker(db, ticker).get(ticker)
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


_CACHE: dict[tuple, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = 300


def cached_leaderboard(db: Session, **kwargs) -> dict:
    """`leaderboard` with a short in-process cache.

    The board is computed from every stored headcount and revenue row, and the
    route is open to anyone who can reach it, so repeated hits should not each
    pay for that. The underlying data changes weekly; five minutes is nothing.
    """
    import time

    key = tuple(sorted(kwargs.items()))
    hit = _CACHE.get(key)
    now = time.monotonic()
    if hit and now - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    result = leaderboard(db, **kwargs)
    # An empty screen is the state before the data lands (or a transient
    # failure); holding it for five minutes would hide the first real rows.
    if result["universe"] > 0:
        if len(_CACHE) > 64:
            _CACHE.clear()
        _CACHE[key] = (now, result)
    return result
