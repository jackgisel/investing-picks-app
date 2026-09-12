"""params_from_portfolio must inherit BuyCriteria defaults from RUN118_PARAMS.

A live book with a partial params_json (for example only min_holding_days)
used to splice hardcoded 4.0 / B+ / B / D / C- whenever params_json was
non-empty, so a default flip in params.py silently missed the live engine.
"""

from outpick_strategy import RUN118_PARAMS

from app.services.portfolio import params_from_portfolio


def test_empty_params_json_returns_shipped_defaults(portfolio):
    portfolio.params_json = {}
    params = params_from_portfolio(portfolio)
    assert params.buy_criteria.min_quant_rating == RUN118_PARAMS.buy_criteria.min_quant_rating
    assert params.version_label == RUN118_PARAMS.version_label


def test_min_holding_days_only_inherits_current_buy_floor(portfolio):
    portfolio.params_json = {"min_holding_days": 180}
    params = params_from_portfolio(portfolio)
    assert params.min_holding_days == 180
    assert params.buy_criteria.min_quant_rating == RUN118_PARAMS.buy_criteria.min_quant_rating
    assert params.buy_criteria.min_revisions_grade == RUN118_PARAMS.buy_criteria.min_revisions_grade
    assert params.buy_criteria.min_growth_grade == RUN118_PARAMS.buy_criteria.min_growth_grade
    assert params.buy_criteria.min_profitability_grade == RUN118_PARAMS.buy_criteria.min_profitability_grade
    assert params.buy_criteria.min_valuation_grade == RUN118_PARAMS.buy_criteria.min_valuation_grade
    assert params.max_adds_per_evaluation == 1


def test_explicit_buy_criteria_override_still_wins(portfolio):
    portfolio.params_json = {"buy_criteria": {"min_quant_rating": 4.0}}
    params = params_from_portfolio(portfolio)
    assert params.buy_criteria.min_quant_rating == 4.0
    assert params.buy_criteria.min_revisions_grade == RUN118_PARAMS.buy_criteria.min_revisions_grade
