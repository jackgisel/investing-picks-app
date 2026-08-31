"""`/ops/editorial-brief` contract.

This route was written without importing `func` and raised NameError on every
call from the day it shipped. Nothing caught it: the three callers (the X
spotlight thread, the Monday market note, the video pack) all treat a non-200
as "no watchlist today" and degrade silently, so the only visible symptom was
spotlight threads that never had a candidate to write about.

Same lesson as test_ops_dry_run.py — a route with no test is a route that only
fails in production. These assertions are deliberately shallow; the point is
that the endpoint executes at all.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import CompositeScore, Stock
from app.db.session import get_db
from app.routes import ops
from conftest import make_position

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}


@pytest.fixture()
def client(db, portfolio):
    make_position(db, portfolio, "HELD", shares=10, avg_cost=10.0, current_price=12.0)
    db.add_all([
        Stock(ticker="HELD", name="Held Co", sector="Technology"),
        Stock(ticker="FREE", name="Unheld Co", sector="Industrials"),
        CompositeScore(
            ticker="HELD", as_of=date(2026, 8, 28), quant_rating=4.5, composite=80.0,
            valuation_grade="B", growth_grade="A", profitability_grade="A",
            momentum_grade="B", revisions_grade="A", sector="Technology",
        ),
        CompositeScore(
            ticker="FREE", as_of=date(2026, 8, 28), quant_rating=4.8, composite=88.0,
            valuation_grade="A", growth_grade="A", profitability_grade="A",
            momentum_grade="A", revisions_grade="A", sector="Industrials",
        ),
    ])
    db.commit()

    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_editorial_brief_responds(client):
    res = client.get("/api/ops/editorial-brief", headers=OPS_HEADERS)
    assert res.status_code == 200, res.text
    assert res.json()["rating_as_of"] == "2026-08-28"


def test_watchlist_excludes_held_names(client):
    """The spotlight thread must never present a holding as a screen candidate."""
    body = client.get("/api/ops/editorial-brief", headers=OPS_HEADERS).json()
    tickers = {c["ticker"] for c in body["watchlist"]}
    assert "FREE" in tickers
    assert "HELD" not in tickers


def test_empty_database_returns_a_null_reading_not_an_error(db):
    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    res = TestClient(app).get("/api/ops/editorial-brief", headers=OPS_HEADERS)
    assert res.status_code == 200, res.text
    assert res.json()["rating_as_of"] is None
