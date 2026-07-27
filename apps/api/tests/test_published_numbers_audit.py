"""Audit of every number this API publishes about money.

Each test names the real failure it prevents. Tests marked `xfail(strict=True)`
assert the CORRECT behaviour and currently fail — they are the open bugs.

Nothing in here fixes production code.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from outpick_strategy import Action, Signal
from outpick_strategy.params import StrategyParams

from app.db.models import (
    CompositeScore,
    PortfolioSnapshot,
    Position,
    PriceBar,
    SignalRow,
    Stock,
    Trade,
)
from app.db.session import get_db
from app.routes import ops
from app.routes.public_v1 import get_performance, get_picks, get_strategy
from app.services.benchmarks import picks_series
from app.services.portfolio import (
    apply_signals,
    load_portfolio_state,
    persist_evaluation,
    picks_return,
    picks_return_pct,
    run_evaluation,
    total_return_pct,
)
from conftest import make_position

OPS_HEADERS = {"X-Ops-Key": "dev-ops-key"}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _trade(db, portfolio, ticker, side, shares, price, action, when=None):
    row = Trade(
        portfolio_id=portfolio.id,
        ticker=ticker,
        side=side,
        shares=shares,
        price=price,
        notional=shares * price,
        action=action,
    )
    if when is not None:
        row.timestamp = when
    db.add(row)
    db.commit()
    return row


def _bar(db, ticker, day, close):
    db.add(PriceBar(ticker=ticker, date=day, close=close))
    db.commit()


def _snapshot(db, portfolio, day, total, spy=500.0, cash=0.0):
    db.add(
        PortfolioSnapshot(
            portfolio_id=portfolio.id,
            date=day,
            cash=cash,
            invested_value=total - cash,
            total_value=total,
            spy_value=spy,
            position_count=1,
        )
    )
    db.commit()


def _execute(db, portfolio, signals):
    """persist_evaluation + apply_signals, the way run_evaluation does it."""
    ev = persist_evaluation(
        db,
        portfolio,
        "biweekly",
        StrategyParams(),
        load_portfolio_state(db, portfolio),
        signals,
        executed=True,
    )
    trades = apply_signals(db, portfolio, signals, ev)
    db.commit()
    return ev, trades


@pytest.fixture()
def ops_client(db, portfolio):
    app = FastAPI()
    app.include_router(ops.router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


# ---------------------------------------------------------------------------
# BUG-A1 — an admin edit desynchronises the picks-return denominator
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-A1: PATCH /api/ops/positions/{ticker} changes shares and cost basis "
        "and settles cash, but writes no Trade row. picks_return's denominator "
        "is built from trade notionals while its numerator is the live position "
        "market value, so any admin edit inflates (or deflates) the published "
        "picks return."
    ),
    strict=True,
)
def test_editing_a_position_does_not_invent_a_return(ops_client, db, portfolio):
    # Prevents: the site publishing "+100%" on a book that has gained nothing,
    # purely because an operator corrected a share count in the ops UI.
    res = ops_client.post(
        "/api/ops/positions",
        headers=OPS_HEADERS,
        json={"ticker": "AAA", "entry_price": 100.0, "shares": 10.0, "current_price": 100.0},
    )
    assert res.status_code == 201, res.text
    assert picks_return_pct(db, portfolio) == 0.0  # $1,000 in, $1,000 held

    # Operator fixes a typo: it was 20 shares, not 10. Cash pays for the extra
    # 10 shares, so nothing has been *earned*.
    res = ops_client.patch(
        "/api/ops/positions/AAA", headers=OPS_HEADERS, json={"shares": 20.0}
    )
    assert res.status_code == 200, res.text

    r = picks_return(db, portfolio)
    assert r["deployed"] == 2000.0
    assert r["return_pct"] == 0.0  # today: +100.0


# ---------------------------------------------------------------------------
# BUG-A2 — closed-pick P&L uses the last buy, not the average cost
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-A2: /api/v1/picks?status=closed computes pnl_pct against the price "
        "of the single most recent buy before the exit, ignoring every earlier "
        "buy. A position built in two lots reports the wrong return, and the "
        "web app's closedWinRate() classifies win/loss off this field."
    ),
    strict=True,
)
def test_closed_pick_pnl_uses_the_average_cost_of_the_whole_position(db, portfolio):
    # Prevents: a genuine +25% winner being published as a -17% loser, which
    # also drags the published win rate down (or, with the signs reversed, up).
    t0 = datetime(2026, 1, 2, tzinfo=timezone.utc)
    _trade(db, portfolio, "AAA", "buy", 100.0, 10.0, "buy", when=t0)
    _trade(db, portfolio, "AAA", "buy", 100.0, 30.0, "double_buy", when=t0 + timedelta(days=30))
    _trade(
        db, portfolio, "AAA", "sell", 200.0, 25.0, "full_sell", when=t0 + timedelta(days=60)
    )

    closed = [p for p in get_picks("closed", db)["picks"] if p["status"] == "closed"]
    assert len(closed) == 1
    # 200 shares at an average cost of $20, exited at $25 => +25.0%.
    # Today it reports (25 - 30) / 30 = -16.67%.
    assert closed[0]["pnl_pct"] == 25.0


def test_closed_pick_win_rate_input_is_the_field_the_web_app_reads(db, portfolio):
    # Guard on the shape the site's closedWinRate() depends on: a closed pick
    # must carry a numeric pnl_pct or it silently drops out of the win rate.
    t0 = datetime(2026, 1, 2, tzinfo=timezone.utc)
    _trade(db, portfolio, "AAA", "buy", 10.0, 100.0, "buy", when=t0)
    _trade(db, portfolio, "AAA", "sell", 10.0, 150.0, "full_sell", when=t0 + timedelta(days=10))

    closed = [p for p in get_picks("closed", db)["picks"] if p["status"] == "closed"]
    assert closed[0]["pnl_pct"] == 50.0


# ---------------------------------------------------------------------------
# BUG-A3 — the picks chart's final point drops every closed pick
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-A3: picks_series() overwrites the last chart point with "
        "(market value of OPEN positions) / (capital deployed into ALL picks). "
        "Capital committed to closed picks stays in the denominator while its "
        "proceeds vanish from the numerator, so the chart's final point "
        "collapses and contradicts the headline sitting above it."
    ),
    strict=True,
)
def test_the_picks_chart_ends_where_the_headline_says_it_does(db, portfolio):
    # Prevents: a +15% headline plotted above a chart whose last point reads
    # -45%, purely because one pick was sold.
    d1, d2 = date(2026, 1, 2), date(2026, 1, 3)

    # Open pick: $1,000 in, now worth $1,100.
    make_position(
        db, portfolio, "OPN", shares=10.0, avg_cost=100.0, current_price=110.0,
        entry_date=d1,
    )
    _bar(db, "OPN", d1, 100.0)
    _bar(db, "OPN", d2, 110.0)
    _trade(db, portfolio, "OPN", "buy", 10.0, 100.0, "buy",
           when=datetime(2026, 1, 2, tzinfo=timezone.utc))

    # Closed pick: $1,000 in, sold for $1,200. No position row survives.
    _trade(db, portfolio, "CLS", "buy", 10.0, 100.0, "buy",
           when=datetime(2026, 1, 2, tzinfo=timezone.utc))
    _trade(db, portfolio, "CLS", "sell", 10.0, 120.0, "full_sell",
           when=datetime(2026, 1, 3, tzinfo=timezone.utc))
    _bar(db, "CLS", d1, 100.0)
    _bar(db, "CLS", d2, 120.0)

    headline = picks_return_pct(db, portfolio)
    # (1,200 realized + 1,100 open) / 2,000 deployed - 1 = +15%
    assert headline == 15.0

    rows = picks_series(db, portfolio_id=portfolio.id)
    assert rows
    assert rows[-1]["return_pct"] == headline  # today: -45.0


def test_the_picks_chart_shares_the_benchmark_denominator_before_the_anchor(db, portfolio):
    # The per-session loop itself is sound: same deployed-capital denominator
    # as the benchmark series. This pins that so a fix to BUG-A3 cannot quietly
    # change the rest of the curve.
    d1, d2 = date(2026, 1, 2), date(2026, 1, 3)
    make_position(
        db, portfolio, "OPN", shares=10.0, avg_cost=100.0, current_price=110.0,
        entry_date=d1,
    )
    _bar(db, "OPN", d1, 100.0)
    _bar(db, "OPN", d2, 110.0)

    rows = picks_series(db, portfolio_id=portfolio.id)
    assert rows[0]["return_pct"] == 0.0
    assert rows[-1]["return_pct"] == 10.0


# ---------------------------------------------------------------------------
# BUG-A4 — "unknown" P&L is published as 0%
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-A4: /api/v1/strategy builds pnl_pct as `_pnl_pct(...) or 0`. When "
        "the cost basis is unrecoverable _pnl_pct returns None and the `or` "
        "coerces it to 0, so an unknown return is published as a flat 0.00%."
    ),
    strict=True,
)
def test_unknown_holding_pnl_is_published_as_null_not_zero(db, portfolio):
    # Prevents: a position whose basis could not be rebuilt (the case
    # _recover_avg_cost_from_trades logs as "P&L will read as unavailable")
    # appearing on the public holdings table as a confident 0.00%.
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=0.0, current_price=150.0,
                  initial_investment=None)

    holding = get_strategy(db)["holdings"][0]
    assert holding["pnl_pct"] is None  # today: 0


@pytest.mark.xfail(
    reason=(
        "BUG-A4b: _pnl_pct() rejects a falsy `current`, so a holding marked to "
        "zero returns None, which the `or 0` in /api/v1/strategy then publishes "
        "as 0.00%. A total loss is published as flat."
    ),
    strict=True,
)
def test_a_holding_marked_to_zero_publishes_minus_one_hundred_not_zero(db, portfolio):
    # Prevents: a delisted/halted holding marked at $0 showing 0.00% on the
    # public holdings table instead of -100%.
    make_position(db, portfolio, "DEAD", shares=10.0, avg_cost=100.0, current_price=0.0)
    make_position(db, portfolio, "LIVE", shares=10.0, avg_cost=100.0, current_price=100.0)

    holdings = {h["ticker"]: h for h in get_strategy(db)["holdings"]}
    assert holdings["DEAD"]["pnl_pct"] == -100.0  # today: 0


def test_house_money_holdings_still_report_their_real_gain(db, portfolio):
    # Regression guard on the fixed house-money boundary: the DB keeps true
    # basis, so the biggest winners must not read 0%.
    make_position(
        db, portfolio, "WIN", shares=5.0, avg_cost=100.0, current_price=300.0,
        initial_investment=1000.0, is_house_money=True,
    )
    holding = get_strategy(db)["holdings"][0]
    assert holding["is_house_money"] is True
    assert holding["pnl_pct"] == 200.0


# ---------------------------------------------------------------------------
# BUG-A5 — the decision ledger records signals as executed that never executed
# ---------------------------------------------------------------------------


def test_a_trim_and_a_full_sell_on_one_ticker_write_exactly_one_trade(db, portfolio):
    # CLEAN check: evaluate() can emit both a weight TRIM and a FULL_SELL for
    # the same ticker. apply_signals orders FULL_SELL first and pops the
    # position, so the TRIM finds nothing and no second sell row is written.
    # Anything derived from trade counts stays correct.
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=200.0)
    signals = [
        Signal(action=Action.TRIM, ticker="AAA", reason="Trim: 40% -> 25%", sell_shares=4.0),
        Signal(action=Action.FULL_SELL, ticker="AAA", reason="Strong sell (QR 2.1)"),
    ]
    _ev, trades = _execute(db, portfolio, signals)

    assert len(trades) == 1
    assert trades[0].action == "full_sell"
    assert trades[0].shares == 10.0
    assert db.query(Position).filter(Position.ticker == "AAA").count() == 0


@pytest.mark.xfail(
    reason=(
        "BUG-A5: persist_evaluation() stamps every SignalRow with "
        "executed = (not dry_run) before apply_signals runs, so a signal that "
        "was skipped — the suppressed TRIM behind a FULL_SELL, a buy with no "
        "mark, a sell on a position that no longer exists — is recorded in the "
        "decision ledger as having been executed."
    ),
    strict=True,
)
def test_a_skipped_signal_is_not_recorded_as_executed(db, portfolio):
    # Prevents: the audit trail at /api/ops/evaluations/{id} claiming a trade
    # was made that never was — the ledger is the thing that makes a published
    # track record checkable.
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=200.0)
    signals = [
        Signal(action=Action.TRIM, ticker="AAA", reason="Trim: 40% -> 25%", sell_shares=4.0),
        Signal(action=Action.FULL_SELL, ticker="AAA", reason="Strong sell (QR 2.1)"),
    ]
    ev, _trades = _execute(db, portfolio, signals)

    rows = {
        r.action: r
        for r in db.query(SignalRow).filter(SignalRow.evaluation_id == ev.id).all()
    }
    assert rows["full_sell"].executed is True
    assert rows["trim"].executed is False  # today: True


@pytest.mark.xfail(
    reason=(
        "BUG-A5b: same root cause — a BUY with no usable mark is skipped by "
        "apply_signals but its SignalRow still reads executed=True."
    ),
    strict=True,
)
def test_an_unfillable_buy_is_not_recorded_as_executed(db, portfolio):
    # Prevents the ledger showing a purchase the book never made because no
    # price was available to fill it at.
    buy = Signal(
        action=Action.BUY, ticker="NOPRICE", reason="Buy",
        metadata={"target_notional": 5_000.0},
    )
    ev, trades = _execute(db, portfolio, [buy])

    assert trades == []
    row = db.query(SignalRow).filter(SignalRow.evaluation_id == ev.id).one()
    assert row.executed is False  # today: True


# ---------------------------------------------------------------------------
# BUG-A6 — /performance annualizes a different number than it publishes
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-A6: /api/v1/performance publishes summary.total_return_pct (the "
        "equity return) alongside summary.annualized_return_pct, which is "
        "derived from picks_return — a different base entirely. The two fields "
        "sit in one object and cannot both describe the same book, and nothing "
        "in the payload says which base was annualized."
    ),
    strict=True,
)
def test_the_annualized_figure_matches_the_return_published_beside_it(db, portfolio):
    # Prevents: a summary reading total_return_pct = -6.5 next to
    # annualized_return_pct = +109.6, with no field naming the base.
    today = date.today()
    inception = today - timedelta(days=200)
    portfolio.inception_date = inception
    portfolio.cash = 92_000.0
    db.commit()

    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=150.0)
    _trade(db, portfolio, "AAA", "buy", 10.0, 100.0, "buy")
    for i in range(0, 201, 5):
        _snapshot(db, portfolio, inception + timedelta(days=i), 100_000.0)

    summary = get_performance(db)["summary"]
    assert summary["annualized_status"] == "ok"

    days_live = summary["days_live"]
    published = summary["total_return_pct"]
    expected = round(((1 + published / 100) ** (365 / days_live) - 1) * 100, 2)
    assert summary["annualized_return_pct"] == expected


def test_the_two_return_bases_really_are_different_numbers(db, portfolio):
    # Documents WHY BUG-A6 matters: on a mostly-cash book the picks return and
    # the equity return are far apart, so publishing one and annualizing the
    # other is not a rounding difference.
    portfolio.cash = 92_000.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=150.0)
    _trade(db, portfolio, "AAA", "buy", 10.0, 100.0, "buy")
    _snapshot(db, portfolio, date(2026, 1, 2), 100_000.0)

    assert picks_return_pct(db, portfolio) == 50.0
    assert total_return_pct(db, portfolio) == -6.5


# ---------------------------------------------------------------------------
# BUG-A7 — a zero base is silently replaced with $1
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-A7: get_performance() uses `base = snaps[0].total_value or 1`. A "
        "first snapshot worth $0 becomes a $1 base, so every later point is "
        "published as a multi-million-percent return instead of being withheld."
    ),
    strict=True,
)
def test_a_zero_first_snapshot_withholds_the_series_rather_than_inventing_it(db, portfolio):
    # Prevents: the equity curve publishing +9,999,900% because the first
    # recorded day had no value to index off.
    _snapshot(db, portfolio, date(2026, 1, 2), 0.0)
    _snapshot(db, portfolio, date(2026, 1, 3), 100_000.0)

    series = get_performance(db)["series"]
    assert series[1]["return_pct"] is None  # today: 9999900.0


# ---------------------------------------------------------------------------
# Denominator characterisation: recycled capital
# ---------------------------------------------------------------------------


def test_picks_return_counts_recycled_dollars_twice_in_its_denominator(db, portfolio):
    # NOT an xfail — this pins the definition so it cannot drift silently, and
    # documents that `deployed` is GROSS capital deployed, not capital at risk.
    # The same $1,000 recycled into a second pick is counted as $2,200 of
    # deployment, which damps the published return toward zero as the book
    # turns over. The annualized figure inherits this.
    _trade(db, portfolio, "AAA", "buy", 10.0, 100.0, "buy")         # $1,000 in
    _trade(db, portfolio, "AAA", "sell", 10.0, 120.0, "full_sell")  # out at $1,200
    _trade(db, portfolio, "BBB", "buy", 10.0, 120.0, "buy")         # $1,200 recycled
    make_position(db, portfolio, "BBB", shares=10.0, avg_cost=120.0, current_price=130.0)

    r = picks_return(db, portfolio)
    assert r["deployed"] == 2200.0
    # The investor's $1,000 became $1,300 — a 30% gain. Published: 13.64%.
    assert r["return_pct"] == 13.64


def test_closed_count_is_distinct_tickers_not_closed_positions(db, portfolio):
    # Pins a documented weakness of the published `picks.closed_count`: it is
    # a set difference on ticker, so a name that was closed and later re-bought
    # is not counted as closed at all.
    _trade(db, portfolio, "AAA", "buy", 10.0, 100.0, "buy")
    _trade(db, portfolio, "AAA", "sell", 10.0, 150.0, "full_sell")
    _trade(db, portfolio, "AAA", "buy", 10.0, 150.0, "buy")
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=150.0, current_price=150.0)

    r = picks_return(db, portfolio)
    assert r["closed_count"] == 0
    assert r["open_count"] == 1


# ---------------------------------------------------------------------------
# CLEAN: cash, division guards, paywall
# ---------------------------------------------------------------------------


def test_cash_is_conserved_across_a_buy_and_a_sell(db, portfolio):
    # Prevents cash drift: every executed trade must move exactly its notional.
    db.add(Stock(ticker="AAA", last_price=100.0))
    db.commit()
    start_cash = portfolio.cash

    buy = Signal(
        action=Action.BUY, ticker="AAA", reason="Buy",
        metadata={"target_notional": 5_000.0},
    )
    _ev, trades = _execute(db, portfolio, [buy])
    assert portfolio.cash == pytest.approx(start_cash - trades[0].notional)

    sell = Signal(action=Action.FULL_SELL, ticker="AAA", reason="Sell")
    _ev2, trades2 = _execute(db, portfolio, [sell])
    assert portfolio.cash == pytest.approx(
        start_cash + trades2[0].notional - trades[0].notional
    )
    assert portfolio.cash == pytest.approx(start_cash)  # flat mark, no P&L


def test_a_buy_can_never_overdraw_cash(db, portfolio):
    # Prevents a negative cash balance leaking into equity and the total return.
    portfolio.cash = 500.0
    db.add(Stock(ticker="AAA", last_price=100.0))
    db.commit()

    buy = Signal(
        action=Action.BUY, ticker="AAA", reason="Buy",
        metadata={"target_notional": 5_000.0},
    )
    _execute(db, portfolio, [buy])
    assert portfolio.cash == pytest.approx(0.0)


def test_a_partial_sell_keeps_the_cost_basis_and_the_share_count_consistent(db, portfolio):
    # House-money boundary: a Winners Circle partial sell must reduce shares,
    # flag house money, and leave avg_cost / initial_investment intact — those
    # are what the public P&L is computed from.
    make_position(
        db, portfolio, "WIN", shares=10.0, avg_cost=100.0, current_price=300.0,
        initial_investment=1000.0,
    )
    start_cash = portfolio.cash
    sig = Signal(
        action=Action.PARTIAL_SELL, ticker="WIN",
        reason="Winners Circle: recover stake", sell_shares=1000.0 / 300.0,
        keep_shares=10.0 - 1000.0 / 300.0,
    )
    _ev, trades = _execute(db, portfolio, [sig])

    pos = db.query(Position).filter(Position.ticker == "WIN").one()
    assert pos.is_house_money is True
    assert pos.avg_cost == 100.0
    assert pos.initial_investment == 1000.0
    assert pos.shares == pytest.approx(10.0 - 1000.0 / 300.0)
    assert portfolio.cash == pytest.approx(start_cash + 1000.0)
    assert trades[0].notional == pytest.approx(1000.0)


def test_the_strategy_boundary_zeroes_basis_only_for_house_money(db, portfolio):
    # The _position_to_state boundary is the repeated source of house-money
    # bugs. A normal position must reach the engine with its real basis; a
    # house-money one must reach it with the <= 0 sentinel it expects.
    make_position(
        db, portfolio, "WIN", shares=5.0, avg_cost=100.0, current_price=300.0,
        initial_investment=1000.0, is_house_money=True,
    )
    make_position(
        db, portfolio, "NEW", shares=5.0, avg_cost=100.0, current_price=110.0,
        initial_investment=500.0,
    )
    state = load_portfolio_state(db, portfolio)

    assert state.positions["WIN"].is_house_money is True
    assert state.positions["WIN"].avg_cost == 0.0
    assert state.positions["NEW"].is_house_money is False
    assert state.positions["NEW"].avg_cost == 100.0
    # And the boundary must not corrupt what reporting reads back off the DB.
    assert db.query(Position).filter(Position.ticker == "WIN").one().avg_cost == 100.0


def test_zero_equity_does_not_divide_by_zero_in_weights(db, portfolio):
    # Prevents a 500 on /api/v1/strategy when the book is worth nothing.
    portfolio.cash = 0.0
    db.commit()
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=0.0)

    payload = get_strategy(db)
    assert payload["holdings"][0]["weight_pct"] == 0


def test_an_empty_book_publishes_null_not_zero_percent(db, portfolio):
    # An unknown return must never render as 0% — that is a claim.
    payload = get_strategy(db)
    assert payload["portfolio"]["picks_return_pct"] is None
    assert payload["portfolio"]["picks"]["return_pct"] is None


def test_a_flat_book_publishes_a_real_zero(db, portfolio):
    # The other half of the same rule: a genuine 0.0% must survive, not be
    # coerced into "unknown" by a truthiness test.
    _snapshot(db, portfolio, date(2026, 1, 2), 100_000.0)
    _trade(db, portfolio, "AAA", "buy", 10.0, 100.0, "buy")
    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=100.0)
    portfolio.cash = 99_000.0
    db.commit()

    payload = get_strategy(db)
    assert payload["portfolio"]["picks_return_pct"] == 0.0
    assert payload["portfolio"]["total_return_pct"] == 0.0


def test_public_strategy_never_ships_the_model(db, portfolio):
    # Paywall: to_dict() carries the factor weights and every rating threshold.
    # Only PUBLIC_FIELDS may cross the wire on /api/v1/strategy.
    import json

    payload = get_strategy(db)
    assert set(payload["params"]) == set(StrategyParams.PUBLIC_FIELDS)

    private = set(StrategyParams().to_dict()) - set(StrategyParams.PUBLIC_FIELDS)
    assert private, "expected some params to be private"
    blob = json.dumps(payload)
    for field in private:
        assert f'"{field}"' not in blob, f"{field} leaked on /api/v1/strategy"


def test_public_strategy_ships_no_model_even_with_a_custom_params_json(db, portfolio):
    # params_from_portfolio() rebuilds StrategyParams from the stored JSON; the
    # public projection must still apply.
    portfolio.params_json = StrategyParams().to_dict()
    db.commit()
    payload = get_strategy(db)
    assert set(payload["params"]) == set(StrategyParams.PUBLIC_FIELDS)


def test_public_routes_publish_no_signal_rules(db, portfolio):
    # The rule ledger (thresholds, inputs) is the model. It lives only behind
    # the ops key.
    import json

    make_position(db, portfolio, "AAA", shares=10.0, avg_cost=100.0, current_price=150.0)
    for payload in (get_strategy(db), get_picks("all", db), get_performance(db)):
        blob = json.dumps(payload)
        assert '"rules"' not in blob
        assert '"threshold"' not in blob


# ---------------------------------------------------------------------------
# CLEAN: idempotency and transaction boundary
# ---------------------------------------------------------------------------


def _scored_universe(db):
    for ticker in ("AAA", "BBB"):
        db.add(Stock(ticker=ticker, last_price=100.0, sector="Technology"))
        db.add(
            CompositeScore(
                ticker=ticker,
                as_of=date.today(),
                quant_rating=4.9,
                composite=95.0,
                valuation_grade="A",
                growth_grade="A",
                profitability_grade="A",
                momentum_grade="A",
                revisions_grade="A",
                sector="Technology",
            )
        )
    db.commit()


@pytest.mark.xfail(
    reason=(
        "BUG-A8: run_evaluation() is not idempotent. Nothing records that an "
        "executed evaluation already happened for this cycle, so a second run "
        "on the same day performs ANOTHER round of buys — defeating "
        "max_adds_per_evaluation=1, which is itself a PUBLISHED parameter "
        "(StrategyParams.PUBLIC_FIELDS) and therefore a claim about how fast "
        "the book deploys capital. Neither POST /api/ops/evaluate?dry_run=false "
        "nor job_biweekly_evaluate guards against a retry or a double click."
    ),
    strict=True,
)
def test_re_running_an_evaluation_the_same_day_does_not_re_trade(db, portfolio):
    # Prevents double-buying — and so inflating `deployed` — when the scheduler
    # retries, a redeploy replays the job, or an operator presses the ops
    # evaluate button twice. job_biweekly_evaluate has no "already ran today"
    # guard, so convergence is the only thing protecting the book, and for buys
    # it does not converge: the second run simply buys the next-ranked name.
    _scored_universe(db)

    run_evaluation(db, portfolio_id=portfolio.id, mode="biweekly", dry_run=False)
    first_cash = portfolio.cash
    first_positions = {
        p.ticker: p.shares
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    }
    first_trades = db.query(Trade).count()
    assert first_trades > 0, "the fixture must actually trade for this to mean anything"

    run_evaluation(db, portfolio_id=portfolio.id, mode="biweekly", dry_run=False)
    second_positions = {
        p.ticker: p.shares
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    }
    assert second_positions == first_positions
    assert portfolio.cash == pytest.approx(first_cash)
    assert db.query(Trade).count() == first_trades


def test_a_dry_run_writes_a_ledger_row_but_never_a_trade(db, portfolio):
    # Prevents a preview from moving money.
    _scored_universe(db)
    start_cash = portfolio.cash

    ev = run_evaluation(db, portfolio_id=portfolio.id, mode="biweekly", dry_run=True)

    assert ev.mode == "dry_run"
    assert ev.executed is False
    assert db.query(Trade).count() == 0
    assert db.query(Position).count() == 0
    assert portfolio.cash == start_cash


def test_a_failed_evaluation_leaves_no_partial_book(db, portfolio, monkeypatch):
    # Transaction boundary: run_evaluation commits once at the end, so a crash
    # mid-execution must not leave trades without their ledger, or cash moved
    # without positions.
    _scored_universe(db)
    import app.services.portfolio as pf

    real_apply = pf.apply_signals

    def _explode(db_, portfolio_, signals, evaluation):
        real_apply(db_, portfolio_, signals, evaluation)
        raise RuntimeError("process died mid-evaluation")

    monkeypatch.setattr(pf, "apply_signals", _explode)
    with pytest.raises(RuntimeError):
        pf.run_evaluation(db, portfolio_id=portfolio.id, mode="biweekly", dry_run=False)
    db.rollback()

    assert db.query(Trade).count() == 0
    assert db.query(Position).count() == 0
    assert db.query(SignalRow).count() == 0
    assert portfolio.cash == 100_000.0
