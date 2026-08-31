"""Macro ingest and the brief the Sunday week-ahead thread is written from.

The thread's governing rule is that every number it publishes appears in its
payload, so the two things worth pinning here are that the ingest stores what
the vendor actually returned (and nothing else), and that re-running it on the
same day updates rather than duplicates — an econ event is ingested before it
happens, with a consensus and no actual, and has to gain its actual later.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import MacroReading
from app.db.session import get_db
from app.routes import ops
from worker.services.ingest import refresh_macro

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}

TODAY = date(2026, 8, 30)


class FakeFMP:
    """Just the two methods `refresh_macro` calls."""

    def __init__(self, rates=None, calendar=None):
        self._rates = rates or []
        self._calendar = calendar or []
        self.rate_calls: list[tuple[str, str]] = []

    def treasury_rates(self, start, end):
        self.rate_calls.append((start, end))
        return self._rates

    def economics_calendar(self, start, end):
        return self._calendar


@pytest.fixture()
def client(db):
    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_ingest_stores_only_the_tenors_the_thread_may_quote(db):
    fmp = FakeFMP(
        rates=[
            {
                "date": "2026-08-28",
                "month1": 4.10,
                "year2": 4.34,
                "year10": 4.726,
                "year30": 5.01,
            }
        ]
    )
    result = refresh_macro(db, fmp, today=TODAY)

    labels = {r.label for r in db.query(MacroReading).all()}
    # month1 is in the vendor row and deliberately not in the payload.
    assert labels == {"treasury_2y", "treasury_10y", "treasury_30y"}
    assert result["inserted"] == 3


def test_ingest_keeps_only_tracked_econ_events(db):
    fmp = FakeFMP(
        calendar=[
            {"date": "2026-09-04", "event": "Nonfarm Payrolls", "estimate": 45000,
             "previous": -23000, "actual": None, "country": "US"},
            {"date": "2026-09-01", "event": "ISM Manufacturing PMI", "estimate": 48.5,
             "previous": 48.0, "actual": None, "country": "US"},
            # Noise the thread should never see.
            {"date": "2026-09-02", "event": "MBA Mortgage Applications",
             "estimate": None, "previous": None, "actual": None, "country": "US"},
        ]
    )
    refresh_macro(db, fmp, today=TODAY)

    events = {r.label for r in db.query(MacroReading).filter(
        MacroReading.kind == "econ_event"
    )}
    assert events == {"Nonfarm Payrolls", "ISM Manufacturing PMI"}


def test_reingesting_an_event_updates_it_rather_than_duplicating(db):
    before = FakeFMP(calendar=[
        {"date": "2026-09-04", "event": "Nonfarm Payrolls", "estimate": 45000,
         "previous": -23000, "actual": None, "country": "US"},
    ])
    refresh_macro(db, before, today=TODAY)

    # Same release, now printed.
    after = FakeFMP(calendar=[
        {"date": "2026-09-04", "event": "Nonfarm Payrolls", "estimate": 45000,
         "previous": -23000, "actual": 22000, "country": "US"},
    ])
    refresh_macro(db, after, today=TODAY)

    rows = db.query(MacroReading).filter(MacroReading.kind == "econ_event").all()
    assert len(rows) == 1
    assert rows[0].value == 22000
    assert rows[0].consensus == 45000


def test_brief_reports_the_week_over_week_change_in_basis_points(db, client):
    db.add_all([
        MacroReading(kind="treasury", label="treasury_10y",
                     as_of=date(2026, 8, 21), value=4.60, unit="percent"),
        MacroReading(kind="treasury", label="treasury_10y",
                     as_of=date(2026, 8, 28), value=4.726, unit="percent"),
    ])
    db.commit()

    body = client.get("/api/ops/macro-brief", headers=OPS_HEADERS).json()

    assert body["rates_as_of"] == "2026-08-28"
    ten_year = next(y for y in body["yields"] if y["series"] == "treasury_10y")
    assert ten_year["percent"] == 4.726
    assert ten_year["change_bp"] == 12.6
    assert ten_year["week_ago_as_of"] == "2026-08-21"


def test_brief_omits_a_change_it_has_no_prior_session_for(db, client):
    db.add(MacroReading(kind="treasury", label="treasury_2y",
                        as_of=date(2026, 8, 28), value=4.34, unit="percent"))
    db.commit()

    body = client.get("/api/ops/macro-brief", headers=OPS_HEADERS).json()

    # Null, never zero: "unchanged on the week" is a claim we cannot support.
    assert body["yields"][0]["change_bp"] is None
    assert body["yields"][0]["week_ago_percent"] is None


def test_brief_serves_upcoming_releases_not_past_ones(db, client):
    today = date.today()
    db.add_all([
        MacroReading(kind="econ_event", label="Old CPI",
                     as_of=today - timedelta(days=3), value=2.9),
        MacroReading(kind="econ_event", label="Nonfarm Payrolls",
                     as_of=today + timedelta(days=5), consensus=45000,
                     previous=-23000),
    ])
    db.commit()

    body = client.get("/api/ops/macro-brief", headers=OPS_HEADERS).json()

    assert [e["event"] for e in body["calendar"]] == ["Nonfarm Payrolls"]
    assert body["calendar"][0]["consensus"] == 45000


def test_brief_is_empty_rather_than_erroring_before_the_first_ingest(client):
    body = client.get("/api/ops/macro-brief", headers=OPS_HEADERS).json()
    # The caller turns this into the payload's `missing` array.
    assert body == {"rates_as_of": None, "yields": [], "calendar": []}
