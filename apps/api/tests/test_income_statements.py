"""Income statements for the Sankey visuals: ingest, the reporter watch, API.

The visual's rule is that every figure it draws is a stored vendor row, so the
things pinned here are that the ingest stores what FMP returned (with the
segment mix attached to the right period), that a plan restriction on
quarterly segments is tolerated once rather than failing every ticker, that
the watch picks up a print as soon as its statement lands and stops asking
after, and that the API tells the web app which names are held — the web
app's paywall and the "never post a holding" rule both hang off that flag.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import IncomeStatement, Stock
from app.db.session import get_db
from app.routes import income
from tests.conftest import make_position
from worker.services import income_statements
from worker.services.fmp import FMPAccessError
from worker.services.income_statements import (
    refresh_income_statements,
    refresh_ticker_income,
    watch_reporters,
)

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}
TODAY = date(2026, 10, 2)


def _quarter(period: str, fy: str, fp: str, revenue: float, accepted: str) -> dict:
    return {
        "date": period,
        "fiscalYear": fy,
        "period": fp,
        "acceptedDate": f"{accepted} 16:05:00",
        "revenue": revenue,
        "costOfRevenue": revenue * 0.6,
        "grossProfit": revenue * 0.4,
        "operatingIncome": revenue * 0.2,
        "incomeTaxExpense": revenue * 0.03,
        "netIncome": revenue * 0.15,
        "reportedCurrency": "USD",
    }


class FakeFMP:
    def __init__(self, quarter_segments_allowed: bool = False):
        self.quarter_segments_allowed = quarter_segments_allowed
        self.segment_calls: list[tuple[str, str]] = []

    def income_statement_quarterly(self, ticker, limit=8):
        return [
            _quarter("2026-08-28", "2026", "Q4", 11e9, "2026-09-24"),
            _quarter("2025-08-29", "2025", "Q4", 8e9, "2025-09-25"),
        ]

    def income_statement_annual(self, ticker, limit=2):
        rows = [
            _quarter("2026-08-28", "2026", "FY", 40e9, "2026-10-01"),
            _quarter("2025-08-29", "2025", "FY", 30e9, "2025-10-02"),
        ]
        return rows

    def revenue_product_segmentation(self, ticker, period="annual"):
        self.segment_calls.append((ticker, period))
        if period == "quarter" and not self.quarter_segments_allowed:
            raise FMPAccessError("FMP revenue-product-segmentation returned 402")
        if period == "quarter":
            return [{"date": "2026-08-28", "fiscalYear": 2026, "period": "Q4",
                     "data": {"DRAM": 8e9, "NAND": 3e9}}]
        return [{"date": "2026-08-28", "fiscalYear": 2026, "period": "FY",
                 "data": {"DRAM": 30e9, "NAND": 10e9, "Bad": None}}]


@pytest.fixture()
def client(db):
    app = FastAPI()
    app.include_router(income.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_ingest_stores_quarters_and_years_with_annual_segments(db):
    stored = refresh_ticker_income(db, FakeFMP(), "mu")

    assert stored == 4
    rows = db.query(IncomeStatement).filter_by(ticker="MU").all()
    q = next(r for r in rows if r.period_type == "quarter" and r.period == date(2026, 8, 28))
    fy = next(r for r in rows if r.period_type == "annual" and r.period == date(2026, 8, 28))
    assert q.fiscal_period == "Q4"
    assert q.accepted_date == date(2026, 9, 24)
    assert q.data["revenue"] == 11e9
    # Quarterly segments are off-plan; a quarter never borrows the annual mix.
    assert q.segments is None
    assert fy.segments == {"DRAM": 30e9, "NAND": 10e9}


def test_ingest_attaches_quarterly_segments_when_the_plan_allows(db):
    refresh_ticker_income(db, FakeFMP(quarter_segments_allowed=True), "MU")
    q = db.query(IncomeStatement).filter_by(
        ticker="MU", period_type="quarter", period=date(2026, 8, 28)
    ).one()
    assert q.segments == {"DRAM": 8e9, "NAND": 3e9}


def test_reingest_updates_in_place(db):
    refresh_ticker_income(db, FakeFMP(), "MU")
    refresh_ticker_income(db, FakeFMP(), "MU")
    assert db.query(IncomeStatement).filter_by(ticker="MU").count() == 4


def test_quarterly_segment_restriction_trips_once_per_run(db, portfolio):
    for t in ("AAA", "BBB", "CCC"):
        make_position(db, portfolio, t, 1, 10, 10)
    fmp = FakeFMP()

    result = refresh_income_statements(db, fmp)

    quarter_calls = [c for c in fmp.segment_calls if c[1] == "quarter"]
    assert len(quarter_calls) == 1
    assert result["quarter_segments"] is False
    assert result["failed"] == []
    assert result["tickers"] == 3


class WatchFMP(FakeFMP):
    """A calendar plus, per ticker, when (if yet) its new quarter was filed."""

    def __init__(self, calendar: list[dict], filed: dict[str, str]):
        super().__init__()
        self.calendar = calendar
        self.filed = filed
        self.quarterly_calls: list[str] = []

    def earnings_calendar(self, start, end):
        return self.calendar

    def income_statement_quarterly(self, ticker, limit=8):
        self.quarterly_calls.append(ticker)
        rows = [_quarter("2026-05-29", "2026", "Q3", 10e9, "2026-06-26")]
        if ticker in self.filed:
            rows.insert(0, _quarter("2026-08-28", "2026", "Q4", 11e9, self.filed[ticker]))
        return rows


def _print(ticker: str, day: str, reported: bool = True) -> dict:
    eps = 1.0 if reported else None
    return {"symbol": ticker, "date": day, "epsActual": eps, "revenueActual": None}


def _watch_universe(db, portfolio):
    db.add_all(
        [
            Stock(ticker="BIG", market_cap=500e9, is_active=True),
            Stock(ticker="LATE", market_cap=20e9, is_active=True),
            Stock(ticker="WAIT", market_cap=50e9, is_active=True),
            Stock(ticker="SOON", market_cap=300e9, is_active=True),
            Stock(ticker="TINY", market_cap=1e9, is_active=True),
            Stock(ticker="PICK", market_cap=1e9, is_active=True),
            Stock(ticker="FUND", market_cap=900e9, is_active=True, is_etf=True),
        ]
    )
    db.commit()
    make_position(db, portfolio, "PICK", 1, 10, 10)
    return [
        _print("BIG", "2026-10-01"),
        # Released after the close, dated the next session, filed the evening before.
        _print("LATE", "2026-10-02"),
        _print("WAIT", "2026-09-30"),
        _print("SOON", "2026-10-02", reported=False),
        _print("TINY", "2026-10-01"),
        _print("PICK", "2026-10-01"),
        _print("FUND", "2026-10-01"),
        _print("NOTOURS", "2026-10-01"),
    ]


def test_watch_stores_each_print_once_its_statement_lands(db, portfolio):
    calendar = _watch_universe(db, portfolio)
    fmp = WatchFMP(
        calendar, {"BIG": "2026-10-01", "LATE": "2026-10-01", "PICK": "2026-10-02"}
    )

    result = watch_reporters(db, fmp, today=TODAY)

    # Unreported, under the floor, ETFs and unknown names are never fetched.
    assert sorted(fmp.quarterly_calls) == ["BIG", "LATE", "PICK", "WAIT"]
    assert result["fresh"] == ["LATE", "BIG"]
    assert result["fresh_held"] == ["PICK"]
    # WAIT reported but FMP only has last quarter's filing: nothing stored.
    assert result["waiting"] == 1
    assert db.query(IncomeStatement).filter_by(ticker="WAIT").count() == 0
    big = db.query(IncomeStatement).filter_by(
        ticker="BIG", period_type="quarter", period=date(2026, 8, 28)
    ).one()
    assert big.accepted_date == date(2026, 10, 1)


def test_watch_stops_asking_once_a_print_is_stored(db, portfolio):
    calendar = _watch_universe(db, portfolio)
    fmp = WatchFMP(calendar, {"BIG": "2026-10-01"})
    watch_reporters(db, fmp, today=TODAY)

    fmp.quarterly_calls.clear()
    fmp.filed["WAIT"] = "2026-10-02"
    result = watch_reporters(db, fmp, today=TODAY)

    assert "BIG" not in fmp.quarterly_calls
    assert result["fresh"] == ["WAIT"]


def test_watch_fetches_one_share_class_per_company(db, portfolio):
    db.add_all(
        [
            Stock(ticker="MKC", name="McCormick & Company", market_cap=12e9, is_active=True),
            Stock(ticker="MKC-V", name="McCormick & Company", market_cap=13e9, is_active=True),
        ]
    )
    db.commit()
    fmp = WatchFMP(
        [_print("MKC", "2026-10-01"), _print("MKC-V", "2026-10-01")],
        {"MKC": "2026-10-01", "MKC-V": "2026-10-01"},
    )

    result = watch_reporters(db, fmp, today=TODAY)

    assert fmp.quarterly_calls == ["MKC"]
    assert result["fresh"] == ["MKC"]


def test_watch_checks_the_newest_prints_first_within_the_limit(db, portfolio, monkeypatch):
    monkeypatch.setattr(income_statements, "WATCH_LIMIT", 1)
    calendar = _watch_universe(db, portfolio)
    fmp = WatchFMP(calendar, {})

    result = watch_reporters(db, fmp, today=TODAY)

    assert fmp.quarterly_calls == ["LATE"]
    # The one checked plus the three left for the next tick.
    assert result["waiting"] == 4


def test_theme_list_is_the_names_we_post():
    from worker.services.x_themes import theme_tickers

    tickers = theme_tickers()
    assert "NVDA" in tickers and "MOD" in tickers and "VST" in tickers
    assert "JPM" not in tickers


def test_watch_stores_a_theme_name_under_the_cap(db, portfolio, monkeypatch):
    calendar = _watch_universe(db, portfolio)
    fmp = WatchFMP(calendar, {"TINY": "2026-10-01"})
    monkeypatch.setattr(income_statements, "theme_tickers", lambda: frozenset({"TINY"}))

    result = watch_reporters(db, fmp, today=TODAY)

    assert "TINY" in fmp.quarterly_calls
    assert "TINY" in result["fresh"]


def test_api_flags_held_names_and_lists_recent_filers(db, portfolio, client):
    db.add_all(
        [
            Stock(ticker="MU", name="Micron Technology, Inc.", market_cap=100e9),
            Stock(ticker="NKE", name="NIKE, Inc.", market_cap=50e9),
        ]
    )
    db.commit()
    make_position(db, portfolio, "MU", 1, 10, 10)
    refresh_ticker_income(db, FakeFMP(), "MU")
    refresh_ticker_income(db, FakeFMP(), "NKE")
    # NKE filed recently; push MU's filing out of the window.
    db.query(IncomeStatement).filter_by(ticker="NKE", period_type="quarter").update(
        {"accepted_date": date.today()}
    )
    db.commit()

    one = client.get("/api/ops/income-statements/mu", headers=OPS_HEADERS).json()
    assert one["held"] is True
    assert one["name"] == "Micron Technology, Inc."
    assert [s["period"] for s in one["statements"]] == ["2026-08-28", "2025-08-29"]
    assert one["statements"][0]["fiscal_label"] == "Q4 FY26"

    annual = client.get(
        "/api/ops/income-statements/MU?period_type=annual", headers=OPS_HEADERS
    ).json()
    assert annual["statements"][0]["fiscal_label"] == "FY26"
    assert annual["statements"][0]["segments"] == {"DRAM": 30e9, "NAND": 10e9}

    listing = client.get("/api/ops/income-statements?days=7", headers=OPS_HEADERS).json()
    assert [i["ticker"] for i in listing["recent"]] == ["NKE"]
    assert [i["ticker"] for i in listing["held"]] == ["MU"]


def test_api_requires_the_ops_key_and_a_sane_ticker(client):
    assert client.get("/api/ops/income-statements/MU").status_code == 401
    assert (
        client.get("/api/ops/income-statements/not a ticker!", headers=OPS_HEADERS).status_code
        == 400
    )
