"""Weekly $1,000 DCA sample books."""

from __future__ import annotations

from datetime import date

from app.db.models import (
    CompositeScore,
    PortfolioContribution,
    Position,
    PriceBar,
    Trade,
)
from app.services.dca import (
    DCA_VOO_TICKER,
    DCA_WEEKLY_AMOUNT,
    KIND_DCA_PICKS,
    KIND_DCA_VOO,
    buy_universe,
    dca_sessions_between,
    ensure_dca_portfolios,
    portfolio_by_kind,
    run_dca_friday,
    session_for_friday,
)
from worker.services.market_calendar import last_trading_day_on_or_before


def _score(db, ticker: str, as_of: date, qr: float, sector: str = "Technology"):
    db.add(
        CompositeScore(
            ticker=ticker,
            as_of=as_of,
            quant_rating=qr,
            valuation_grade="B",
            growth_grade="B",
            profitability_grade="B",
            momentum_grade="B",
            revisions_grade="B+",
            sector=sector,
        )
    )


def _bar(db, ticker: str, as_of: date, close: float):
    db.add(PriceBar(ticker=ticker, date=as_of, close=close))


def _seed_session(db, as_of: date, *, names: dict[str, tuple[float, float]]):
    """names: ticker -> (quant_rating, close). Always include VOO."""
    _bar(db, DCA_VOO_TICKER, as_of, 500.0)
    _bar(db, "SPY", as_of, 500.0)
    for ticker, (qr, close) in names.items():
        _score(db, ticker, as_of, qr)
        _bar(db, ticker, as_of, close)
    db.commit()


def test_holiday_friday_uses_the_prior_session():
    """3 Apr 2026 is Good Friday; the weekly pass lands on Thursday."""
    friday = date(2026, 4, 3)
    assert friday.weekday() == 4
    session = session_for_friday(friday)
    assert session == date(2026, 4, 2)
    assert session == last_trading_day_on_or_before(friday)


def test_sessions_between_includes_the_holiday_week():
    sessions = dca_sessions_between(date(2026, 4, 1), date(2026, 4, 10))
    assert date(2026, 4, 2) in sessions
    assert date(2026, 4, 10) in sessions
    assert date(2026, 4, 3) not in sessions


def test_buy_universe_is_the_badge_not_the_evaluate_gate(db):
    """QR 3.5 is BUY; evaluate() would still reject it (min 4.0)."""
    day = date(2026, 4, 10)
    _score(db, "WEAK", day, 3.5)
    _score(db, "STRONG", day, 4.6)
    _score(db, "HOLD", day, 3.0)
    db.commit()
    assert buy_universe(db, day) == ["STRONG", "WEAK"]


def test_equal_weight_buys_every_buy_name(db):
    day = date(2026, 4, 10)
    _seed_session(db, day, names={"AAA": (4.5, 10.0), "BBB": (3.6, 20.0)})
    run_dca_friday(db, day)

    picks = portfolio_by_kind(db, KIND_DCA_PICKS)
    held = {p.ticker: p for p in db.query(Position).filter(Position.portfolio_id == picks.id)}
    assert set(held) == {"AAA", "BBB"}
    # $1,000 split equally, $500 each.
    assert abs(held["AAA"].shares * 10.0 - 500.0) < 1e-6
    assert abs(held["BBB"].shares * 20.0 - 500.0) < 1e-6
    assert picks.cash == 0.0

    voo = portfolio_by_kind(db, KIND_DCA_VOO)
    voo_pos = db.query(Position).filter(Position.portfolio_id == voo.id).one()
    assert voo_pos.ticker == "VOO"
    assert abs(voo_pos.shares * 500.0 - DCA_WEEKLY_AMOUNT) < 1e-6


def test_missing_price_is_redistributed(db):
    day = date(2026, 4, 10)
    _score(db, "AAA", day, 4.5)
    _score(db, "GHOST", day, 4.8)
    _bar(db, "AAA", day, 10.0)
    _bar(db, DCA_VOO_TICKER, day, 500.0)
    db.commit()
    run_dca_friday(db, day)

    picks = portfolio_by_kind(db, KIND_DCA_PICKS)
    held = db.query(Position).filter(Position.portfolio_id == picks.id).all()
    assert [p.ticker for p in held] == ["AAA"]
    assert abs(held[0].shares * 10.0 - DCA_WEEKLY_AMOUNT) < 1e-6


def test_hold_removal_sells_then_cash_redeploys(db):
    week1 = date(2026, 4, 10)
    week2 = date(2026, 4, 17)
    _seed_session(db, week1, names={"AAA": (4.5, 10.0)})
    run_dca_friday(db, week1)

    # AAA collapses below hold; BBB is the new BUY list.
    _seed_session(db, week2, names={"AAA": (2.0, 8.0), "BBB": (4.4, 25.0)})
    run_dca_friday(db, week2)

    picks = portfolio_by_kind(db, KIND_DCA_PICKS)
    held = {p.ticker: p for p in db.query(Position).filter(Position.portfolio_id == picks.id)}
    assert "AAA" not in held
    assert "BBB" in held

    sells = (
        db.query(Trade)
        .filter(Trade.portfolio_id == picks.id, Trade.side == "sell")
        .all()
    )
    assert len(sells) == 1
    assert sells[0].ticker == "AAA"
    # Original $1,000 bought 100 AAA @ $10; sold at $8 → $800, plus $1,000
    # new deposit, all into BBB.
    assert abs(held["BBB"].shares * 25.0 - 1800.0) < 1e-6

    voo = portfolio_by_kind(db, KIND_DCA_VOO)
    voo_pos = db.query(Position).filter(Position.portfolio_id == voo.id).one()
    assert voo_pos.ticker == "VOO"
    assert db.query(Trade).filter(Trade.portfolio_id == voo.id, Trade.side == "sell").count() == 0


def test_second_run_on_the_same_friday_is_a_noop(db):
    day = date(2026, 4, 10)
    _seed_session(db, day, names={"AAA": (4.5, 10.0)})
    first = run_dca_friday(db, day)
    second = run_dca_friday(db, day)

    assert first["voo"].get("skipped") is None
    assert second["voo"]["skipped"] == "already_ran"
    assert second["picks"]["skipped"] == "already_ran"

    picks = portfolio_by_kind(db, KIND_DCA_PICKS)
    assert (
        db.query(PortfolioContribution)
        .filter(PortfolioContribution.portfolio_id == picks.id)
        .count()
        == 1
    )
    assert db.query(Trade).filter(Trade.portfolio_id == picks.id, Trade.side == "buy").count() == 1


def test_holiday_week_deposits_on_thursday(db):
    session = date(2026, 4, 2)
    _seed_session(db, session, names={"AAA": (4.5, 10.0)})
    run_dca_friday(db, session)
    voo = portfolio_by_kind(db, KIND_DCA_VOO)
    row = (
        db.query(PortfolioContribution)
        .filter(PortfolioContribution.portfolio_id == voo.id)
        .one()
    )
    assert row.date == session


def test_ensure_dca_portfolios_is_idempotent(db):
    a, b = ensure_dca_portfolios(db)
    c, d = ensure_dca_portfolios(db)
    assert a.id == c.id and b.id == d.id
    assert a.kind == KIND_DCA_VOO
    assert b.kind == KIND_DCA_PICKS


def test_performance_payload_is_wealth_not_return_on_seed(db):
    from app.services.dca import dca_performance_payload

    day = date(2026, 4, 10)
    _seed_session(db, day, names={"AAA": (4.5, 10.0)})
    run_dca_friday(db, day)
    payload = dca_performance_payload(db)
    assert payload["contributed"] == DCA_WEEKLY_AMOUNT
    assert payload["weeks"] == 1
    assert payload["voo"]["value"] == DCA_WEEKLY_AMOUNT
    assert payload["picks"]["value"] == DCA_WEEKLY_AMOUNT
    assert payload["delta"]["dollars"] == 0
    assert payload["series"][0]["contributed"] == DCA_WEEKLY_AMOUNT
