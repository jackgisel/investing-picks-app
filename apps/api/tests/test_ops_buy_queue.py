"""Friday buy-queue endpoint: ranked names, engine pick, last live buy."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import CompositeScore, Evaluation, SignalRow, Stock, Trade
from app.db.session import get_db
from app.routes import ops

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}


def _score(db, ticker, qr, sector="Technology", **grades):
    defaults = {
        "valuation_grade": "B",
        "growth_grade": "B",
        "profitability_grade": "B",
        "momentum_grade": "B",
        "revisions_grade": "B+",
    }
    defaults.update(grades)
    db.add(
        CompositeScore(
            ticker=ticker,
            as_of=date.today(),
            quant_rating=qr,
            composite=qr * 20,
            sector=sector,
            **defaults,
        )
    )


@pytest.fixture()
def client(db, portfolio):
    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_buy_queue_engine_pick_matches_evaluate(client, db, portfolio):
    _score(db, "TPR", 4.8, sector="Consumer Cyclical")
    _score(db, "AAA", 4.5, sector="Energy")
    db.add(Stock(ticker="TPR", name="Tapestry"))
    db.commit()

    body = client.get("/api/ops/buy-queue", headers=OPS_HEADERS).json()
    assert body["engine_pick"]["ticker"] == "TPR"
    assert body["engine_pick"]["action"] == "buy"
    selected = [c for c in body["candidates"] if c["status"] == "selected"]
    assert [c["ticker"] for c in selected] == ["TPR"]
    assert selected[0]["name"] == "Tapestry"
    tpr = next(c for c in body["candidates"] if c["ticker"] == "TPR")
    aaa = next(c for c in body["candidates"] if c["ticker"] == "AAA")
    assert tpr["rank"] == 1
    assert aaa["status"] == "blocked"
    assert aaa["blocked_by"] == "max_adds"
    assert body["last_buy"] is None
    assert body["next_evaluation"]["target"]
    assert body["portfolio"]["position_count"] == 0


def test_buy_queue_empty_when_nothing_clears_the_gates(client, db, portfolio):
    _score(db, "MISS", 4.8, revisions_grade="C")
    db.commit()

    body = client.get("/api/ops/buy-queue", headers=OPS_HEADERS).json()
    assert body["engine_pick"] is None
    miss = next(c for c in body["candidates"] if c["ticker"] == "MISS")
    assert miss["status"] == "near_miss"
    assert miss["blocked_by"] == "criteria"


def test_buy_queue_last_buy_comes_from_an_executed_signal(client, db, portfolio):
    _score(db, "TPR", 4.8, sector="Energy")
    ev = Evaluation(
        portfolio_id=portfolio.id,
        mode="biweekly",
        params_version="test",
        executed=True,
        created_at=datetime(2026, 9, 4, 16, 0, tzinfo=timezone.utc),
    )
    db.add(ev)
    db.flush()
    db.add(
        SignalRow(
            evaluation_id=ev.id,
            ticker="SNDK",
            action="buy",
            reason="Top pick",
            executed=True,
        )
    )
    db.commit()

    body = client.get("/api/ops/buy-queue", headers=OPS_HEADERS).json()
    assert body["engine_pick"]["ticker"] == "TPR"
    assert body["last_buy"]["ticker"] == "SNDK"
    assert body["last_buy"]["action"] == "buy"
    assert body["last_buy"]["source"] == "signal"
    assert body["last_buy"]["evaluation_id"] == ev.id


def test_buy_queue_last_buy_falls_back_to_a_manual_trade(client, db, portfolio):
    _score(db, "TPR", 4.8, sector="Energy")
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="SNDK",
            side="buy",
            shares=10,
            price=100.0,
            notional=1_000.0,
            action="manual_buy",
            reason="Manual entry (admin)",
            timestamp=datetime(2026, 9, 1, 16, 0, tzinfo=timezone.utc),
        )
    )
    db.commit()

    body = client.get("/api/ops/buy-queue", headers=OPS_HEADERS).json()
    assert body["last_buy"]["ticker"] == "SNDK"
    assert body["last_buy"]["action"] == "manual_buy"
    assert body["last_buy"]["source"] == "trade"


def test_buy_queue_writes_nothing(client, db, portfolio):
    _score(db, "TPR", 4.8, sector="Energy")
    db.commit()
    client.get("/api/ops/buy-queue", headers=OPS_HEADERS)
    assert db.query(Evaluation).count() == 0
    assert db.query(Trade).count() == 0


def test_buy_queue_requires_ops_key(client):
    res = client.get("/api/ops/buy-queue")
    assert res.status_code == 401
