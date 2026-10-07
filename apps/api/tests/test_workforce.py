"""Revenue per employee leaderboard and per-company history.

What matters: a headcount is paired with the revenue of the same fiscal year
(not whatever year is latest); growth is only computed against a pair about a
year earlier; an amended filing supersedes the original headcount; non-USD
reporters and stale or tiny names stay off the board; and the in-industry rank
needs enough peers to mean anything.
"""

from __future__ import annotations

from datetime import date, timedelta

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


def test_only_keeps_the_requested_names(db):
    for t in ("KEEP", "DROP"):
        _stock(db, t)
    _year(db, "KEEP", 2025, 100, 2e9)
    _year(db, "DROP", 2025, 100, 9e9)
    db.commit()
    rows = _board(db, only=["KEEP"])["rows"]
    assert [r["ticker"] for r in rows] == ["KEEP"]


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


def test_median_is_the_screens_not_the_filtered_views(db):
    _stock(db, "A", sector="Tech")
    _stock(db, "B", sector="Health")
    _stock(db, "C", sector="Health")
    _year(db, "A", 2025, 1000, 1e9)
    _year(db, "B", 2025, 1000, 3e9)
    _year(db, "C", 2025, 1000, 5e9)
    db.commit()
    full = _board(db)["median_rev_per_employee"]
    assert _board(db, sector="Tech")["median_rev_per_employee"] == full
    assert _board(db, order="leverage")["median_rev_per_employee"] == full


def test_history_reads_only_the_requested_company(db):
    _stock(db, "AAA")
    _stock(db, "BBB")
    _year(db, "AAA", 2025, 1000, 1e9)
    _year(db, "BBB", 2025, 2000, 2e9)
    db.commit()
    assert workforce._series_by_ticker(db, "AAA").keys() == {"AAA"}
    assert workforce.company_history(db, "bbb")["series"][0]["employees"] == 2000


def test_cached_board_is_reused_within_the_ttl(db):
    workforce._CACHE.clear()
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 1000, 1e9)
    db.commit()
    first = workforce.cached_leaderboard(db, min_revenue=0, min_employees=0, today=TODAY)
    db.query(EmployeeCount).delete()
    db.commit()
    assert workforce.cached_leaderboard(db, min_revenue=0, min_employees=0, today=TODAY) is first
    workforce._CACHE.clear()


def test_shape_quadrants():
    c = workforce.classify_shape
    assert c(0.10, -0.05) == "leaner"
    assert c(0.10, 0.0) == "leaner"
    assert c(0.20, 0.05) == "efficient_growth"
    assert c(0.05, 0.20) == "hiring_ahead"
    assert c(-0.10, -0.05) == "contracting"
    assert c(-0.10, 0.0) == "contracting"
    assert c(-0.10, 0.05) == "hiring_into_decline"
    assert c(None, 0.05) is None and c(0.05, None) is None


def test_shape_filter_and_counts(db):
    for t in ("L", "H"):
        _stock(db, t)
    _year(db, "L", 2024, 1000, 1e9)
    _year(db, "L", 2025, 900, 1.2e9)  # leaner
    _year(db, "H", 2024, 1000, 1e9)
    _year(db, "H", 2025, 1500, 1.1e9)  # hiring ahead
    db.commit()
    board = _board(db, shape="leaner")
    assert [r["ticker"] for r in board["rows"]] == ["L"]
    assert board["shape_counts"]["leaner"] == 1 and board["shape_counts"]["hiring_ahead"] == 1
    with __import__("pytest").raises(ValueError):
        _board(db, shape="nope")


def test_shape_counts_are_within_the_chosen_sector(db):
    _stock(db, "A", sector="Tech")
    _stock(db, "B", sector="Health")
    for t in ("A", "B"):
        _year(db, t, 2024, 1000, 1e9)
        _year(db, t, 2025, 900, 1.2e9)  # both leaner
    db.commit()
    assert _board(db)["shape_counts"]["leaner"] == 2
    assert _board(db, sector="Tech")["shape_counts"]["leaner"] == 1


def test_financials_and_real_estate_are_left_out_of_the_default_view_only(db):
    _stock(db, "SOFT", sector="Technology")
    _stock(db, "BANK", sector="Financial Services")
    _stock(db, "REIT", sector="Real Estate")
    for t, rev in (("SOFT", 1e9), ("BANK", 5e9), ("REIT", 9e9)):
        _year(db, t, 2025, 100, rev)
    db.commit()
    default = _board(db)
    assert [r["ticker"] for r in default["rows"]] == ["SOFT"]
    assert default["excluded_sectors"] == ["Financial Services", "Real Estate"]
    assert default["universe"] == 1
    # Still selectable, and the sector list is not narrowed.
    assert "Financial Services" in default["sectors"]
    banks = _board(db, sector="Financial Services")
    assert [r["ticker"] for r in banks["rows"]] == ["BANK"]
    assert banks["excluded_sectors"] == []
    # And the caller can opt out.
    assert len(_board(db, exclude_sectors=())["rows"]) == 3


def test_shape_names_are_pinned():
    # The web app's links and labels (lib/workforce.ts) use these exact ids.
    assert workforce.SHAPES == (
        "leaner", "efficient_growth", "hiring_ahead", "contracting", "hiring_into_decline"
    )


def test_an_empty_board_is_not_cached(db):
    workforce._CACHE.clear()
    empty = workforce.cached_leaderboard(db, min_revenue=0, min_employees=0, today=TODAY)
    assert empty["rows"] == []
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 1000, 1e9)
    db.commit()
    again = workforce.cached_leaderboard(db, min_revenue=0, min_employees=0, today=TODAY)
    assert [r["ticker"] for r in again["rows"]] == ["AAA"]
    workforce._CACHE.clear()


def test_api_serves_board_and_history(db):
    workforce._CACHE.clear()
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
    assert client.get("/api/v1/workforce/leaderboard?shape=nope").status_code == 422
    growth = client.get("/api/v1/workforce-growth").json()
    assert growth["points"][0]["ticker"] == "AAA"
    assert growth["points"][0]["shape"] == "efficient_growth"
    assert set(growth["points"][0]) == {
        "ticker", "name", "sector", "employees_yoy", "revenue_yoy", "rev_per_employee", "shape"
    }
    hist = client.get("/api/v1/workforce/aaa").json()
    assert [s["employees"] for s in hist["series"]] == [1000, 1100]
    assert client.get("/api/v1/workforce/ZZZ").status_code == 404


def _snap(db, ticker, day, n, verified=True):
    from app.db.models import JobOpeningSnapshot

    db.add(JobOpeningSnapshot(ticker=ticker, as_of=day, open_count=n, verified=verified, boards=[]))


def test_openings_come_only_from_verified_snapshots(db):
    today = date.today()
    _stock(db, "OK")
    _stock(db, "UNSURE")
    _year(db, "OK", 2025, 1000, 1e9)
    _year(db, "UNSURE", 2025, 1000, 1e9)
    _snap(db, "OK", today, 50)
    _snap(db, "UNSURE", today, 999, verified=False)
    db.commit()
    rows = {r["ticker"]: r for r in workforce.leaderboard(db, min_revenue=0, min_employees=0)["rows"]}
    assert rows["OK"]["openings"] == 50 and rows["OK"]["openings_per_1000"] == 50.0
    assert rows["UNSURE"]["openings"] is None and rows["UNSURE"]["openings_per_1000"] is None


def test_openings_change_needs_a_snapshot_about_90_days_back(db):
    today = date.today()
    f = workforce.openings_fields
    assert f([(today, 50)], 1000)["openings_change_90d"] is None  # no history yet
    series = [(today - timedelta(days=91), 40), (today, 50)]
    assert round(f(series, 1000)["openings_change_90d"], 3) == 0.25
    too_old = [(today - timedelta(days=200), 40), (today, 50)]
    assert f(too_old, 1000)["openings_change_90d"] is None
    zero_base = [(today - timedelta(days=90), 0), (today, 5)]
    assert f(zero_base, 1000)["openings_change_90d"] is None
    assert f(None, 1000)["openings"] is None


def test_history_includes_the_openings_series(db):
    today = date.today()
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 1000, 1e9)
    _snap(db, "AAA", today - timedelta(days=1), 30)
    _snap(db, "AAA", today, 35)
    db.commit()
    hist = workforce.company_history(db, "AAA")
    assert [o["open_count"] for o in hist["openings_series"]] == [30, 35]
    assert hist["openings_current"]["openings_per_1000"] == 35.0


def test_a_stale_verified_count_is_not_shown_as_current(db):
    today = date.today()
    f = workforce.openings_fields
    assert f([(today - timedelta(days=30), 50)], 1000, today)["openings"] is None
    assert f([(today - timedelta(days=3), 50)], 1000, today)["openings"] == 50
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 1000, 1e9)
    _snap(db, "AAA", today - timedelta(days=60), 50)
    db.commit()
    row = workforce.leaderboard(db, min_revenue=0, min_employees=0)["rows"][0]
    assert row["openings"] is None
    # ...but the company's own history still shows what was recorded.
    assert len(workforce.company_history(db, "AAA")["openings_series"]) == 1


def test_openings_follow_the_injected_today(db):
    old = date(2025, 6, 1)
    _stock(db, "AAA")
    _year(db, "AAA", 2024, 1000, 1e9)
    _snap(db, "AAA", old, 40)
    db.commit()
    row = workforce.leaderboard(db, min_revenue=0, min_employees=0, today=old + timedelta(days=2))["rows"][0]
    assert row["openings"] == 40


def test_directory_lists_every_company_without_the_board_floor(db):
    _stock(db, "BIG")
    _stock(db, "TINY")
    _stock(db, "OLD")
    _year(db, "BIG", 2024, 1000, 9e9)
    _year(db, "BIG", 2025, 1100, 10e9)
    _year(db, "TINY", 2025, 12, 3e6)
    _year(db, "OLD", 2020, 500, 1e9)
    db.commit()
    out = workforce.company_directory(db, today=TODAY)
    by = {c["ticker"]: c for c in out["companies"]}
    assert set(by) == {"BIG", "TINY", "OLD"}
    assert by["BIG"]["years"] == 2
    assert abs(by["BIG"]["employees_yoy"] - 0.1) < 1e-9
    assert by["TINY"]["stale"] is False
    assert by["OLD"]["stale"] is True
    assert [c["ticker"] for c in out["companies"]] == ["BIG", "OLD", "TINY"]


def test_directory_route_is_not_read_as_a_ticker(db):
    _stock(db, "AAA")
    _year(db, "AAA", 2025, 10, 1e8)
    db.commit()
    app = FastAPI()
    app.include_router(public_v1.router)
    app.dependency_overrides[get_db] = lambda: db
    workforce._DIRECTORY_CACHE = None
    out = TestClient(app).get("/api/v1/workforce/directory").json()
    assert out["companies"][0]["ticker"] == "AAA"
    workforce._DIRECTORY_CACHE = None
