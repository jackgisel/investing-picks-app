"""Headcount ingest: parsing, point-in-time storage, and who gets asked.

The rules pinned here: a row with no filing date is dropped (the filing date
is the availability date, so guessing one would leak the future into a
backtest); stored rows are never rewritten; a name FMP has nothing for is not
re-requested every run; a name with a fresh 10-K is not asked at all; an
off-plan endpoint or an all-empty run raises instead of recording success.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import CompanyRevenue, EmployeeCount, EmployeeCountCheck, Stock
from worker.services import employee_counts
from worker.services.employee_counts import (
    coverage,
    parse_employee_count,
    refresh_employee_counts,
    tickers_to_check,
)
from worker.services.fmp import FMPAccessError

TODAY = date(2026, 10, 4)


def _row(period="2025-12-31", filed="2026-02-20", count=1000, form="10-K"):
    return {
        "symbol": "X",
        "periodOfReport": period,
        "filingDate": filed,
        "employeeCount": count,
        "formType": form,
        "source": "https://sec.gov/x",
    }


class FakeFMP:
    def __init__(self, data=None, access_error=False, failing=(), denied=()):
        self.data = data or {}
        self.access_error = access_error
        self.failing = set(failing)
        self.denied = set(denied)
        self.revenue: dict = {}
        self.asked: list[str] = []

    def income_statement_annual(self, ticker, limit=2):
        return self.revenue.get(ticker, [])

    def employee_count_history(self, ticker, limit=10):
        self.asked.append(ticker)
        if self.access_error or ticker in self.denied:
            raise FMPAccessError("FMP historical-employee-count returned 402")
        if ticker in self.failing:
            return None
        return self.data.get(ticker, [])


@pytest.fixture()
def universe(db, monkeypatch):
    tickers = ["AAA", "BBB", "CCC"]
    for t in tickers:
        db.add(Stock(ticker=t, name=t, is_active=True, is_etf=False))
    db.commit()
    monkeypatch.setattr(
        employee_counts, "snapshot_universe_tickers", lambda db, fmp: list(tickers)
    )
    return tickers


def test_parse_keeps_filing_date_as_availability():
    parsed = parse_employee_count(_row())
    assert parsed["period_of_report"] == date(2025, 12, 31)
    assert parsed["filing_date"] == date(2026, 2, 20)
    assert parsed["employee_count"] == 1000
    assert parsed["form_type"] == "10-K"


def test_parse_drops_rows_it_cannot_place_in_time():
    assert parse_employee_count(_row(filed=None)) is None
    assert parse_employee_count(_row(period=None)) is None
    assert parse_employee_count(_row(count=None)) is None
    assert parse_employee_count(_row(count=-5)) is None


def test_parse_accepts_float_strings_and_has_no_period_fallback():
    assert parse_employee_count(_row(count="1234.0"))["employee_count"] == 1234
    row = _row()
    row.pop("periodOfReport")
    row["date"] = "2025-12-31"
    assert parse_employee_count(row) is None


def test_parse_keeps_zero_headcount():
    # Externally managed REITs report none; that is data, not a gap.
    assert parse_employee_count(_row(count=0))["employee_count"] == 0


def test_refresh_stores_history_and_records_checks(db, universe):
    fmp = FakeFMP(
        {
            "AAA": [
                _row("2025-12-31", "2026-02-20", 1000),
                _row("2024-12-31", "2025-02-21", 900),
            ],
            "BBB": [_row(count=50)],
        }
    )
    result = refresh_employee_counts(db, fmp, today=TODAY)
    assert result["asked"] == 3 and result["with_data"] == 2 and result["empty"] == 1
    assert db.query(EmployeeCount).filter_by(ticker="AAA").count() == 2
    assert db.get(EmployeeCountCheck, "CCC").rows == 0


def test_refresh_is_append_only_and_idempotent(db, universe):
    fmp = FakeFMP({"AAA": [_row(count=1000)], "BBB": [_row(count=5)]})
    refresh_employee_counts(db, fmp, today=TODAY)
    # A later run sees a changed figure for the same filing: first one wins.
    fmp.data["AAA"] = [_row(count=9999)]
    db.query(EmployeeCountCheck).delete()
    db.commit()
    refresh_employee_counts(db, fmp, today=TODAY)
    rows = db.query(EmployeeCount).filter_by(ticker="AAA").all()
    assert [r.employee_count for r in rows] == [1000]


def test_amended_filing_is_a_new_row(db, universe):
    fmp = FakeFMP(
        {
            "AAA": [
                _row("2025-12-31", "2026-02-20", 1000),
                _row("2025-12-31", "2026-04-02", 1100, form="10-K/A"),
            ],
            "BBB": [_row()],
        }
    )
    refresh_employee_counts(db, fmp, today=TODAY)
    assert db.query(EmployeeCount).filter_by(ticker="AAA").count() == 2


def test_fresh_filing_and_recent_empty_are_not_asked_again(db, universe):
    fmp = FakeFMP({"AAA": [_row(filed="2026-02-20")], "BBB": [_row()]})
    refresh_employee_counts(db, fmp, today=TODAY)
    again = FakeFMP()
    result = refresh_employee_counts(db, again, today=TODAY)
    assert again.asked == [] and result["queued"] == 0


def test_overdue_and_stale_empty_names_are_rechecked(db, universe):
    fmp = FakeFMP({"AAA": [_row(filed="2026-02-20")], "BBB": [_row()]})
    refresh_employee_counts(db, fmp, today=TODAY)
    # A year on: AAA could have a new 10-K, CCC's empty answer is old.
    later = TODAY + timedelta(days=366)
    long_ago = datetime.now(timezone.utc) - timedelta(days=400)
    db.query(EmployeeCountCheck).update({"checked_at": long_ago})
    db.commit()
    assert set(tickers_to_check(db, universe, later)) == {"AAA", "BBB", "CCC"}


def test_held_names_are_asked_first(db, universe, monkeypatch):
    monkeypatch.setattr(employee_counts, "held_tickers", lambda db: {"CCC"})
    fmp = FakeFMP({"AAA": [_row()]})
    refresh_employee_counts(db, fmp, today=TODAY)
    assert fmp.asked[0] == "CCC"


def test_time_budget_leaves_a_resumable_remainder(db, universe):
    fmp = FakeFMP({"AAA": [_row()], "BBB": [_row()], "CCC": [_row()]})
    result = refresh_employee_counts(db, fmp, today=TODAY, budget_seconds=-1)
    assert result["asked"] == 0 and result["remaining"] == 3
    resumed = refresh_employee_counts(db, fmp, today=TODAY)
    assert resumed["asked"] == 3 and resumed["remaining"] == 0


def test_off_plan_endpoint_raises(db, universe):
    with pytest.raises(FMPAccessError):
        refresh_employee_counts(db, FakeFMP(access_error=True), today=TODAY)
    assert db.query(EmployeeCountCheck).count() == 0


def test_failed_request_is_not_recorded_as_empty(db, universe):
    fmp = FakeFMP({"AAA": [_row()], "BBB": [_row()]}, failing={"CCC"})
    result = refresh_employee_counts(db, fmp, today=TODAY)
    assert result["errors"] == 1 and result["empty"] == 0
    assert db.get(EmployeeCountCheck, "CCC") is None
    # Asked again next run, not hidden for 60 days.
    again = FakeFMP({"CCC": [_row(count=7)]})
    refresh_employee_counts(db, again, today=TODAY)
    assert again.asked == ["CCC"]
    assert db.query(EmployeeCount).filter_by(ticker="CCC").count() == 1


def test_one_restricted_symbol_does_not_block_the_run(db, universe):
    fmp = FakeFMP({"BBB": [_row()], "CCC": [_row()]}, denied={"AAA"})
    result = refresh_employee_counts(db, fmp, today=TODAY)
    assert result["with_data"] == 2 and result["errors"] == 1
    assert db.get(EmployeeCountCheck, "AAA") is None


def test_recheck_of_known_empty_names_does_not_trip_the_alarm(db, monkeypatch):
    many = [f"T{i}" for i in range(30)]
    monkeypatch.setattr(
        employee_counts, "snapshot_universe_tickers", lambda db, fmp: list(many)
    )
    long_ago = datetime.now(timezone.utc) - timedelta(days=90)
    for t in many:
        db.add(EmployeeCountCheck(ticker=t, checked_at=long_ago, rows=0))
    db.commit()
    result = refresh_employee_counts(db, FakeFMP(), today=TODAY)
    assert result["asked"] == 30 and result["with_data"] == 0


def test_all_empty_run_raises_instead_of_recording_success(db, monkeypatch):
    many = [f"T{i}" for i in range(30)]
    monkeypatch.setattr(
        employee_counts, "snapshot_universe_tickers", lambda db, fmp: list(many)
    )
    with pytest.raises(RuntimeError, match="0 filings from 30"):
        refresh_employee_counts(db, FakeFMP(), today=TODAY)


def test_coverage_reports_counts_and_overdue(db, universe):
    fmp = FakeFMP({"AAA": [_row(filed="2025-01-15")], "BBB": [_row(filed="2026-02-20")]})
    refresh_employee_counts(db, fmp, today=TODAY)
    out = coverage(db, today=TODAY)
    assert out["tickers_with_headcount"] == 2
    assert out["tickers_empty"] == 1
    assert out["tickers_overdue_for_new_filing"] == 1
    assert out["newest_filing"] == "2026-02-20"


def _statement(period="2025-12-31", revenue=5e9, filed="2026-02-20"):
    return {
        "date": period,
        "revenue": revenue,
        "acceptedDate": f"{filed} 16:05:00",
        "reportedCurrency": "USD",
    }


def test_revenue_is_stored_for_names_with_a_headcount_only(db, universe):
    fmp = FakeFMP({"AAA": [_row()]})
    fmp.revenue = {
        "AAA": [_statement("2025-12-31", 5e9), _statement("2024-12-31", 4e9)],
        "CCC": [_statement()],
    }
    refresh_employee_counts(db, fmp, today=TODAY)
    assert db.query(CompanyRevenue).filter_by(ticker="AAA").count() == 2
    assert db.query(CompanyRevenue).filter_by(ticker="CCC").count() == 0
    row = db.query(CompanyRevenue).filter_by(ticker="AAA", period=date(2025, 12, 31)).one()
    assert row.revenue == 5e9 and row.currency == "USD"
    assert row.filing_date == date(2026, 2, 20)


def test_first_revenue_for_a_year_wins(db, universe):
    fmp = FakeFMP({"AAA": [_row()]})
    fmp.revenue = {"AAA": [_statement(revenue=5e9)]}
    refresh_employee_counts(db, fmp, today=TODAY)
    fmp.revenue = {"AAA": [_statement(revenue=9e9)]}
    from worker.services.employee_counts import store_revenue

    store_revenue(db, "AAA", fmp.revenue["AAA"])
    assert db.query(CompanyRevenue).filter_by(ticker="AAA").one().revenue == 5e9


def test_revenue_backfill_fetches_revenue_only_for_names_missing_it(db, universe):
    fmp = FakeFMP({"AAA": [_row()], "BBB": [_row()]})
    refresh_employee_counts(db, fmp, today=TODAY)  # revenue came back empty
    assert db.query(CompanyRevenue).count() == 0
    fmp.revenue = {"AAA": [_statement()]}
    fmp.asked.clear()
    result = refresh_employee_counts(db, fmp, today=TODAY)
    # Nobody is due for a headcount recheck; revenue alone was retried.
    assert fmp.asked == [] and result["revenue_backfilled"] == 2
    assert db.query(CompanyRevenue).filter_by(ticker="AAA").count() == 1


def test_refused_income_statement_does_not_abort_the_run(db, universe):
    class Refusing(FakeFMP):
        def income_statement_annual(self, ticker, limit=2):
            raise FMPAccessError("FMP income-statement returned 403")

    result = refresh_employee_counts(db, Refusing({"AAA": [_row()], "BBB": [_row()]}), today=TODAY)
    assert result["with_data"] == 2
    assert db.get(EmployeeCountCheck, "BBB") is not None
