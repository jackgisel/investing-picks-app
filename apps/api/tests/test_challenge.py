"""Beat the S&P challenge: entry rules, scoring, and the public payloads."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.models import ChallengePrice, ChallengePriceCheck, Stock
from app.db.session import get_db
from app.routes import public_v1
from app.services import challenge

NOW = datetime(2026, 10, 7, 18, 0, tzinfo=timezone.utc)  # 14:00 in New York


def _stocks(db, n=16, cap=5e9):
    for i in range(n):
        db.add(Stock(ticker=f"T{i:02d}", name=f"Test Co {i}", sector="Technology",
                     market_cap=cap, is_active=True, is_etf=False))
    db.add(Stock(ticker="SPY", name="SPDR", market_cap=5e11, is_active=True, is_etf=True))
    db.add(Stock(ticker="TINY", name="Tiny Co", market_cap=1e8, is_active=True, is_etf=False))
    db.commit()


def _prices(db, ticker, closes: dict[str, float]):
    for d, c in closes.items():
        db.add(ChallengePrice(ticker=ticker, date=date.fromisoformat(d), close=c))
    db.commit()


def _enter(db, user="u1", n=15, now=NOW):
    return challenge.create_entry(
        db, user_id=user, display_name="Value  Hunter", tickers=[f"T{i:02d}" for i in range(n)], now=now
    )


@pytest.fixture(autouse=True)
def _fresh_cache():
    challenge._BOARD_CACHE.clear()
    yield
    challenge._BOARD_CACHE.clear()


def test_entry_rules(db):
    _stocks(db)
    with pytest.raises(challenge.EntryError) as e:
        _enter(db, n=14)
    assert e.value.code == "too_few"
    with pytest.raises(challenge.EntryError) as e:
        challenge.create_entry(db, user_id="u", display_name="Jo",
                               tickers=[f"T{i:02d}" for i in range(14)] + ["SPY", "TINY"], now=NOW)
    assert e.value.code == "ineligible" and e.value.tickers == ["SPY", "TINY"]


def test_one_entry_per_user_per_quarter(db):
    _stocks(db)
    first = _enter(db)
    assert "id" in first
    assert _enter(db) == {"existing_id": first["id"]}
    nextq = _enter(db, now=datetime(2027, 1, 5, 18, tzinfo=timezone.utc))
    assert "id" in nextq
    entries = challenge.user_entries(db, "u1")
    assert [e["cohort"] for e in entries] == ["2027-Q1", "2026-Q4"]


def test_submission_date_is_new_york(db):
    _stocks(db)
    out = _enter(db, now=datetime(2026, 10, 8, 1, 30, tzinfo=timezone.utc))
    detail = challenge.entry_detail(db, out["id"])
    assert detail["submitted_on"] == "2026-10-07"
    assert detail["display_name"] == "Value Hunter"


def test_scores_from_the_first_close_after_submission(db):
    _stocks(db)
    entry = _enter(db)["id"]
    # Oct 7 is the submission day, so the Oct 7 close is never the start.
    _prices(db, "SPY", {"2026-10-07": 90.0, "2026-10-08": 100.0, "2026-10-09": 110.0})
    _prices(db, "T00", {"2026-10-07": 1.0, "2026-10-08": 10.0, "2026-10-09": 20.0})
    for i in range(1, 15):
        _prices(db, f"T{i:02d}", {"2026-10-08": 10.0, "2026-10-09": 10.0})
    db.add(ChallengePriceCheck(ticker="SPY", checked_at=NOW, bars=3, basis="total_return"))
    db.commit()

    b = challenge.board(db)
    row = b["rows"][0]
    assert row["start_date"] == "2026-10-08"
    assert row["ret"] == pytest.approx(1 / 15)       # one pick doubled out of fifteen
    assert row["spy_ret"] == pytest.approx(0.10)
    assert row["excess"] == pytest.approx(1 / 15 - 0.10)
    assert b["basis"] == "total_return"
    assert b["stats"]["beating"] == 0

    d = challenge.entry_detail(db, entry)
    assert [p["date"] for p in d["series"]] == ["2026-10-08", "2026-10-09"]
    assert d["series"][-1]["growth"] == pytest.approx(1 + 1 / 15)
    assert d["picks"][0]["ticker"] == "T00"
    assert "user_id" not in d


def test_a_pick_with_no_price_counts_as_flat(db):
    _stocks(db)
    _enter(db)
    _prices(db, "SPY", {"2026-10-08": 100.0, "2026-10-09": 100.0})
    for i in range(15):
        _prices(db, f"T{i:02d}", {"2026-10-08": 10.0, "2026-10-09": 10.0} if i else {})
    assert challenge.board(db)["rows"][0]["ret"] == pytest.approx(0.0)


def test_pending_entries_follow_scored_ones_and_hidden_ones_vanish(db):
    _stocks(db)
    early = _enter(db, user="early", now=datetime(2026, 10, 1, 18, tzinfo=timezone.utc))["id"]
    late = _enter(db, user="late")["id"]
    _prices(db, "SPY", {"2026-10-02": 100.0, "2026-10-05": 100.0})
    for i in range(15):
        _prices(db, f"T{i:02d}", {"2026-10-02": 10.0, "2026-10-05": 11.0})
    rows = challenge.board(db)["rows"]
    assert [r["id"] for r in rows] == [early, late]
    assert rows[1]["start_date"] is None and rows[1]["excess"] is None
    challenge.set_hidden(db, early, True)
    assert [r["id"] for r in challenge.board(db)["rows"]] == [late]
    assert challenge.entry_detail(db, early) is None


def test_public_routes(db):
    _stocks(db)
    entry = _enter(db)["id"]
    app = FastAPI()
    app.include_router(public_v1.router)
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    assert client.get("/api/v1/challenge/stocks?q=t0").json()["results"][0]["ticker"].startswith("T0")
    assert client.get("/api/v1/challenge/stocks?q=tiny").json()["results"] == []
    board = client.get("/api/v1/challenge/board").json()
    assert board["rows"][0]["id"] == entry
    assert "user_id" not in board["rows"][0]
    assert client.get("/api/v1/challenge/board?cohort=bad").status_code == 422
    assert client.get(f"/api/v1/challenge/entries/{entry}").status_code == 200
    assert client.get("/api/v1/challenge/entries/nope").status_code == 404


OPS = {"X-Ops-Key": "dev-ops-key"}


def _ops_client(db):
    from app.routes import ops

    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_ops_routes_create_list_and_hide(db):
    _stocks(db)
    client = _ops_client(db)
    body = {"user_id": "u9", "display_name": "Jo Picks", "tickers": [f"T{i:02d}" for i in range(15)]}
    assert client.post("/api/ops/challenge/entries", json=body).status_code in (401, 403)
    made = client.post("/api/ops/challenge/entries", json=body, headers=OPS)
    assert made.status_code == 201
    again = client.post("/api/ops/challenge/entries", json=body, headers=OPS)
    assert again.status_code == 409 and again.json()["existing_id"] == made.json()["id"]
    bad = client.post("/api/ops/challenge/entries", json={**body, "tickers": ["TINY"] * 15}, headers=OPS)
    assert bad.status_code == 422
    listed = client.get("/api/ops/challenge/users/u9/entries", headers=OPS).json()
    assert listed["entries"][0]["id"] == made.json()["id"]
    hid = client.post(f"/api/ops/challenge/entries/{made.json()['id']}/hidden", json={"hidden": True}, headers=OPS)
    assert hid.status_code == 200
    assert challenge.entry_detail(db, made.json()["id"]) is None


def test_tool_snapshot_is_behind_the_ops_key(db):
    from app.db.models import Fundamentals

    _stocks(db)
    db.add(Fundamentals(ticker="T00", as_of=date(2026, 10, 1), data={"netProfitMarginTTM": 0.2}))
    db.commit()
    client = _ops_client(db)
    assert client.get("/api/ops/tools/snapshot/t00").status_code in (401, 403)
    snap = client.get("/api/ops/tools/snapshot/t00", headers=OPS).json()
    assert snap["name"] == "Test Co 0" and snap["data"] == {"netProfitMarginTTM": 0.2}
    assert client.get("/api/ops/tools/snapshot/none", headers=OPS).json()["data"] is None
