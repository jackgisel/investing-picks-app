"""Domain types for the pure strategy engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any


class Action(str, Enum):
    BUY = "buy"
    DOUBLE_BUY = "double_buy"
    FULL_SELL = "full_sell"
    PARTIAL_SELL = "partial_sell"
    TRIM = "trim"
    RECYCLE_TRIM = "recycle_trim"
    # Records a decision NOT to act — currently an exit suppressed by
    # min_holding_days. `apply_signals` dispatches on an explicit allow-list of
    # buy and sell actions, so this is inert at execution time by construction;
    # it exists so the ledger shows the rule that fired instead of silence.
    HOLD = "hold"


@dataclass
class RuleCheck:
    """Structured audit row explaining why a rule fired or blocked."""

    rule_id: str
    passed: bool
    inputs: dict[str, Any] = field(default_factory=dict)
    threshold: dict[str, Any] = field(default_factory=dict)
    message: str = ""


@dataclass
class ScoreSnapshot:
    ticker: str
    quant_rating: float
    valuation_grade: str = "F"
    growth_grade: str = "F"
    profitability_grade: str = "F"
    momentum_grade: str = "F"
    revisions_grade: str = "F"
    sector: str | None = None
    prior_quant_rating: float | None = None  # for optional QR velocity


@dataclass
class PositionState:
    ticker: str
    shares: float
    avg_cost: float
    current_price: float
    entry_date: date | None = None
    initial_investment: float | None = None  # <= 0 means house money
    sector: str | None = None

    @property
    def market_value(self) -> float:
        return self.shares * self.current_price

    @property
    def is_house_money(self) -> bool:
        return self.initial_investment is not None and self.initial_investment <= 0

    @property
    def gain_pct(self) -> float:
        if not self.avg_cost or self.avg_cost <= 0:
            return 0.0
        return (self.current_price - self.avg_cost) / self.avg_cost


@dataclass
class PortfolioState:
    cash: float
    positions: dict[str, PositionState]
    peak_equity: float | None = None
    is_drawdown_halted: bool = False
    as_of: date | None = None

    @property
    def invested_value(self) -> float:
        return sum(p.market_value for p in self.positions.values())

    @property
    def equity(self) -> float:
        return self.cash + self.invested_value

    def position_count(self) -> int:
        return len(self.positions)


@dataclass
class Signal:
    action: Action
    ticker: str
    reason: str
    sell_shares: float | None = None
    keep_shares: float | None = None
    rules: list[RuleCheck] = field(default_factory=list)
    score: ScoreSnapshot | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action.value,
            "ticker": self.ticker,
            "reason": self.reason,
            "sell_shares": self.sell_shares,
            "keep_shares": self.keep_shares,
            "rules": [
                {
                    "rule_id": r.rule_id,
                    "passed": r.passed,
                    "inputs": r.inputs,
                    "threshold": r.threshold,
                    "message": r.message,
                }
                for r in self.rules
            ],
            "score": None
            if not self.score
            else {
                "ticker": self.score.ticker,
                "quant_rating": self.score.quant_rating,
                "valuation_grade": self.score.valuation_grade,
                "growth_grade": self.score.growth_grade,
                "profitability_grade": self.score.profitability_grade,
                "momentum_grade": self.score.momentum_grade,
                "revisions_grade": self.score.revisions_grade,
                "sector": self.score.sector,
            },
            "metadata": self.metadata,
        }
