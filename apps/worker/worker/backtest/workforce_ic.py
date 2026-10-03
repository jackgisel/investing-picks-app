"""Do the workforce factors rank forward returns?

Same question and the same statistics as `factor_ic` (Spearman rank correlation
between a factor and the return that follows, averaged over dates, with a
t-stat), but asked of the workforce datasets and read straight from the
database, so it runs against production as well as a dataset copy.

Point-in-time: on a date, a headcount exists only if its `filing_date` is on or
before it, and where a filing was amended the latest one filed by then wins. The
revenue beside it is the same fiscal year's, from the same filing. Nothing here
reads a number before the market could have.

Factors (higher = the factor's own direction, not a bet on sign; the IC sign
says which way it paid):

- `headcount_growth`   year-over-year change in employees
- `revenue_growth`     year-over-year change in revenue (a control: a known factor)
- `leverage`           revenue growth minus headcount growth
- `rev_per_employee`   revenue per employee, ranked within industry

Caveats that travel with every number: the universe is today's names, so
survivorship flatters everything; dates are month-ends, so a 63 or 126 day
horizon overlaps the next date and the t-stat overstates confidence; and under
~24 dates, read direction, not size.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean

from sqlalchemy.orm import Session

from app.db.models import CompanyRevenue, EmployeeCount, Stock
from worker.backtest.factor_ic import ForwardReturns, spearman, summarize

log = logging.getLogger(__name__)

WORKFORCE_IC_JOB = "workforce_ic"
WORKFORCE_IC_TIMEOUT_MINUTES = 20.0

HORIZONS = (21, 63, 126)
FACTORS = ("headcount_growth", "revenue_growth", "leverage", "rev_per_employee")
PAIR_TOLERANCE_DAYS = 45
PRIOR_YEAR_WINDOW = (300, 430)
MAX_PERIOD_AGE_DAYS = 800
MIN_CROSS_SECTION = 30
MIN_INDUSTRY_PEERS = 5


def month_ends(start: date, end: date) -> list[date]:
    """Last calendar day of each month in [start, end]."""
    out: list[date] = []
    y, m = start.year, start.month
    while True:
        nxt = date(y + (m == 12), (m % 12) + 1, 1)
        last = nxt - timedelta(days=1)
        if last > end:
            break
        if last >= start:
            out.append(last)
        y, m = nxt.year, nxt.month
    return out


class WorkforceHistory:
    """Every stored headcount and revenue row, indexed for as-of lookups."""

    def __init__(self, db: Session):
        self.hc: dict[str, list[tuple[date, date, int]]] = defaultdict(list)
        for t, period, filed, n in db.query(
            EmployeeCount.ticker,
            EmployeeCount.period_of_report,
            EmployeeCount.filing_date,
            EmployeeCount.employee_count,
        ).all():
            self.hc[t].append((filed, period, n))
        for rows in self.hc.values():
            rows.sort()
        self.rev: dict[str, dict[date, tuple[float, str | None]]] = defaultdict(dict)
        for t, period, revenue, currency in db.query(
            CompanyRevenue.ticker, CompanyRevenue.period, CompanyRevenue.revenue, CompanyRevenue.currency
        ).all():
            self.rev[t][period] = (revenue, currency)

    def pairs_as_of(self, ticker: str, day: date) -> list[dict]:
        """Paired (employees, revenue) years known on `day`, oldest first."""
        known: dict[date, int] = {}
        for filed, period, n in self.hc.get(ticker, []):
            if filed > day:
                break  # rows are sorted by filing date: nothing later is knowable
            known[period] = n  # a later filing of the same period supersedes
        revenue = self.rev.get(ticker, {})
        out: list[dict] = []
        for period, employees in sorted(known.items()):
            if not revenue or employees <= 0:
                continue
            match = min(revenue, key=lambda p: abs((p - period).days))
            if abs((match - period).days) > PAIR_TOLERANCE_DAYS:
                continue
            rev, currency = revenue[match]
            if currency and currency != "USD":
                continue
            out.append({"period": period, "employees": employees, "revenue": rev})
        return out


def factor_values(pairs: list[dict], day: date) -> dict[str, float] | None:
    """The latest year's growth factors, or None if there is no usable pair."""
    if not pairs:
        return None
    latest = pairs[-1]
    if (day - latest["period"]).days > MAX_PERIOD_AGE_DAYS:
        return None
    lo, hi = PRIOR_YEAR_WINDOW
    prior = next(
        (p for p in reversed(pairs[:-1]) if lo <= (latest["period"] - p["period"]).days <= hi),
        None,
    )
    out = {"rev_per_employee": latest["revenue"] / latest["employees"]}
    if prior and prior["employees"] > 0 and prior["revenue"] > 0:
        hc = latest["employees"] / prior["employees"] - 1
        rev = latest["revenue"] / prior["revenue"] - 1
        out.update(headcount_growth=hc, revenue_growth=rev, leverage=rev - hc)
    return out


def _industry_rank(values: dict[str, float], industry: dict[str, str | None]) -> dict[str, float]:
    """Revenue per employee as a within-industry percentile (0 to 1)."""
    groups: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for t, v in values.items():
        if industry.get(t):
            groups[industry[t]].append((t, v))
    out: dict[str, float] = {}
    for members in groups.values():
        if len(members) < MIN_INDUSTRY_PEERS:
            continue
        vs = [v for _, v in members]
        for t, v in members:
            out[t] = sum(1 for x in vs if x < v) / (len(vs) - 1)
    return out


def compute_workforce_ic(
    db: Session,
    start: date | None = None,
    end: date | None = None,
    horizons: tuple[int, ...] = HORIZONS,
) -> dict:
    """Information coefficient of each workforce factor, by horizon."""
    history = WorkforceHistory(db)
    if not history.hc:
        return {"error": "no headcount data", "factors": {}}
    first_filing = min(rows[0][0] for rows in history.hc.values())
    price_start = start or first_filing
    fwd = ForwardReturns(db, price_start, end)
    if not fwd.sessions:
        return {"error": "no price history", "factors": {}}
    last_session = fwd.sessions[-1]
    industry = {t: ind for t, ind in db.query(Stock.ticker, Stock.industry).all()}
    first_session = fwd.sessions[0]
    dates = month_ends(max(first_filing, first_session), end or last_session)

    ics: dict[str, dict[int, list[float]]] = {f: {h: [] for h in horizons} for f in FACTORS}
    spreads: dict[str, dict[int, list[float]]] = {f: {h: [] for h in horizons} for f in FACTORS}
    sizes: dict[str, dict[int, list[int]]] = {f: {h: [] for h in horizons} for f in FACTORS}
    dates_used = 0
    covered: list[int] = []

    for day in dates:
        # Skip any date a name has no price on, and any date too late for the
        # shortest horizon to resolve.
        if fwd.session_after(day, min(horizons)) is None:
            continue
        raw: dict[str, dict[str, float]] = {}
        for ticker in history.hc:
            if ticker not in fwd.series:
                continue
            vals = factor_values(history.pairs_as_of(ticker, day), day)
            if vals:
                raw[ticker] = vals
        if len(raw) < MIN_CROSS_SECTION:
            continue
        dates_used += 1
        covered.append(len(raw))
        by_factor: dict[str, dict[str, float]] = {
            "headcount_growth": {t: v["headcount_growth"] for t, v in raw.items() if "headcount_growth" in v},
            "revenue_growth": {t: v["revenue_growth"] for t, v in raw.items() if "revenue_growth" in v},
            "leverage": {t: v["leverage"] for t, v in raw.items() if "leverage" in v},
            "rev_per_employee": _industry_rank({t: v["rev_per_employee"] for t, v in raw.items()}, industry),
        }
        for h in horizons:
            rets = {t: fwd.forward(t, day, h) for t in raw}
            for factor, values in by_factor.items():
                pairs = [(values[t], rets[t]) for t in values if rets.get(t) is not None]
                if len(pairs) < MIN_CROSS_SECTION:
                    continue
                xs, ys = [p[0] for p in pairs], [p[1] for p in pairs]
                ic = spearman(xs, ys)
                if ic is None:
                    continue
                ics[factor][h].append(ic)
                sizes[factor][h].append(len(pairs))
                ordered = sorted(pairs, key=lambda p: p[0])
                q = max(1, len(ordered) // 5)
                spreads[factor][h].append(
                    mean(p[1] for p in ordered[-q:]) - mean(p[1] for p in ordered[:q])
                )

    factors: dict[str, dict] = {}
    for f in FACTORS:
        factors[f] = {}
        for h in horizons:
            s = summarize(ics[f][h])
            factors[f][str(h)] = {
                "dates": s.n,
                "ic": s.mean,
                "t": s.t,
                "hit": s.hit,
                "q5_minus_q1": mean(spreads[f][h]) if spreads[f][h] else None,
                "avg_names": mean(sizes[f][h]) if sizes[f][h] else None,
            }
    return {
        "dates_used": dates_used,
        "first_date": dates[0].isoformat() if dates else None,
        "last_date": dates[-1].isoformat() if dates else None,
        "avg_names_with_a_factor": round(mean(covered)) if covered else 0,
        "last_price_session": last_session.isoformat(),
        "horizons_trading_days": list(horizons),
        "factors": factors,
    }


def _pct(x: float | None) -> str:
    return "n/a" if x is None else f"{x * 100:+.2f}%"


def _num(x: float | None, digits: int = 3) -> str:
    return "n/a" if x is None else f"{x:+.{digits}f}"


def render_markdown(result: dict) -> str:
    """The result as the same style of table `factor_ic` writes."""
    if result.get("error"):
        return f"# Workforce factor IC\n\nNo result: {result['error']}.\n"
    lines = [
        "# Workforce factor IC",
        "",
        f"Month-end dates: {result['dates_used']} ({result['first_date']} to {result['last_date']}), "
        f"about {result['avg_names_with_a_factor']} names per date. Last price session: {result['last_price_session']}.",
        "",
        "IC is the Spearman correlation between a factor and the forward return across names on a date, "
        "averaged over dates; `t` is mean / (sd / sqrt(n)). Horizons beyond 21 sessions overlap between "
        "month-ends, so their t overstates confidence. The universe is today's names, so survivorship "
        "flatters every number. Under ~24 dates, read direction, not size.",
        "",
    ]
    for h in result["horizons_trading_days"]:
        lines += [
            f"## {h}-session forward returns",
            "",
            "| Factor | IC | t | IC>0 | Q5-Q1 | dates |",
            "|---|---|---|---|---|---|",
        ]
        for f, by_h in result["factors"].items():
            m = by_h[str(h)]
            hit = "n/a" if m["hit"] is None else f"{m['hit'] * 100:.0f}%"
            lines.append(
                f"| {f} | {_num(m['ic'])} | {_num(m['t'], 2)} | {hit} | {_pct(m['q5_minus_q1'])} | {m['dates']} |"
            )
        lines.append("")
    return "\n".join(lines)
