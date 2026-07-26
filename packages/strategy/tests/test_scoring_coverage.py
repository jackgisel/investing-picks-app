"""Factor-coverage floor in composite_from_factor_pcts.

Production ran for months on ~20% of the model: growth, revisions and momentum
were all null, so the composite renormalised onto profitability and valuation
alone and still emitted confident 1-5 quant ratings. Those ratings drove real
FULL_SELL signals. The regression these tests lock down is that a MISSING factor
used to score better than a genuinely worst-in-sector one.
"""

from __future__ import annotations

import pytest

from outpick_strategy import RUN118_PARAMS
from outpick_strategy.scoring import (
    composite_from_factor_pcts,
    factor_percentile_score,
    quant_rating_from_composite,
)

ALL_FACTORS = ("valuation", "growth", "profitability", "momentum", "revisions")


def pcts(**overrides) -> dict[str, float | None]:
    base = {name: 60.0 for name in ALL_FACTORS}
    base.update(overrides)
    return base


def test_missing_factor_no_longer_outscores_a_bad_one():
    """The exact inversion that produced the ROKU/SOFI sells."""
    worst, _ = composite_from_factor_pcts(pcts(growth=0.0), RUN118_PARAMS)
    missing, _ = composite_from_factor_pcts(pcts(growth=None), RUN118_PARAMS)

    assert worst == pytest.approx(39.0)
    # Previously 60.0 — better than the ticker with real, terrible growth.
    assert missing is None


def test_full_coverage_still_scores():
    composite, grades = composite_from_factor_pcts(pcts(), RUN118_PARAMS)
    assert composite == pytest.approx(60.0)
    assert grades["growth"] != "F"


@pytest.mark.parametrize("missing", ALL_FACTORS)
def test_any_missing_factor_is_unscoreable_under_run118(missing):
    composite, _ = composite_from_factor_pcts(pcts(**{missing: None}), RUN118_PARAMS)
    assert composite is None


def test_coverage_floor_is_configurable_and_hashed():
    """A relaxed floor must be a recorded parameter, not an implicit default."""
    tolerant = RUN118_PARAMS.with_overrides(min_factor_coverage=0.6)

    # momentum is 0.15 of 1.00, so coverage is 0.85 — above a 0.6 floor.
    composite, _ = composite_from_factor_pcts(pcts(momentum=None), tolerant)
    assert composite is not None

    assert tolerant.version_hash() != RUN118_PARAMS.version_hash()


def test_z_filter_still_precedes_the_coverage_check():
    composite, _ = composite_from_factor_pcts(
        pcts(), RUN118_PARAMS, z_score=RUN118_PARAMS.z_score_floor - 0.1
    )
    assert composite is None


def test_momentum_penalty_applies_only_with_full_coverage():
    """The penalty has never fired in production; make its trigger explicit."""
    clean, _ = composite_from_factor_pcts(pcts(), RUN118_PARAMS, momentum_12m=0.1)
    penalised, _ = composite_from_factor_pcts(pcts(), RUN118_PARAMS, momentum_12m=-0.1)

    assert clean == pytest.approx(60.0)
    assert penalised == pytest.approx(60.0 - RUN118_PARAMS.momentum_penalty)
    # Worth ~0.8 of a quant rating — enough to cross hold_removal_rating.
    assert quant_rating_from_composite(clean) - quant_rating_from_composite(
        penalised
    ) == pytest.approx(0.8)


def test_percentile_scoring_leaves_nulls_null():
    out = factor_percentile_score([10.0, None, 5.0], higher_is_better=True)
    assert out[1] is None
    assert out[0] == 100.0 and out[2] == 0.0


def test_fixed_dollar_sizing_overrides_percent_of_equity():
    """Equal-weighted $1k entries, independent of how the book grows."""
    equity = 250_000.0
    assert RUN118_PARAMS.target_notional(equity) == pytest.approx(equity * 0.035)

    fixed = RUN118_PARAMS.with_overrides(position_size_usd=1000.0)
    assert fixed.target_notional(equity) == 1000.0
    assert fixed.target_notional(50_000.0) == 1000.0
    assert fixed.version_hash() != RUN118_PARAMS.version_hash()


def _position(entry_days_ago: int):
    from datetime import date, timedelta

    from outpick_strategy import PositionState

    return PositionState(
        ticker="SOFI",
        shares=100.0,
        avg_cost=10.0,
        current_price=10.08,
        entry_date=date.today() - timedelta(days=entry_days_ago),
        initial_investment=1000.0,
    )


def _score(qr: float):
    from outpick_strategy import ScoreSnapshot

    return ScoreSnapshot(ticker="SOFI", quant_rating=qr, valuation_grade="C",
                         growth_grade="C", profitability_grade="C",
                         momentum_grade="C", revisions_grade="C", sector="Financial Services")


def _evaluate(qr: float, days_held: int, min_holding_days: int):
    from datetime import date

    from outpick_strategy import PortfolioState, evaluate_sells_only

    params = RUN118_PARAMS.with_overrides(
        min_holding_days=min_holding_days, enable_daily_sell_pass=True
    )
    state = PortfolioState(cash=1000.0, positions={"SOFI": _position(days_held)})
    return evaluate_sells_only(state, {"SOFI": _score(qr)}, params, as_of=date.today())


def test_min_holding_days_suppresses_an_early_hold_removal():
    """SOFI's real shape: QR 1.66, held 50 days."""
    actions = [s.action.value for s in _evaluate(1.66, days_held=50, min_holding_days=180)]
    assert "full_sell" not in actions
    assert "hold" in actions, "the suppression should be recorded, not silent"


def test_hold_removal_fires_once_the_minimum_has_passed():
    actions = [s.action.value for s in _evaluate(1.66, days_held=200, min_holding_days=180)]
    assert "full_sell" in actions


def test_strong_sell_is_never_suppressed():
    """A collapsing name must stay exitable — that is the whole design point."""
    actions = [s.action.value for s in _evaluate(1.2, days_held=10, min_holding_days=180)]
    assert "full_sell" in actions


def test_run118_default_has_no_holding_period():
    assert RUN118_PARAMS.min_holding_days == 0
    actions = [s.action.value for s in _evaluate(1.66, days_held=1, min_holding_days=0)]
    assert "full_sell" in actions


def test_tied_values_share_a_percentile():
    """A short revisions window leaves most of the universe at exactly 0.0."""
    out = factor_percentile_score([0.0, 0.0, 0.0, 0.0], higher_is_better=True)
    assert out == [50.0, 50.0, 50.0, 50.0], "ties were dealt arbitrary ranks"


def test_ties_do_not_disturb_genuine_ordering():
    # one clear winner, a tied middle, one clear loser
    out = factor_percentile_score([9.0, 5.0, 5.0, 1.0], higher_is_better=True)
    assert out[0] == 100.0
    assert out[3] == 0.0
    assert out[1] == out[2] == pytest.approx(50.0)


def test_lower_is_better_still_inverts():
    out = factor_percentile_score([1.0, 9.0], higher_is_better=False)
    assert out[0] == 100.0 and out[1] == 0.0
