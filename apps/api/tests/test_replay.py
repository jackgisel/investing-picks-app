"""Score-history replay: in-memory evaluate() over stored scores and prices.

The 2026-09-10 leftover on fix/strategy-s1-s7-ci added the harness but never
called it. A module with no test is a module that only breaks in production —
same lesson as test_ops_dry_run.py. Nothing here writes to the book.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from outpick_strategy import RUN118_PARAMS

from app.db.models import CompositeScore, Evaluation, Position, PriceBar, Trade
from app.db.session import get_db
from app.routes import ops
from app.services.replay import (
    FillModel,
    ReplayBook,
    ReplayPosition,
    reconstruct_book,
    replay,
    score_history_range,
)
from conftest import make_position

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}

# 1st and 3rd Fridays of September 2026 (cadence bands 1-7 and 15-21).
FRIDAY = date(2026, 9, 4)
MONDAY = date(2026, 9, 8)
FRIDAY2 = date(2026, 9, 18)


def _score(db, ticker, as_of, qr=4.8, sector="Technology"):
    db.add(
        CompositeScore(
            ticker=ticker,
            as_of=as_of,
            quant_rating=qr,
            composite=90.0,
            valuation_grade="A",
            growth_grade="A",
            profitability_grade="A",
            momentum_grade="A",
            revisions_grade="A",
            sector=sector,
        )
    )
    db.commit()


def _bar(db, ticker, as_of, close):
    db.add(PriceBar(ticker=ticker, date=as_of, close=close))
    db.commit()


def _params():
    return RUN118_PARAMS.with_overrides(position_size_usd=1_000.0, cash_reserve_buys=0)


def _ops_client(db):
    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_score_history_range_is_the_window_replay_can_reach(db, portfolio):
    _score(db, "AAA", FRIDAY)
    _score(db, "BBB", FRIDAY2)
    assert score_history_range(db) == (FRIDAY, FRIDAY2)


def test_replay_buys_the_top_name_and_writes_nothing(db, portfolio):
    _score(db, "AAA", FRIDAY, qr=4.9)
    _score(db, "BBB", FRIDAY, qr=4.8)
    _bar(db, "AAA", FRIDAY, 50.0)
    _bar(db, "BBB", FRIDAY, 40.0)

    start_cash = portfolio.cash
    result = replay(
        db,
        _params(),
        FRIDAY,
        FRIDAY,
        initial_cash=start_cash,
    )

    assert db.query(Trade).count() == 0
    assert db.query(Position).count() == 0
    assert db.query(Evaluation).count() == 0
    assert portfolio.cash == start_cash

    buys = [t for t in result.trades if t.side == "buy"]
    assert len(buys) == 1
    assert buys[0].ticker == "AAA"
    assert buys[0].action == "buy"
    assert buys[0].fill_date == FRIDAY
    assert buys[0].price == 50.0
    assert "AAA" in result.final.positions
    assert result.final.cash == start_cash - buys[0].notional


def test_replay_respects_one_add_per_evaluation(db, portfolio):
    """max_adds_per_evaluation stays 1 — the engine, not a second copy of it."""
    _score(db, "AAA", FRIDAY, qr=4.9)
    _score(db, "BBB", FRIDAY, qr=4.8, sector="Health Care")
    _bar(db, "AAA", FRIDAY, 50.0)
    _bar(db, "BBB", FRIDAY, 40.0)

    result = replay(db, _params(), FRIDAY, FRIDAY, initial_cash=100_000.0)
    buys = [t for t in result.trades if t.side == "buy"]
    assert len(buys) == 1
    assert result.evaluations[0].signals
    buy_signals = [s for s in result.evaluations[0].signals if s.action.value == "buy"]
    assert len(buy_signals) == 1


def test_two_fridays_can_each_add_one_name(db, portfolio):
    _score(db, "AAA", FRIDAY, qr=4.9)
    _score(db, "BBB", FRIDAY, qr=4.1, sector="Health Care")
    _score(db, "AAA", FRIDAY2, qr=4.9)
    _score(db, "BBB", FRIDAY2, qr=4.8, sector="Health Care")
    for d in (FRIDAY, MONDAY, FRIDAY2):
        _bar(db, "AAA", d, 50.0)
        _bar(db, "BBB", d, 40.0)

    result = replay(db, _params(), FRIDAY, FRIDAY2, initial_cash=100_000.0)
    buys = [t for t in result.trades if t.side == "buy"]
    assert [t.ticker for t in buys] == ["AAA", "BBB"]
    assert [t.eval_date for t in buys] == [FRIDAY, FRIDAY2]


def test_next_close_fills_on_the_following_session(db, portfolio):
    _score(db, "AAA", FRIDAY, qr=4.9)
    _bar(db, "AAA", FRIDAY, 50.0)
    _bar(db, "AAA", MONDAY, 55.0)

    same = replay(db, _params(), FRIDAY, FRIDAY, initial_cash=100_000.0)
    nxt = replay(
        db,
        _params(),
        FRIDAY,
        MONDAY,
        fill=FillModel(price="next_close"),
        initial_cash=100_000.0,
    )
    assert same.trades[0].price == 50.0
    assert same.trades[0].fill_date == FRIDAY
    assert nxt.trades[0].price == 55.0
    assert nxt.trades[0].fill_date == MONDAY


def test_replay_sells_a_name_that_has_fallen_through_hold(db, portfolio):
    _score(db, "WIN", FRIDAY, qr=2.0)
    _bar(db, "WIN", FRIDAY, 10.0)

    opening = ReplayBook(
        cash=1_000.0,
        positions={
            "WIN": ReplayPosition(
                ticker="WIN",
                shares=100,
                avg_cost=10.0,
                current_price=10.0,
                initial_investment=1_000.0,
                sector="Technology",
            )
        },
    )
    result = replay(
        db,
        RUN118_PARAMS,
        FRIDAY,
        FRIDAY,
        initial_book=opening,
    )
    sells = [t for t in result.trades if t.side == "sell"]
    assert sells and sells[0].ticker == "WIN"
    assert "WIN" not in result.final.positions


def test_reconstruct_book_replays_ledger_trades_including_house_money(db, portfolio):
    ts_buy = datetime(2026, 8, 7, 20, 0, tzinfo=timezone.utc)
    ts_trim = datetime(2026, 8, 21, 20, 0, tzinfo=timezone.utc)
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="WIN",
            side="buy",
            shares=100,
            price=10.0,
            notional=1_000.0,
            action="buy",
            timestamp=ts_buy,
        )
    )
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="WIN",
            side="sell",
            shares=50,
            price=20.0,
            notional=1_000.0,
            action="partial_sell",
            timestamp=ts_trim,
        )
    )
    # Current cash is after both fills: started 100_000, spent 1_000, received 1_000.
    portfolio.cash = 100_000.0
    db.commit()

    before_trim = reconstruct_book(db, portfolio, date(2026, 8, 7))
    assert before_trim.positions["WIN"].shares == 100
    assert before_trim.positions["WIN"].is_house_money is False
    assert before_trim.cash == pytest.approx(99_000.0)

    after_trim = reconstruct_book(db, portfolio, date(2026, 8, 21))
    assert after_trim.positions["WIN"].shares == 50
    assert after_trim.positions["WIN"].is_house_money is True
    assert after_trim.cash == pytest.approx(100_000.0)


def test_ledger_diff_matches_engine_trades_and_ignores_manual_rows(db, portfolio):
    _score(db, "AAA", FRIDAY, qr=4.9)
    _bar(db, "AAA", FRIDAY, 50.0)
    result = replay(db, _params(), FRIDAY, FRIDAY, initial_cash=100_000.0)
    buy = result.trades[0]
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=buy.ticker,
            side=buy.side,
            shares=buy.shares,
            price=buy.price,
            notional=buy.notional,
            action=buy.action,
            timestamp=datetime(buy.fill_date.year, buy.fill_date.month, buy.fill_date.day, 20, 0, tzinfo=timezone.utc),
            evaluation_id=None,
            signal_id=None,
        )
    )
    # A matching engine trade with evaluation_id set — the empty ids above would
    # be classified as manual. Stamp a dummy evaluation so it counts as engine.
    ev = Evaluation(
        portfolio_id=portfolio.id,
        mode="biweekly",
        params_version="test",
        executed=True,
    )
    db.add(ev)
    db.flush()
    db.query(Trade).filter(Trade.ticker == "AAA").update({"evaluation_id": ev.id})
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="SEED",
            side="buy",
            shares=10,
            price=10.0,
            notional=100.0,
            action="manual_buy",
            timestamp=datetime(2026, 9, 4, 16, 0, tzinfo=timezone.utc),
        )
    )
    db.commit()

    diff = result.diff_against_ledger(db, portfolio.id)
    assert diff["parity"] is True
    assert len(diff["matched"]) == 1
    assert diff["only_in_ledger"] == []
    assert diff["only_in_replay"] == []
    assert [r["ticker"] for r in diff["manual_ignored"]] == ["SEED"]


def test_ops_replay_is_read_only_and_returns_a_summary(db, portfolio):
    make_position(db, portfolio, "KEEP", shares=10, avg_cost=10.0, current_price=12.0)
    _score(db, "AAA", FRIDAY, qr=4.9)
    _bar(db, "AAA", FRIDAY, 50.0)
    start_cash = portfolio.cash
    start_positions = db.query(Position).count()

    res = _ops_client(db).get(
        f"/api/ops/replay?start={FRIDAY.isoformat()}&end={FRIDAY.isoformat()}",
        headers=OPS_HEADERS,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["summary"]["evaluations"] == 1
    assert body["summary"]["trades"] >= 1
    assert body["ledger"] is not None
    assert "evaluations" not in body
    assert db.query(Trade).count() == 0
    assert db.query(Position).count() == start_positions
    assert db.query(Evaluation).count() == 0
    assert portfolio.cash == start_cash


def test_ops_replay_refuses_an_empty_score_history(db, portfolio):
    res = _ops_client(db).get("/api/ops/replay", headers=OPS_HEADERS)
    assert res.status_code == 400
    assert "composite scores" in res.json()["detail"]


def test_ops_replay_detail_includes_per_evaluation_signals(db, portfolio):
    _score(db, "AAA", FRIDAY, qr=4.9)
    _bar(db, "AAA", FRIDAY, 50.0)
    res = _ops_client(db).get(
        f"/api/ops/replay?start={FRIDAY.isoformat()}&end={FRIDAY.isoformat()}&detail=true",
        headers=OPS_HEADERS,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["evaluations"]
    assert body["params"]["max_adds_per_evaluation"] == 1


def test_ops_replay_requires_the_ops_key(db, portfolio):
    res = _ops_client(db).get("/api/ops/replay")
    assert res.status_code == 401
