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
