"""Revenue per employee leaderboard and per-company history.

What matters: a headcount is paired with the revenue of the same fiscal year
(not whatever year is latest); growth is only computed against a pair about a
year earlier; an amended filing supersedes the original headcount; non-USD
reporters and stale or tiny names stay off the board; and the in-industry rank
needs enough peers to mean anything.
"""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import CompanyRevenue, EmployeeCount, Stock
from app.db.session import get_db
from app.routes import public_v1
from app.services import workforce

TODAY = date(2026, 10, 3)


def _stock(db, ticker, industry="Software", sector="Technology", name=None):
    db.add(
        Stock(
            ticker=ticker,
            name=name or ticker,
            sector=sector,
            industry=industry,
            market_cap=5e9,
            is_active=True,
            is_etf=False,
        )
    )


def _year(db, ticker, year, employees, revenue, filed=None, currency="USD"):
    period = date(year, 12, 31)
    db.add(
        EmployeeCount(
            ticker=ticker,
            period_of_report=period,
            filing_date=filed or date(year + 1, 2, 20),
            employee_count=employees,
            raw={},
        )
    )
    db.add(
        CompanyRevenue(
            ticker=ticker,
            period=period,
            filing_date=filed or date(year + 1, 2, 20),
            revenue=revenue,
            currency=currency,
        )
    )


def _board(db, **kw):
    return workforce.leaderboard(db, today=TODAY, **kw)


def test_ranks_by_revenue_per_employee(db):
    for t in ("LEAN", "FAT"):
        _stock(db, t)
    _year(db, "LEAN", 2025, 100, 2e9)  # $20M / employee
    _year(db, "FAT", 2025, 10_000, 5e9)  # $0.5M / employee
    db.commit()
    rows = _board(db)["rows"]
    assert [r["ticker"] for r in rows] == ["LEAN", "FAT"]
    assert rows[0]["rank"] == 1
    assert rows[0]["rev_per_employee"] == 20_000_000


def test_growth_and_leverage_use_the_prior_year(db):
    _stock(db, "AAA")
    _year(db, "AAA", 2024, 1000, 1e9)
    _year(db, "AAA", 2025, 1100, 1.5e9)
    db.commit()
    row = _board(db)["rows"][0]
    assert round(row["employees_yoy"], 4) == 0.1
    assert round(row["revenue_yoy"], 4) == 0.5
    assert round(row["leverage"], 4) == 0.4


def test_no_growth_across_a_skipped_year(db):
    _stock(db, "AAA")
    _year(db, "AAA", 2023, 1000, 1e9)
    _year(db, "AAA", 2025, 1100, 1.5e9)
    db.commit()
    row = _board(db)["rows"][0]
    assert row["employees_yoy"] is None and row["leverage"] is None
    hist = workforce.company_history(db, "AAA")["series"]
    assert hist[1]["employees_yoy"] is None


def test_headcount_pairs_with_its_own_fiscal_year_revenue(db):
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 1000, 2e9)
    # A later revenue year with no headcount yet must not be paired.
    db.add(CompanyRevenue(ticker="AAA", period=date(2026, 6, 30), revenue=9e9, currency="USD"))
    db.commit()
    assert _board(db)["rows"][0]["revenue"] == 2e9


def test_amended_filing_supersedes_the_original(db):
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 1000, 2e9)
    db.add(
        EmployeeCount(
            ticker="AAA",
            period_of_report=date(2025, 12, 31),
            filing_date=date(2026, 4, 1),
            employee_count=800,
            raw={},
        )
    )
    db.commit()
    assert _board(db)["rows"][0]["employees"] == 800


def test_filters_floor_stale_foreign_and_unknown_names(db):
    for t in ("OK", "SMALL", "TINY", "OLD", "EUR", "GHOST"):
        if t != "GHOST":
            _stock(db, t)
    _year(db, "OK", 2025, 500, 2e9)
    _year(db, "SMALL", 2025, 500, 1e8)  # under the revenue floor
    _year(db, "TINY", 2025, 10, 2e9)  # under the headcount floor
    _year(db, "OLD", 2022, 500, 2e9)  # headcount too old
    _year(db, "EUR", 2025, 500, 2e9, currency="EUR")
    _year(db, "GHOST", 2025, 500, 2e9)  # no Stock row
    db.commit()
    assert [r["ticker"] for r in _board(db)["rows"]] == ["OK"]


def test_industry_percentile_needs_enough_peers(db):
    for i in range(5):
        _stock(db, f"S{i}", industry="Banks")
        _year(db, f"S{i}", 2025, 1000, (i + 1) * 1e9)
    _stock(db, "LONE", industry="Rare")
    _year(db, "LONE", 2025, 1000, 3e9)
    db.commit()
    rows = {r["ticker"]: r for r in _board(db)["rows"]}
    assert rows["S4"]["industry_pct"] == 1.0
    assert rows["S0"]["industry_pct"] == 0.0
    assert rows["LONE"]["industry_pct"] is None


def test_order_sector_and_limit(db):
    _stock(db, "A", sector="Tech")
    _stock(db, "B", sector="Health")
    _year(db, "A", 2024, 1000, 1e9)
    _year(db, "A", 2025, 1000, 3e9)  # leverage +2.0
    _year(db, "B", 2024, 1000, 1e9)
    _year(db, "B", 2025, 1000, 5e9)  # leverage +4.0, higher rev/employee
    db.commit()
    assert [r["ticker"] for r in _board(db, order="leverage")["rows"]] == ["B", "A"]
    assert [r["ticker"] for r in _board(db, sector="Tech")["rows"]] == ["A"]
    assert _board(db, limit=1)["count"] == 1
    assert _board(db)["sectors"] == ["Health", "Tech"]


def test_api_serves_board_and_history(db):
    _stock(db, "AAA")
    _year(db, "AAA", 2024, 1000, 1e9)
    _year(db, "AAA", 2025, 1100, 1.5e9)
    db.commit()
    app = FastAPI()
    app.include_router(public_v1.router)
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)

    board = client.get("/api/v1/workforce/leaderboard?min_revenue=0&min_employees=0").json()
    assert board["rows"][0]["ticker"] == "AAA"
    assert client.get("/api/v1/workforce/leaderboard?order=nope").status_code == 422
    hist = client.get("/api/v1/workforce/aaa").json()
    assert [s["employees"] for s in hist["series"]] == [1000, 1100]
    assert client.get("/api/v1/workforce/ZZZ").status_code == 404
