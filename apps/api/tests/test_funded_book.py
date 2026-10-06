"""run119: a pick is always funded, and the money put in is never a return.

The live book deposits the shortfall when a buy costs more than the cash on
hand (`apply_signals(fund_shortfall=True)`), records it as a
`PortfolioContribution`, and every return figure counts it as capital.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.db.models import CompositeScore, PortfolioContribution, PortfolioSnapshot, Position
from app.services.period_returns import book_period_returns
from app.services.portfolio import (
    apply_signals,
    contributed_capital,
    last_scored_dates,
    load_portfolio_state,
    persist_evaluation,
    total_return_pct,
)
from app.services.replay import ReplayBook, ReplayPosition, _equity_curve
from conftest import make_position
from outpick_strategy import RUN118_PARAMS, Action, Signal


def _buy(ticker: str, target: float) -> Signal:
    return Signal(
        action=Action.BUY,
        ticker=ticker,
        reason="Top pick",
        metadata={"target_notional": target},
    )


def _snapshot(db, portfolio, day: date, total: float, cash: float | None = None):
    db.add(
        PortfolioSnapshot(
            portfolio_id=portfolio.id,
            date=day,
            cash=total if cash is None else cash,
            invested_value=0.0 if cash is None else total - cash,
            total_value=total,
            position_count=0,
        )
    )
    db.commit()


def test_live_buy_is_funded_at_full_size_and_the_deposit_is_recorded(db, portfolio):
    portfolio.cash = 250.0
    make_position(db, portfolio, "HELD", shares=10, avg_cost=100.0, current_price=100.0)
    from app.db.models import Stock

    db.add(Stock(ticker="NEW", last_price=50.0, is_etf=False, is_active=True))
    db.commit()
    state = load_portfolio_state(db, portfolio)
    sig = _buy("NEW", 1_000.0)
    ev = persist_evaluation(db, portfolio, "biweekly", RUN118_PARAMS, state, [sig], executed=True)

    trades = apply_signals(db, portfolio, [sig], ev, as_of=date(2026, 9, 18), fund_shortfall=True)
    db.commit()

    assert len(trades) == 1
    assert trades[0].notional == pytest.approx(1_000.0)
    assert trades[0].shares == pytest.approx(20.0)
    assert portfolio.cash == pytest.approx(0.0)
    rows = db.query(PortfolioContribution).filter(PortfolioContribution.portfolio_id == portfolio.id).all()
    assert [(r.date, r.amount) for r in rows] == [(date(2026, 9, 18), pytest.approx(750.0))]
    assert contributed_capital(db, portfolio) == pytest.approx(750.0)


def test_two_funded_buys_on_one_day_share_a_contribution_row(db, portfolio):
    portfolio.cash = 0.0
    from app.db.models import Stock

    db.add(Stock(ticker="A", last_price=10.0, is_etf=False, is_active=True))
    db.add(Stock(ticker="B", last_price=20.0, is_etf=False, is_active=True))
    db.commit()
    state = load_portfolio_state(db, portfolio)
    sigs = [_buy("A", 1_000.0), _buy("B", 1_000.0)]
    ev = persist_evaluation(db, portfolio, "biweekly", RUN118_PARAMS, state, sigs, executed=True)
    apply_signals(db, portfolio, sigs, ev, as_of=date(2026, 9, 18), fund_shortfall=True)
    db.commit()
    rows = db.query(PortfolioContribution).all()
    assert len(rows) == 1
    assert rows[0].amount == pytest.approx(2_000.0)
    assert portfolio.cash == pytest.approx(0.0)


def test_without_the_flag_a_buy_is_still_clamped_to_cash(db, portfolio):
    """The DCA sample books keep the old behaviour: sized to their deposit."""
    portfolio.cash = 250.0
    from app.db.models import Stock

    db.add(Stock(ticker="NEW", last_price=50.0, is_etf=False, is_active=True))
    db.commit()
    state = load_portfolio_state(db, portfolio)
    sig = _buy("NEW", 1_000.0)
    ev = persist_evaluation(db, portfolio, "biweekly", RUN118_PARAMS, state, [sig], executed=True)
    trades = apply_signals(db, portfolio, [sig], ev, as_of=date(2026, 9, 18))
    assert trades[0].notional == pytest.approx(250.0)
    assert db.query(PortfolioContribution).count() == 0


def test_total_return_counts_deposits_as_capital_not_gain(db, portfolio):
    _snapshot(db, portfolio, date(2026, 1, 2), 100_000.0)
    db.add(PortfolioContribution(portfolio_id=portfolio.id, date=date(2026, 2, 1), amount=25_000.0))
    portfolio.cash = 125_000.0
    db.commit()
    # Equity equals capital put in: the book has made nothing.
    assert total_return_pct(db, portfolio) == pytest.approx(0.0)
    portfolio.cash = 137_500.0
    db.commit()
    assert total_return_pct(db, portfolio) == pytest.approx(10.0)


def test_period_return_backs_out_a_deposit_inside_the_period(db, portfolio):
    today = date.today()
    _snapshot(db, portfolio, today - timedelta(days=1), 10_000.0)
    _snapshot(db, portfolio, today, 11_000.0)
    db.add(PortfolioContribution(portfolio_id=portfolio.id, date=today, amount=1_000.0))
    db.commit()
    _anchors, book = book_period_returns(db, portfolio.id)
    assert book["day"]["book_return_pct"] == pytest.approx(0.0)


def test_portfolio_state_carries_the_last_score_date(db, portfolio):
    make_position(db, portfolio, "OLD", shares=1, avg_cost=1.0, current_price=1.0)
    make_position(db, portfolio, "NEVER", shares=1, avg_cost=1.0, current_price=1.0)
    for d in (date(2026, 9, 1), date(2026, 9, 8)):
        db.add(CompositeScore(ticker="OLD", as_of=d, quant_rating=3.0, composite=50.0,
                              valuation_grade="B", growth_grade="B", profitability_grade="B",
                              momentum_grade="B", revisions_grade="B", sector="Technology"))
    db.commit()
    assert last_scored_dates(db, ["OLD", "NEVER"]) == {"OLD": date(2026, 9, 8)}
    assert last_scored_dates(db, ["OLD"], as_of=date(2026, 9, 5)) == {"OLD": date(2026, 9, 1)}
    state = load_portfolio_state(db, portfolio)
    assert state.positions["OLD"].last_scored == date(2026, 9, 8)
    assert state.positions["NEVER"].last_scored is None


def test_replay_equity_curve_nets_out_a_funded_buy():
    """A funded buy raises cash and holdings together; net equity is flat."""
    from app.services.replay import ReplayEvaluation, ReplayTrade

    class _Prices:
        def trading_dates(self):
            return [date(2026, 9, 18)]

        def close(self, ticker, d):
            return 50.0

    book = ReplayBook(cash=0.0)
    before = {"cash": 100.0, "invested": 0.0, "equity": 100.0, "contributed": 0.0,
              "position_count": 0, "positions": {}}
    trade = ReplayTrade(date(2026, 9, 18), date(2026, 9, 18), "NEW", "buy", "buy",
                        20.0, 50.0, 1_000.0, "Top pick", funded=900.0)
    ev = ReplayEvaluation(as_of=date(2026, 9, 18), fill_date=date(2026, 9, 18), signals=[],
                          trades=[trade], skipped=[], before=before, after=before)
    curve = _equity_curve(book, [ev], _Prices(), date(2026, 9, 18), date(2026, 9, 18))
    assert curve[0]["equity"] == pytest.approx(1_000.0)
    assert curve[0]["contributed"] == pytest.approx(900.0)
    assert curve[0]["net_equity"] == pytest.approx(100.0)
