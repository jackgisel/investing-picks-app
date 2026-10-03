"""Workforce factor IC study.

Pinned: a factor that truly drives returns gets a large positive IC (and its
mirror a large negative one); nothing is read before its filing date, and an
amended filing only takes over from its own filing date; revenue is paired with
the same fiscal year; and the report renders.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

from app.db.models import CompanyRevenue, EmployeeCount, PriceBar, Stock
from worker.backtest import workforce_ic
from worker.backtest.workforce_ic import (
    WorkforceHistory,
    compute_workforce_ic,
    factor_values,
    month_ends,
    render_markdown,
)

N = 60


def _weekdays(start: date, end: date):
    d = start
    while d <= end:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)


def _seed(db, drift_sign=1.0):
    """60 names: revenue growth g_i in FY2023, flat headcount, returns tied to g_i."""
    bars = []
    for i in range(N):
        t = f"T{i:02d}"
        g = i / N - 0.5  # -0.5 .. +0.5
        db.add(Stock(ticker=t, name=t, industry="Software", sector="Tech", is_active=True, is_etf=False))
        for fy, filed, rev in ((2022, date(2023, 2, 15), 1e9), (2023, date(2024, 2, 15), 1e9 * (1 + g))):
            period = date(fy, 12, 31)
            db.add(EmployeeCount(ticker=t, period_of_report=period, filing_date=filed, employee_count=1000, raw={}))
            db.add(CompanyRevenue(ticker=t, period=period, filing_date=filed, revenue=rev, currency="USD"))
        price = 100.0
        for n, d in enumerate(_weekdays(date(2023, 3, 1), date(2025, 9, 30))):
            price *= math.exp(drift_sign * 0.0008 * g + (0.0003 if n % 2 else -0.0003) * ((i * 7) % 5 - 2) / 2)
            bars.append(PriceBar(ticker=t, date=d, close=price))
    db.add_all(bars)
    db.commit()


def test_month_ends():
    assert month_ends(date(2024, 1, 15), date(2024, 4, 30)) == [
        date(2024, 1, 31), date(2024, 2, 29), date(2024, 3, 31), date(2024, 4, 30),
    ]


def test_a_real_factor_gets_a_strong_positive_ic(db):
    _seed(db)
    out = compute_workforce_ic(db, horizons=(21,))
    lev = out["factors"]["leverage"]["21"]
    assert lev["dates"] >= 12
    assert lev["ic"] > 0.6 and lev["t"] > 5
    assert lev["q5_minus_q1"] > 0
    # Flat headcount: revenue growth carries the same information.
    assert out["factors"]["revenue_growth"]["21"]["ic"] > 0.6


def test_the_mirror_factor_gets_a_negative_ic(db):
    _seed(db, drift_sign=-1.0)
    out = compute_workforce_ic(db, horizons=(21,))
    assert out["factors"]["leverage"]["21"]["ic"] < -0.6


def test_nothing_is_read_before_its_filing_date(db):
    _seed(db)
    h = WorkforceHistory(db)
    # FY2023 was filed 2024-02-15 and is knowable from the session after: on
    # the filing day itself only FY2022 is.
    before = h.pairs_as_of("T10", date(2024, 2, 15))
    after = h.pairs_as_of("T10", date(2024, 2, 16))
    assert [p["period"] for p in before] == [date(2022, 12, 31)]
    assert [p["period"] for p in after] == [date(2022, 12, 31), date(2023, 12, 31)]
    assert "revenue_growth" not in factor_values(before, date(2024, 2, 15))
    assert "revenue_growth" in factor_values(after, date(2024, 2, 16))


def test_an_amendment_only_takes_over_from_its_own_filing_date(db):
    t = "AAA"
    db.add(EmployeeCount(ticker=t, period_of_report=date(2023, 12, 31), filing_date=date(2024, 2, 15), employee_count=1000, raw={}))
    db.add(EmployeeCount(ticker=t, period_of_report=date(2023, 12, 31), filing_date=date(2024, 4, 1), employee_count=800, raw={}))
    db.add(CompanyRevenue(ticker=t, period=date(2023, 12, 31), revenue=1e9, currency="USD"))
    db.commit()
    h = WorkforceHistory(db)
    assert h.pairs_as_of(t, date(2024, 3, 1))[0]["employees"] == 1000
    assert h.pairs_as_of(t, date(2024, 4, 1))[0]["employees"] == 1000  # filed that day
    assert h.pairs_as_of(t, date(2024, 4, 2))[0]["employees"] == 800


def test_revenue_pairs_only_with_its_own_fiscal_year(db):
    db.add(EmployeeCount(ticker="AAA", period_of_report=date(2023, 12, 31), filing_date=date(2024, 2, 15), employee_count=1000, raw={}))
    db.add(CompanyRevenue(ticker="AAA", period=date(2022, 12, 31), revenue=5e8, currency="USD"))
    db.commit()
    assert WorkforceHistory(db).pairs_as_of("AAA", date(2024, 3, 1)) == []


def test_stale_headcount_and_non_usd_are_dropped(db):
    db.add(EmployeeCount(ticker="OLD", period_of_report=date(2020, 12, 31), filing_date=date(2021, 2, 15), employee_count=10, raw={}))
    db.add(CompanyRevenue(ticker="OLD", period=date(2020, 12, 31), revenue=1e9, currency="USD"))
    db.add(EmployeeCount(ticker="EUR", period_of_report=date(2023, 12, 31), filing_date=date(2024, 2, 15), employee_count=10, raw={}))
    db.add(CompanyRevenue(ticker="EUR", period=date(2023, 12, 31), revenue=1e9, currency="EUR"))
    db.commit()
    h = WorkforceHistory(db)
    assert factor_values(h.pairs_as_of("OLD", date(2024, 6, 1)), date(2024, 6, 1)) is None
    assert h.pairs_as_of("EUR", date(2024, 6, 1)) == []


def test_empty_database_reports_instead_of_crashing(db):
    assert compute_workforce_ic(db)["error"] == "no headcount data"


def test_markdown_report_renders(db):
    _seed(db)
    md = render_markdown(compute_workforce_ic(db, horizons=(21,)))
    assert "# Workforce factor IC" in md and "| leverage |" in md and "21-session" in md
    assert "No result" in render_markdown({"error": "no price history"})


def test_a_pair_waits_for_the_later_of_its_two_filings(db):
    db.add(EmployeeCount(ticker="AAA", period_of_report=date(2023, 12, 31), filing_date=date(2024, 2, 15), employee_count=1000, raw={}))
    # Revenue for that year only became public (or was fetched) later.
    db.add(CompanyRevenue(ticker="AAA", period=date(2023, 12, 31), filing_date=date(2024, 3, 10), revenue=1e9, currency="USD"))
    db.commit()
    h = WorkforceHistory(db)
    assert h.pairs_as_of("AAA", date(2024, 3, 10)) == []
    assert len(h.pairs_as_of("AAA", date(2024, 3, 11))) == 1


def test_a_name_whose_prices_stop_early_is_dropped_not_zeroed(db):
    from worker.backtest.factor_ic import ForwardReturns
    from worker.backtest.workforce_ic import strict_forward

    for n, d in enumerate(_weekdays(date(2024, 1, 1), date(2024, 12, 31))):
        db.add(PriceBar(ticker="LIVE", date=d, close=100 + n))
        if d <= date(2024, 3, 1):  # delisted
            db.add(PriceBar(ticker="GONE", date=d, close=100 + n))
    db.commit()
    fwd = ForwardReturns(db, date(2024, 1, 1))
    assert strict_forward(fwd, "LIVE", date(2024, 2, 1), 63) is not None
    assert strict_forward(fwd, "GONE", date(2024, 2, 1), 63) is None
    assert strict_forward(fwd, "GONE", date(2024, 2, 1), 5) is not None


def test_report_dates_are_the_dates_that_were_used(db):
    _seed(db)
    out = compute_workforce_ic(db, horizons=(21,))
    # Dates before the shortest horizon resolves, or with too few names, are not
    # in the reported window.
    assert out["first_date"] >= "2023-02-28"
    assert out["last_date"] <= out["last_price_session"]
    assert out["dates_used"] > 0
    empty_window = compute_workforce_ic(db, start=date(2030, 1, 1))
    assert empty_window.get("error") == "no price history"


def test_the_job_stores_json_and_the_endpoint_reads_the_last_good_run(db, monkeypatch):
    import json

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.db.models import JobRun
    from app.db.session import get_db
    from app.routes import ops

    good = {"dates_used": 3, "first_date": "2024-02-29", "last_date": "2024-04-30",
            "avg_names_with_a_factor": 60, "last_price_session": "2024-06-28",
            "horizons_trading_days": [21],
            "factors": {"leverage": {"21": {"dates": 3, "ic": float("nan"), "t": None, "hit": None,
                                             "q5_minus_q1": None, "avg_names": 60}}}}
    t0 = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
    db.add(JobRun(job_name="workforce_ic", status="ok", detail=json.dumps(good), started_at=t0))
    db.add(JobRun(job_name="workforce_ic", status="running", started_at=t0 + timedelta(hours=1)))
    db.commit()
    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    body = TestClient(app).get("/api/ops/workforce-ic", headers={"X-Ops-Key": "dev-ops-key"}).json()
    # The run in progress does not hide the last good result; nan became null.
    assert body["result"]["factors"]["leverage"]["21"]["ic"] is None
    assert body["latest_run"]["status"] == "running"
    assert body["result"]["dates_used"] == 3 and "# Workforce factor IC" in body["markdown"]
