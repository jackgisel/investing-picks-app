"""Research switches: OFF is Run 118 exactly, ON does what the name says."""

from __future__ import annotations

from dataclasses import fields
from datetime import date, timedelta

from outpick_strategy import (
    RESEARCH_SWITCH_NEUTRAL,
    RUN118_PARAMS,
    Action,
    PortfolioState,
    PositionState,
    ScoreSnapshot,
    StrategyParams,
    evaluate,
    explain_buy_queue,
    rank_candidates,
)

AS_OF = date(2026, 9, 18)


def _score(ticker, qr, sector="Technology", **kw) -> ScoreSnapshot:
    return ScoreSnapshot(
        ticker=ticker,
        quant_rating=qr,
        valuation_grade="B",
        growth_grade="A",
        profitability_grade="B",
        momentum_grade="A",
        revisions_grade="A",
        sector=sector,
        **kw,
    )


def _book(held: dict[str, str] | None = None) -> PortfolioState:
    positions = {
        t: PositionState(
            ticker=t,
            shares=10,
            avg_cost=100,
            current_price=100,
            entry_date=AS_OF - timedelta(days=30),
            initial_investment=1_000,
            sector=sector,
        )
        for t, sector in (held or {}).items()
    }
    return PortfolioState(cash=50_000, positions=positions, as_of=AS_OF)


def _bought(signals) -> str | None:
    buy = next((s for s in signals if s.action in (Action.BUY, Action.DOUBLE_BUY)), None)
    return buy.ticker if buy else None


# ── hash ────────────────────────────────────────────────────────────────────


def test_every_research_field_has_a_neutral_value_equal_to_its_default():
    defaults = {f.name: f.default for f in fields(StrategyParams)}
    for name, neutral in RESEARCH_SWITCH_NEUTRAL.items():
        assert defaults[name] == neutral, name


def test_neutral_switches_do_not_move_the_run118_hash():
    # The pre-switch hash of the shipped defaults. Adding a research field must
    # not relabel the model that is running.
    assert RUN118_PARAMS.version_hash() == "3dae13a76007"


def test_a_switch_that_is_on_changes_the_hash():
    base = RUN118_PARAMS.version_hash()
    assert RUN118_PARAMS.with_overrides(momentum_skip_days=21).version_hash() != base
    assert RUN118_PARAMS.with_overrides(max_pair_correlation=0.8).version_hash() != base


def test_surprise_factor_only_enters_the_weights_when_weighted():
    assert "surprise" not in RUN118_PARAMS.factor_weights()
    assert RUN118_PARAMS.with_overrides(weight_surprise=0.1).factor_weights()["surprise"] == 0.1


# ── rank smoothing ──────────────────────────────────────────────────────────


def test_rank_smoothing_off_is_plain_rating_order():
    scores = {
        "SPIKE": _score("SPIKE", 4.6, prior_quant_rating=3.0),
        "STEADY": _score("STEADY", 4.5, prior_quant_rating=4.5),
    }
    assert rank_candidates(scores, RUN118_PARAMS) == ["SPIKE", "STEADY"]


def test_rank_smoothing_prefers_the_name_that_held_its_rating():
    scores = {
        "SPIKE": _score("SPIKE", 4.6, prior_quant_rating=3.0),
        "STEADY": _score("STEADY", 4.5, prior_quant_rating=4.5),
        "NEW": _score("NEW", 4.4),
    }
    params = RUN118_PARAMS.with_overrides(rank_smoothing=True)
    assert rank_candidates(scores, params) == ["STEADY", "NEW", "SPIKE"]


# ── earnings blackout ───────────────────────────────────────────────────────


def test_blackout_skips_a_name_reporting_inside_the_window():
    scores = {
        "SOON": _score("SOON", 4.6, next_earnings_date=AS_OF + timedelta(days=3)),
        "LATER": _score("LATER", 4.5, next_earnings_date=AS_OF + timedelta(days=30)),
    }
    ranked = rank_candidates(scores)
    assert _bought(evaluate(_book(), scores, ranked, RUN118_PARAMS, AS_OF)) == "SOON"
    params = RUN118_PARAMS.with_overrides(earnings_blackout_days=7)
    assert _bought(evaluate(_book(), scores, ranked, params, AS_OF)) == "LATER"

    queue = explain_buy_queue(_book(), scores, ranked, params, AS_OF)
    soon = next(c for c in queue.candidates if c.ticker == "SOON")
    assert soon.blocked_by == "earnings_blackout"


def test_blackout_ignores_an_unknown_date_and_a_past_report():
    scores = {
        "UNKNOWN": _score("UNKNOWN", 4.6),
        "PAST": _score("PAST", 4.5, next_earnings_date=AS_OF - timedelta(days=1)),
    }
    params = RUN118_PARAMS.with_overrides(earnings_blackout_days=7)
    assert _bought(evaluate(_book(), scores, rank_candidates(scores), params, AS_OF)) == "UNKNOWN"


# ── correlation cap ─────────────────────────────────────────────────────────


def _series(values: list[float]) -> dict[date, float]:
    return {AS_OF - timedelta(days=len(values) - i): v for i, v in enumerate(values)}


def test_correlation_cap_skips_a_twin_of_a_holding():
    wave = [0.01 * ((i % 7) - 3) for i in range(40)]
    other = [0.01 * ((i % 5) - 2) for i in range(40)]
    series = {
        "HELD": _series(wave),
        "TWIN": _series([w * 1.1 for w in wave]),
        "DIFF": _series(other),
    }
    scores = {
        "HELD": _score("HELD", 3.0),
        "TWIN": _score("TWIN", 4.6, sector="Energy"),
        "DIFF": _score("DIFF", 4.5, sector="Energy"),
    }
    book = _book({"HELD": "Technology"})
    ranked = rank_candidates(scores)
    assert _bought(evaluate(book, scores, ranked, RUN118_PARAMS, AS_OF, series)) == "TWIN"

    params = RUN118_PARAMS.with_overrides(max_pair_correlation=0.8)
    assert _bought(evaluate(book, scores, ranked, params, AS_OF, series)) == "DIFF"
    queue = explain_buy_queue(book, scores, ranked, params, AS_OF, return_series=series)
    twin = next(c for c in queue.candidates if c.ticker == "TWIN")
    assert twin.blocked_by == "max_pair_correlation"
    assert "HELD" in twin.message


def test_correlation_cap_abstains_without_series():
    scores = {"HELD": _score("HELD", 3.0), "TWIN": _score("TWIN", 4.6, sector="Energy")}
    params = RUN118_PARAMS.with_overrides(max_pair_correlation=0.8)
    book = _book({"HELD": "Technology"})
    assert _bought(evaluate(book, scores, rank_candidates(scores), params, AS_OF)) == "TWIN"


# ── sector cap basis ────────────────────────────────────────────────────────


def test_held_basis_caps_a_young_book_by_its_own_size():
    held = {"T1": "Technology", "T2": "Technology", "E1": "Energy"}
    scores = {t: _score(t, 3.0, sector=s) for t, s in held.items()}
    scores["T3"] = _score("T3", 4.6, sector="Technology")
    scores["H1"] = _score("H1", 4.5, sector="Healthcare")
    ranked = rank_candidates(scores)
    # max_positions basis: 15 per sector, so a third Tech name is fine.
    assert _bought(evaluate(_book(held), scores, ranked, RUN118_PARAMS, AS_OF)) == "T3"
    # held basis: int(4 x 0.30) = 1 per sector; Tech already has 2.
    params = RUN118_PARAMS.with_overrides(sector_cap_basis="held")
    assert _bought(evaluate(_book(held), scores, ranked, params, AS_OF)) == "H1"
