"""One-off second pick on an evaluation that already bought."""

from __future__ import annotations

from datetime import date

import pytest

from app.db.models import CompositeScore, Position, SignalReason, SignalRow, Stock, Trade
from app.services.extra_buy import ExtraBuyRefused, run_extra_buy
from app.services.portfolio import run_evaluation


def _score(db, ticker, qr, sector, **grades):
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
    db.add(Stock(ticker=ticker, name=ticker, sector=sector, last_price=100.0))


@pytest.fixture()
def cycle(db, portfolio):
    """MU ranked first and bought; BBB second; TPR third."""
    _score(db, "MU", 4.9, "Technology")
    _score(db, "BBB", 4.7, "Energy")
    _score(db, "TPR", 4.5, "Consumer Cyclical")
    db.commit()
    ev = run_evaluation(db, portfolio_id=portfolio.id, mode="biweekly")
    bought = [s.ticker for s in ev.signals if s.action == "buy" and s.executed]
    assert bought == ["MU"]
    return ev


def test_dry_run_writes_nothing(db, portfolio, cycle):
    cash = portfolio.cash
    result = run_extra_buy(db, "TPR")
    assert not result.committed
    assert result.rank == 3
    assert result.queue_status == "max_adds"
    assert result.cycle_buys == ["MU"]
    assert db.query(Position).filter_by(ticker="TPR").first() is None
    db.refresh(portfolio)
    assert portfolio.cash == cash


def test_commit_buys_into_the_same_evaluation(db, portfolio, cycle):
    result = run_extra_buy(db, "TPR", commit=True)
    assert result.committed
    assert result.cycle_buys == ["MU", "TPR"]

    mu = db.query(Trade).filter_by(ticker="MU").one()
    tpr = db.query(Trade).filter_by(ticker="TPR").one()
    assert tpr.evaluation_id == cycle.id
    assert tpr.action == "buy"
    assert tpr.notional == pytest.approx(mu.notional)
    assert db.query(Position).filter_by(ticker="TPR").one().shares > 0

    row = db.query(SignalRow).filter_by(evaluation_id=cycle.id, ticker="TPR").one()
    assert row.executed
    assert row.metadata_json["one_off_extra_buy"] is True
    override = (
        db.query(SignalReason)
        .filter_by(signal_id=row.id, rule_id="max_adds_per_evaluation")
        .one()
    )
    assert override.passed is False


def test_second_call_is_a_no_op(db, portfolio, cycle):
    run_extra_buy(db, "TPR", commit=True)
    cash = portfolio.cash
    again = run_extra_buy(db, "TPR", commit=True)
    assert again.already_done
    assert db.query(Trade).filter_by(ticker="TPR").count() == 1
    db.refresh(portfolio)
    assert portfolio.cash == cash


def test_refuses_without_todays_evaluation(db, portfolio):
    _score(db, "TPR", 4.5, "Consumer Cyclical")
    db.commit()
    with pytest.raises(ExtraBuyRefused, match="No executed"):
        run_extra_buy(db, "TPR")


def test_refuses_a_name_that_fails_the_gates(db, portfolio, cycle):
    _score(db, "MISS", 4.6, "Utilities", revisions_grade="C")
    db.commit()
    with pytest.raises(ExtraBuyRefused, match="blocked"):
        run_extra_buy(db, "MISS")


def test_refuses_a_name_held_from_before(db, portfolio, cycle):
    _score(db, "OLD", 4.6, "Utilities")
    db.add(
        Position(
            portfolio_id=portfolio.id,
            ticker="OLD",
            shares=1,
            avg_cost=100.0,
            current_price=100.0,
            entry_date=date(2026, 1, 2),
        )
    )
    db.commit()
    with pytest.raises(ExtraBuyRefused, match="already held"):
        run_extra_buy(db, "OLD")


def test_ops_endpoint_previews_commits_and_refuses(db, portfolio, cycle):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.routes import ops

    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    headers = {"X-Ops-Key": "dev-ops-key"}

    preview = client.post("/api/ops/extra-buy", json={"ticker": "TPR"}, headers=headers)
    assert preview.status_code == 200
    assert preview.json()["committed"] is False
    assert db.query(Trade).filter_by(ticker="TPR").count() == 0

    done = client.post(
        "/api/ops/extra-buy", json={"ticker": "TPR", "commit": True}, headers=headers
    )
    assert done.json()["committed"] is True
    assert done.json()["cycle_buys"] == ["MU", "TPR"]

    refused = client.post("/api/ops/extra-buy", json={"ticker": "ZZZ"}, headers=headers)
    assert refused.status_code == 409
    assert "not scored" in refused.json()["detail"]
