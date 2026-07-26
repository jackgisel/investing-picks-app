"""Dry-run endpoint contract.

The 2026-07-25 outage came from reading `params.min_revisions_grade`, which
lives on the nested `buy_criteria`, not on StrategyParams. Every other test
passed because nothing called the endpoint — a route that only breaks in
production is exactly the kind this file exists to catch.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import CompositeScore
from app.db.session import get_db
from app.routes import ops
from conftest import make_position

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}


@pytest.fixture()
def client(db, portfolio):
    make_position(db, portfolio, "AAA", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(
        CompositeScore(
            ticker="AAA",
            as_of=date.today(),
            quant_rating=4.5,
            composite=80.0,
            valuation_grade="A",
            growth_grade="A",
            profitability_grade="A",
            momentum_grade="A",
            revisions_grade="F",
            sector="Technology",
        )
    )
    db.commit()

    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_dry_run_returns_universe_diagnostics(client):
    res = client.get("/api/ops/dry-run", headers=OPS_HEADERS)
    assert res.status_code == 200, res.text

    universe = res.json()["universe"]
    # The gate is read off buy_criteria; a wrong attribute path 500s the route.
    assert universe["revisions_gate"] == "B+"
    assert universe["scored_tickers"] == 1
    assert universe["held_with_scores"] == 1
    # The only score grades F on revisions, so nothing clears a B+ gate.
    assert universe["passing_revisions_gate"] == 0


def test_dry_run_counts_scores_that_clear_the_gate(client, db):
    row = db.query(CompositeScore).filter(CompositeScore.ticker == "AAA").one()
    row.revisions_grade = "A"
    db.commit()

    universe = client.get("/api/ops/dry-run", headers=OPS_HEADERS).json()["universe"]
    assert universe["passing_revisions_gate"] == 1


def test_dry_run_writes_nothing(client, db):
    """The read-only guarantee the ops page states in the UI."""
    from app.db.models import Evaluation, Trade

    client.get("/api/ops/dry-run", headers=OPS_HEADERS)

    assert db.query(Evaluation).count() == 0
    assert db.query(Trade).count() == 0


def test_diagnosis_names_the_single_snapshot_cause(db, portfolio):
    """The old message blamed weekly_refresh even when it had run fine."""
    from datetime import date

    from app.db.models import Fundamentals
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.routes import ops

    db.add(Fundamentals(ticker="AAA", as_of=date.today(), data={"x": 1}))
    db.commit()

    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    res = TestClient(app).get("/api/ops/dry-run", headers=OPS_HEADERS)

    diagnosis = res.json()["diagnosis"]
    assert diagnosis["state"] == "awaiting_second_snapshot"
    assert "two snapshots" in diagnosis["detail"]


def test_diagnosis_reports_missing_fundamentals(db, portfolio):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.routes import ops

    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    res = TestClient(app).get("/api/ops/dry-run", headers=OPS_HEADERS)

    assert res.json()["diagnosis"]["state"] == "no_fundamentals"
