"""Pure strategy package — no I/O. Live and backtest must call evaluate()."""

from outpick_strategy.params import StrategyParams, RUN118_PARAMS
from outpick_strategy.types import (
    Action,
    PortfolioState,
    PositionState,
    ScoreSnapshot,
    Signal,
    RuleCheck,
)
from outpick_strategy.signals import evaluate, evaluate_sells_only
from outpick_strategy.cadence import (
    evaluation_fridays_between,
    is_evaluation_friday,
    next_evaluation_friday,
)
from outpick_strategy.grades import (
    grade_meets_minimum,
    percentile_to_grade,
    quant_to_signal,
    GRADE_ORDER,
)

__all__ = [
    "StrategyParams",
    "RUN118_PARAMS",
    "Action",
    "PortfolioState",
    "PositionState",
    "ScoreSnapshot",
    "Signal",
    "RuleCheck",
    "evaluate",
    "evaluate_sells_only",
    "evaluation_fridays_between",
    "is_evaluation_friday",
    "next_evaluation_friday",
    "grade_meets_minimum",
    "percentile_to_grade",
    "quant_to_signal",
    "GRADE_ORDER",
]
