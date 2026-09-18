"""Buy-queue explainer: same pick as evaluate(), with skip reasons for the rest."""

from __future__ import annotations

from datetime import date

from outpick_strategy import (
    Action,
    PortfolioState,
    PositionState,
    RUN118_PARAMS,
    ScoreSnapshot,
    evaluate,
    explain_buy_queue,
)
from outpick_strategy.params import BuyCriteria

TODAY = date(2026, 7, 17)


def score(
    ticker: str,
    qr: float,
    sector: str | None = "Technology",
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


def pos(
    ticker: str,
    *,
    shares: float = 10.0,
    avg_cost: float = 50.0,
    price: float = 50.0,
    sector: str | None = "Technology",
) -> PositionState:
    return PositionState(
        ticker=ticker,
        shares=shares,
        avg_cost=avg_cost,
        current_price=price,
        entry_date=TODAY,
        initial_investment=shares * avg_cost,
        sector=sector,
    )


def ranked(scores: dict[str, ScoreSnapshot]) -> list[str]:
    return sorted(scores, key=lambda t: (-scores[t].quant_rating, t))


def engine_buy(portfolio, scores, tickers, params=RUN118_PARAMS):
    signals = evaluate(portfolio, scores, tickers, params, TODAY)
    chosen = next((s for s in signals if s.action in (Action.BUY, Action.DOUBLE_BUY)), None)
    return chosen


def test_selected_ticker_matches_evaluate_buy():
    scores = {
        "AAA": score("AAA", 4.8, sector="Energy"),
        "BBB": score("BBB", 4.6, sector="Healthcare"),
        "CCC": score("CCC", 4.4, sector="Industrials"),
    }
    portfolio = PortfolioState(cash=50_000, positions={}, as_of=TODAY)
    tickers = ranked(scores)

    chosen = engine_buy(portfolio, scores, tickers)
    queue = explain_buy_queue(portfolio, scores, tickers, RUN118_PARAMS, TODAY)

    assert chosen is not None
    assert chosen.ticker == "AAA"
    assert queue.selected_ticker == chosen.ticker
    assert queue.selected_action == "buy"
    selected = next(c for c in queue.candidates if c.status == "selected")
    assert selected.ticker == "AAA"
    assert selected.action == "buy"


def test_lower_ranked_gate_passers_are_blocked_by_max_adds():
    scores = {
        "AAA": score("AAA", 4.8, sector="Energy"),
        "BBB": score("BBB", 4.6, sector="Healthcare"),
    }
    portfolio = PortfolioState(cash=50_000, positions={}, as_of=TODAY)
    queue = explain_buy_queue(portfolio, scores, ranked(scores), RUN118_PARAMS, TODAY)

    bbb = next(c for c in queue.candidates if c.ticker == "BBB")
    assert bbb.status == "blocked"
    assert bbb.blocked_by == "max_adds"
    assert bbb.criteria_ok is True


def test_already_held_name_is_not_a_new_buy():
    scores = {
        "HELD": score("HELD", 4.9, sector="Technology"),
        "NEW": score("NEW", 4.5, sector="Energy"),
    }
    # Held but not up 30%, so conviction add does not fire; NEW should buy.
    portfolio = PortfolioState(
        cash=50_000,
        positions={"HELD": pos("HELD", price=50.0, avg_cost=50.0)},
        as_of=TODAY,
    )
    tickers = ranked(scores)
    chosen = engine_buy(portfolio, scores, tickers)
    queue = explain_buy_queue(portfolio, scores, tickers, RUN118_PARAMS, TODAY)

    assert chosen is not None
    assert chosen.ticker == "NEW"
    assert queue.selected_ticker == "NEW"
    held = next(c for c in queue.candidates if c.ticker == "HELD")
    assert held.status == "blocked"
    assert held.blocked_by == "conviction_add_gain"
    assert held.held is True


def test_sector_cap_blocks_a_higher_ranked_name():
    params = RUN118_PARAMS.with_overrides(max_positions=5, sector_concentration=0.30)
    # cap = max(1, int(5 * 0.30)) = 1, so one Technology name already held
    # blocks the higher-QR tech candidate.
    scores = {
        "TECH": score("TECH", 4.9, sector="Technology"),
        "ENRG": score("ENRG", 4.7, sector="Energy"),
        "OWN": score("OWN", 3.5, sector="Technology"),
    }
    portfolio = PortfolioState(
        cash=50_000,
        positions={"OWN": pos("OWN", sector="Technology")},
        as_of=TODAY,
    )
    tickers = ranked(scores)
    chosen = engine_buy(portfolio, scores, tickers, params)
    queue = explain_buy_queue(portfolio, scores, tickers, params, TODAY)

    assert chosen is not None
    assert chosen.ticker == "ENRG"
    assert queue.selected_ticker == "ENRG"
    tech = next(c for c in queue.candidates if c.ticker == "TECH")
    assert tech.status == "blocked"
    assert tech.blocked_by == "sector_cap"


def test_no_slot_blocks_a_new_name():
    params = RUN118_PARAMS.with_overrides(max_positions=1)
    scores = {
        "NEW": score("NEW", 4.8, sector="Energy"),
        "OWN": score("OWN", 3.5, sector="Technology"),
    }
    portfolio = PortfolioState(
        cash=50_000,
        positions={"OWN": pos("OWN")},
        as_of=TODAY,
    )
    tickers = ranked(scores)
    chosen = engine_buy(portfolio, scores, tickers, params)
    queue = explain_buy_queue(portfolio, scores, tickers, params, TODAY)

    assert chosen is None
    assert queue.selected_ticker is None
    new = next(c for c in queue.candidates if c.ticker == "NEW")
    assert new.status == "blocked"
    assert new.blocked_by == "no_slot"


def test_near_miss_is_a_high_qr_name_that_fails_a_grade_gate():
    scores = {
        "PASS": score("PASS", 4.5, sector="Energy"),
        "MISS": score("MISS", 4.8, sector="Healthcare", revisions_grade="C"),
    }
    portfolio = PortfolioState(cash=50_000, positions={}, as_of=TODAY)
    queue = explain_buy_queue(portfolio, scores, ranked(scores), RUN118_PARAMS, TODAY)

    miss = next(c for c in queue.candidates if c.ticker == "MISS")
    assert miss.status == "near_miss"
    assert miss.criteria_ok is False
    assert miss.blocked_by == "criteria"
    assert "min_revisions_grade" in miss.message
    # Ranked by QR, so MISS is #1 even though it cannot buy.
    assert miss.rank == 1
    assert queue.selected_ticker == "PASS"


def test_empty_universe_has_no_invented_pick():
    portfolio = PortfolioState(cash=50_000, positions={}, as_of=TODAY)
    queue = explain_buy_queue(portfolio, {}, [], RUN118_PARAMS, TODAY)
    assert queue.selected_ticker is None
    assert queue.candidates == []


def test_near_miss_tail_is_capped():
    scores = {
        f"M{i:02d}": score(f"M{i:02d}", 4.9 - i * 0.01, revisions_grade="C")
        for i in range(20)
    }
    scores["PASS"] = score("PASS", 4.0, sector="Energy")
    portfolio = PortfolioState(cash=50_000, positions={}, as_of=TODAY)
    queue = explain_buy_queue(
        portfolio, scores, ranked(scores), RUN118_PARAMS, TODAY, near_miss_limit=3
    )
    misses = [c for c in queue.candidates if c.status == "near_miss"]
    assert len(misses) == 3
    passers = [c for c in queue.candidates if c.criteria_ok]
    assert [c.ticker for c in passers] == ["PASS"]


def test_selected_matches_evaluate_when_criteria_are_stricter():
    params = RUN118_PARAMS.with_overrides(
        buy_criteria=BuyCriteria(min_quant_rating=4.7, min_revisions_grade="A")
    )
    scores = {
        "LOW": score("LOW", 4.5, revisions_grade="A"),
        "HIGH": score("HIGH", 4.9, revisions_grade="A", sector="Energy"),
        "MISS": score("MISS", 4.8, revisions_grade="B+"),
    }
    portfolio = PortfolioState(cash=50_000, positions={}, as_of=TODAY)
    tickers = ranked(scores)
    chosen = engine_buy(portfolio, scores, tickers, params)
    queue = explain_buy_queue(portfolio, scores, tickers, params, TODAY)
    assert chosen is not None
    assert queue.selected_ticker == chosen.ticker == "HIGH"
