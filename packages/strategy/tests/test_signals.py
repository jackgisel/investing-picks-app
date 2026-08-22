"""Fixture tests for Run 118 evaluate() behavior."""

from datetime import date, timedelta

from outpick_strategy import (
    Action,
    PortfolioState,
    PositionState,
    RUN118_PARAMS,
    ScoreSnapshot,
    evaluate,
    evaluate_dca_sells,
    evaluate_sells_only,
)


def _score(
    ticker: str,
    qr: float,
    sector: str = "Technology",
    **grades,
) -> ScoreSnapshot:
    defaults = {
        "valuation_grade": "B",
        "growth_grade": "B",
        "profitability_grade": "B",
        "momentum_grade": "B",
        "revisions_grade": "B+",
    }
    defaults.update(grades)
    return ScoreSnapshot(ticker=ticker, quant_rating=qr, sector=sector, **defaults)


def test_params_run118_defaults():
    p = RUN118_PARAMS
    assert p.max_adds_per_evaluation == 1
    assert p.position_cap_house_money == 1.0
    assert p.max_underwater_days == 270
    assert p.weak_signal_threshold == 4.0
    assert p.enable_qr_velocity is False
    assert p.version_hash()


def test_exactly_one_buy_per_eval():
    """No adaptive filler — even with empty book, only 1 buy."""
    portfolio = PortfolioState(cash=100_000, positions={}, as_of=date(2026, 7, 17))
    scores = {
        f"T{i}": _score(f"T{i}", 4.5)
        for i in range(10)
    }
    ranked = list(scores.keys())
    signals = evaluate(portfolio, scores, ranked, RUN118_PARAMS)
    buys = [s for s in signals if s.action in (Action.BUY, Action.DOUBLE_BUY)]
    assert len(buys) == 1
    assert any(r.rule_id == "max_adds_per_evaluation" for r in buys[0].rules)


def test_buy_criteria_blocks_weak_revisions():
    portfolio = PortfolioState(cash=100_000, positions={}, as_of=date.today())
    scores = {"WEAK": _score("WEAK", 4.5, revisions_grade="C")}
    signals = evaluate(portfolio, scores, ["WEAK"], RUN118_PARAMS)
    buys = [s for s in signals if s.action == Action.BUY]
    assert buys == []


def test_strong_sell():
    pos = PositionState(
        ticker="LOSER",
        shares=100,
        avg_cost=50,
        current_price=40,
        entry_date=date.today() - timedelta(days=30),
        initial_investment=5000,
    )
    portfolio = PortfolioState(cash=10_000, positions={"LOSER": pos})
    scores = {"LOSER": _score("LOSER", 1.2)}
    signals = evaluate(portfolio, scores, [], RUN118_PARAMS)
    sells = [s for s in signals if s.action == Action.FULL_SELL]
    assert len(sells) == 1
    assert sells[0].ticker == "LOSER"
    assert any(r.rule_id == "strong_sell" for r in sells[0].rules)


def test_underwater_stop_270_days():
    pos = PositionState(
        ticker="STALE",
        shares=100,
        avg_cost=50,
        current_price=40,
        entry_date=date.today() - timedelta(days=280),
        initial_investment=5000,
    )
    portfolio = PortfolioState(cash=10_000, positions={"STALE": pos}, as_of=date.today())
    scores = {"STALE": _score("STALE", 2.8)}  # below 3.0, above strong sell
    signals = evaluate(portfolio, scores, [], RUN118_PARAMS)
    assert any(s.action == Action.FULL_SELL and s.ticker == "STALE" for s in signals)


def test_underwater_not_triggered_before_270():
    pos = PositionState(
        ticker="STALE",
        shares=10,
        avg_cost=50,
        current_price=40,
        entry_date=date.today() - timedelta(days=160),
        initial_investment=500,
    )
    # Large cash so position is not overweight (avoids weight-cap trim)
    portfolio = PortfolioState(cash=100_000, positions={"STALE": pos}, as_of=date.today())
    scores = {"STALE": _score("STALE", 2.8)}
    signals = evaluate(portfolio, scores, [], RUN118_PARAMS)
    # QR 2.8 >= hold 2.5; underwater needs 270d
    sells = [s for s in signals if s.ticker == "STALE"]
    assert sells == []


def test_winners_circle_partial_sell():
    pos = PositionState(
        ticker="WIN",
        shares=100,
        avg_cost=50,
        current_price=100,  # +100%
        entry_date=date.today() - timedelta(days=100),
        initial_investment=5000,  # cost basis $5k → 50 shares at $100
    )
    portfolio = PortfolioState(cash=10_000, positions={"WIN": pos})
    scores = {"WIN": _score("WIN", 2.0)}  # below hold
    signals = evaluate(portfolio, scores, [], RUN118_PARAMS)
    partials = [s for s in signals if s.action == Action.PARTIAL_SELL]
    assert len(partials) == 1
    assert partials[0].sell_shares == 50.0
    assert any(r.rule_id == "winners_circle" for r in partials[0].rules)


def test_house_money_uncapped():
    """House money at 25% should NOT trim when cap is 1.0."""
    pos = PositionState(
        ticker="HM",
        shares=100,
        avg_cost=10,
        current_price=50,
        initial_investment=0,  # house money
    )
    # equity = cash 0 + 5000 = 5000, weight 100% but HM cap 1.0
    portfolio = PortfolioState(cash=0, positions={"HM": pos})
    scores = {"HM": _score("HM", 4.0)}
    signals = evaluate(portfolio, scores, [], RUN118_PARAMS)
    trims = [s for s in signals if s.action == Action.TRIM]
    assert trims == []


def test_active_recycling_when_cash_short():
    """Weak position trimmed to fund a new buy when cash is insufficient."""
    # Diversified book so WEAK is under the 15% weight cap but cash is tight
    positions = {
        "WEAK": PositionState(
            ticker="WEAK",
            shares=100,
            avg_cost=50,
            current_price=50,
            entry_date=date.today() - timedelta(days=60),
            initial_investment=5_000,
            sector="Technology",
        ),
    }
    for i in range(8):
        t = f"HOLD{i}"
        positions[t] = PositionState(
            ticker=t,
            shares=100,
            avg_cost=50,
            current_price=50,
            entry_date=date.today() - timedelta(days=60),
            initial_investment=5_000,
            sector="Healthcare" if i % 2 == 0 else "Financials",
        )
    # equity ≈ 500 + 9*5000 = 45500; WEAK weight ~11%; need ~3.5%+reserve ≈ 4778, cash only 500
    portfolio = PortfolioState(cash=500, positions=positions, as_of=date.today())
    scores = {
        "WEAK": _score("WEAK", 3.0, sector="Technology"),
        "NEW": _score("NEW", 4.6, sector="Energy"),
    }
    for t, pos in positions.items():
        if t != "WEAK":
            scores[t] = _score(t, 4.2, sector=pos.sector or "Healthcare")
    signals = evaluate(portfolio, scores, ["NEW"], RUN118_PARAMS)
    recycle = [s for s in signals if s.action == Action.RECYCLE_TRIM]
    buys = [s for s in signals if s.action == Action.BUY]
    assert len(recycle) == 1
    assert recycle[0].ticker == "WEAK"
    assert len(buys) == 1
    assert buys[0].ticker == "NEW"


def test_daily_sell_pass_off_by_default():
    pos = PositionState(
        ticker="LOSER",
        shares=100,
        avg_cost=50,
        current_price=40,
        entry_date=date.today(),
        initial_investment=5000,
    )
    portfolio = PortfolioState(cash=10_000, positions={"LOSER": pos})
    scores = {"LOSER": _score("LOSER", 1.0)}
    assert evaluate_sells_only(portfolio, scores, RUN118_PARAMS) == []


def test_evaluate_dca_sells_fires_without_the_daily_flag():
    """The DCA sample reuses live exits, not the optional daily sell pass."""
    pos = PositionState(
        ticker="LOSER",
        shares=10,
        avg_cost=50,
        current_price=40,
        entry_date=date.today(),
        initial_investment=5000,
    )
    portfolio = PortfolioState(cash=10_000, positions={"LOSER": pos})
    scores = {"LOSER": _score("LOSER", 1.0)}
    signals = evaluate_dca_sells(portfolio, scores, RUN118_PARAMS)
    assert any(s.action == Action.FULL_SELL and s.ticker == "LOSER" for s in signals)
    assert not any(s.action == Action.BUY for s in signals)


def test_evaluate_dca_sells_does_not_weight_trim():
    """Weekly equal-weight is the sizing; the live 15% cap must not recycle."""
    positions = {
        t: PositionState(
            ticker=t,
            shares=25,
            avg_cost=100,
            current_price=100,
            initial_investment=2500,
        )
        for t in ("AAA", "BBB", "CCC", "DDD")
    }
    scores = {t: _score(t, 4.5) for t in positions}
    portfolio = PortfolioState(cash=0, positions=positions, as_of=date(2026, 8, 7))
    signals = evaluate_dca_sells(portfolio, scores, RUN118_PARAMS)
    assert signals == []


def test_sector_cap_blocks_buy():
    params = RUN118_PARAMS
    # max 50 * 0.3 = 15; fill 15 tech names then try another tech
    positions = {}
    scores = {}
    for i in range(15):
        t = f"TECH{i}"
        positions[t] = PositionState(
            ticker=t,
            shares=10,
            avg_cost=100,
            current_price=100,
            initial_investment=1000,
            sector="Technology",
        )
        scores[t] = _score(t, 4.0, sector="Technology")
    scores["NEWT"] = _score("NEWT", 4.8, sector="Technology")
    portfolio = PortfolioState(cash=50_000, positions=positions)
    signals = evaluate(portfolio, scores, ["NEWT"], params)
    buys = [s for s in signals if s.action == Action.BUY]
    assert buys == []
