"""The headline return number is the public performance claim. Pin it down."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.db.models import PortfolioSnapshot, Position
from app.services.portfolio import (
    apply_signals,
    initial_capital,
    load_portfolio_state,
    persist_evaluation,
    portfolio_equity,
    total_return_pct,
)
from conftest import make_position
from outpick_strategy import RUN118_PARAMS, Action, Signal


def _snapshot(db, portfolio, day: date, total: float):
    db.add(
        PortfolioSnapshot(
            portfolio_id=portfolio.id,
            date=day,
            cash=total,
            invested_value=0.0,
            total_value=total,
            position_count=0,
        )
    )
    db.commit()


def test_return_is_equity_over_initial_capital(db, portfolio):
    _snapshot(db, portfolio, date(2026, 1, 2), 100_000.0)
    portfolio.cash = 40_000.0
    make_position(db, portfolio, "AAA", shares=100, avg_cost=500.0, current_price=700.0)

    cash, invested, equity = portfolio_equity(db, portfolio)
    assert (cash, invested, equity) == (40_000.0, 70_000.0, 110_000.0)
    assert initial_capital(db, portfolio) == 100_000.0
    assert total_return_pct(db, portfolio) == pytest.approx(10.0)


def test_return_counts_cash_and_realized_pnl(db, portfolio):
    """A fully-sold winner shows up in the return even with no open positions.

    The old cost-basis formula could not see this at all: with no positions the
    denominator was 0 and it reported None.
    """
    _snapshot(db, portfolio, date(2026, 1, 2), 100_000.0)
    portfolio.cash = 125_000.0
    db.commit()

    assert total_return_pct(db, portfolio) == pytest.approx(25.0)


def test_house_money_position_does_not_inflate_the_return(db, portfolio):
    """Regression for the unbounded headline return.

    A Winners Circle partial sell used to set avg_cost = 0, so the position
    contributed full market value to the numerator and nothing to the
    denominator of `value / cost - 1`.
    """
    _snapshot(db, portfolio, date(2026, 1, 2), 100_000.0)
    portfolio.cash = 60_000.0
    make_position(
        db,
        portfolio,
        "WIN",
        shares=50,
        avg_cost=200.0,
        current_price=1_000.0,
        is_house_money=True,
    )

    positions = db.query(Position).all()
    old_cost = sum(p.avg_cost * p.shares for p in positions)
    old_value = sum(p.market_value for p in positions)

    # Truth: 60k cash + 50k holdings = 110k on 100k of capital.
    assert total_return_pct(db, portfolio) == pytest.approx(10.0)

    # And the old formula, for contrast, is nowhere near that.
    assert round((old_value / old_cost - 1) * 100, 2) == pytest.approx(400.0)


def test_return_is_none_without_a_capital_base(db, portfolio, monkeypatch):
    import app.config as config

    monkeypatch.setattr(config, "get_settings", lambda: type("S", (), {"initial_cash": 0})())
    assert initial_capital(db, portfolio) is None
    assert total_return_pct(db, portfolio) is None


def test_initial_capital_prefers_first_snapshot_over_seed_cash(db, portfolio):
    """So the headline agrees with the last point of the /performance chart."""
    _snapshot(db, portfolio, date(2026, 3, 1), 250_000.0)
    _snapshot(db, portfolio, date(2026, 3, 2), 260_000.0)
    portfolio.cash = 275_000.0
    db.commit()

    assert initial_capital(db, portfolio) == 250_000.0
    assert total_return_pct(db, portfolio) == pytest.approx(10.0)


# ---------------------------------------------------------------------------
# Winners Circle bookkeeping
# ---------------------------------------------------------------------------


def test_partial_sell_flags_house_money_and_keeps_cost_basis(db, portfolio):
    portfolio.cash = 0.0
    make_position(
        db, portfolio, "WIN", shares=100, avg_cost=100.0, current_price=250.0
    )
    state = load_portfolio_state(db, portfolio)
    signal = Signal(
        action=Action.PARTIAL_SELL,
        ticker="WIN",
        reason="Winner partial sell",
        sell_shares=40.0,
        keep_shares=60.0,
    )
    ev = persist_evaluation(
        db, portfolio, "biweekly", RUN118_PARAMS, state, [signal], executed=True
    )
    apply_signals(db, portfolio, [signal], ev)
    db.commit()

    pos = db.query(Position).filter(Position.ticker == "WIN").one()
    assert pos.is_house_money is True
    assert pos.avg_cost == 100.0, "cost basis must survive the partial sell"
    assert pos.initial_investment == 10_000.0
    assert pos.shares == pytest.approx(60.0)
    assert portfolio.cash == pytest.approx(10_000.0)

    # The public per-holding P&L is now real instead of a flat 0%.
    assert round((pos.current_price / pos.avg_cost - 1) * 100, 2) == 150.0


def test_strategy_still_sees_house_money_at_the_boundary(db, portfolio):
    """packages/strategy keeps its `initial_investment <= 0` contract."""
    make_position(
        db,
        portfolio,
        "WIN",
        shares=60,
        avg_cost=100.0,
        current_price=250.0,
        is_house_money=True,
    )
    make_position(
        db, portfolio, "NORM", shares=10, avg_cost=50.0, current_price=60.0
    )

    state = load_portfolio_state(db, portfolio)
    assert state.positions["WIN"].is_house_money is True
    assert state.positions["WIN"].initial_investment == 0.0
    # avg_cost is zeroed at the boundary too, so gain_pct matches the behaviour
    # the strategy was backtested with.
    assert state.positions["WIN"].gain_pct == 0.0
    assert state.positions["NORM"].is_house_money is False
    assert state.positions["NORM"].gain_pct == pytest.approx(0.2)


def test_double_buy_clears_house_money(db, portfolio):
    from app.db.models import Stock

    portfolio.cash = 50_000.0
    db.add(Stock(ticker="WIN", last_price=250.0))
    make_position(
        db,
        portfolio,
        "WIN",
        shares=60,
        avg_cost=100.0,
        current_price=250.0,
        is_house_money=True,
    )
    state = load_portfolio_state(db, portfolio)
    signal = Signal(
        action=Action.DOUBLE_BUY,
        ticker="WIN",
        reason="Conviction add",
        metadata={"target_notional": 5_000.0},
    )
    ev = persist_evaluation(
        db, portfolio, "biweekly", RUN118_PARAMS, state, [signal], executed=True
    )
    apply_signals(db, portfolio, [signal], ev)
    db.commit()

    pos = db.query(Position).filter(Position.ticker == "WIN").one()
    assert pos.is_house_money is False
    assert pos.initial_investment == pytest.approx(11_000.0)


# ---------------------------------------------------------------------------
# Legacy data migration
# ---------------------------------------------------------------------------


def test_ensure_schema_backfills_house_money_and_rebuilds_cost_basis(db, portfolio):
    """Rows written by the old code have avg_cost = 0; recover from trades."""
    from app.db.models import Trade
    from app.services.portfolio import ensure_schema

    db.add(
        Position(
            portfolio_id=portfolio.id,
            ticker="OLD",
            shares=60.0,
            avg_cost=0.0,
            current_price=250.0,
            initial_investment=0.0,
        )
    )
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="OLD",
            side="buy",
            shares=100.0,
            price=100.0,
            notional=10_000.0,
            action="buy",
        )
    )
    db.commit()

    ensure_schema(db, force=True)
    db.expire_all()

    pos = db.query(Position).filter(Position.ticker == "OLD").one()
    assert pos.is_house_money is True
    assert pos.avg_cost == pytest.approx(100.0)


def test_ensure_schema_is_idempotent(db, portfolio):
    from app.services.portfolio import ensure_schema

    ensure_schema(db, force=True)
    ensure_schema(db, force=True)
    ensure_schema(db, force=True)


# ---------------------------------------------------------------------------
# Picks return: the research product's headline number
# ---------------------------------------------------------------------------


def _buy(db, portfolio, ticker, shares, price, action="manual_buy"):
    from app.db.models import Trade

    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="buy",
            shares=shares,
            price=price,
            notional=shares * price,
            action=action,
        )
    )
    db.commit()


def _sell(db, portfolio, ticker, shares, price, action="full_sell"):
    from app.db.models import Trade

    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="sell",
            shares=shares,
            price=price,
            notional=shares * price,
            action=action,
        )
    )
    db.commit()


def test_picks_return_ignores_idle_cash(db, portfolio):
    """The whole point: cash drag must not touch the picks number."""
    from app.services.portfolio import picks_return_pct, total_return_pct

    portfolio.cash = 92_000.0
    _buy(db, portfolio, "AAA", 10.0, 100.0)  # $1,000 deployed
    make_position(db, portfolio, "AAA", 10.0, 100.0, 150.0)  # now worth $1,500

    # Picks: 1500/1000 - 1 = +50%
    assert picks_return_pct(db, portfolio) == 50.0
    # Book: (92,000 + 1,500) / 100,000 - 1 = -6.5% — a very different claim.
    assert total_return_pct(db, portfolio) == -6.5


def test_picks_return_includes_closed_losers(db, portfolio):
    """Survivorship bias check: a sold loser must stay in the record."""
    from app.services.portfolio import picks_return

    _buy(db, portfolio, "WIN", 10.0, 100.0)
    make_position(db, portfolio, "WIN", 10.0, 100.0, 200.0)  # +$1,000 open

    _buy(db, portfolio, "LOSS", 10.0, 100.0)
    _sell(db, portfolio, "LOSS", 10.0, 50.0)  # closed at -50%

    r = picks_return(db, portfolio)
    # deployed 2,000; open 2,000 + realized 500 = 2,500 -> +25%
    assert r["return_pct"] == 25.0
    assert r["closed_count"] == 1
    assert r["open_count"] == 1


def test_manual_removal_is_backed_out_not_counted_as_a_trade(db, portfolio):
    """Admin corrections aren't investment outcomes."""
    from app.services.portfolio import picks_return_pct

    _buy(db, portfolio, "GOOD", 10.0, 100.0)
    make_position(db, portfolio, "GOOD", 10.0, 100.0, 200.0)

    # A mistyped entry, added then removed at cost.
    _buy(db, portfolio, "OOPS", 10.0, 100.0)
    _sell(db, portfolio, "OOPS", 10.0, 100.0, action="manual_remove")

    # Only GOOD counts: 2,000/1,000 - 1 = +100%. Were the correction treated
    # as a flat trade it would halve to +50%.
    assert picks_return_pct(db, portfolio) == 100.0


def test_picks_return_is_none_before_any_capital_is_deployed(db, portfolio):
    from app.services.portfolio import picks_return

    assert picks_return(db, portfolio)["return_pct"] is None
