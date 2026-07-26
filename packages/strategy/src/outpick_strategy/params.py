"""Single source of truth for Run 118 strategy parameters."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field, replace


@dataclass(frozen=True)
class BuyCriteria:
    min_quant_rating: float = 4.0
    min_revisions_grade: str = "B+"
    min_growth_grade: str = "B"
    min_profitability_grade: str = "D"
    min_valuation_grade: str = "C-"


@dataclass(frozen=True)
class StrategyParams:
    """Frozen Run 118 defaults. Optional live-only flags default OFF."""

    # Factor weights
    weight_valuation: float = 0.05
    weight_growth: float = 0.35
    weight_profitability: float = 0.15
    weight_momentum: float = 0.15
    weight_revisions: float = 0.30

    # Scoring filters
    z_score_floor: float = 1.8
    momentum_penalty: float = 20.0
    min_universe_market_cap: float = 300_000_000
    min_share_price: float = 5.0

    # Minimum share of total factor weight that must have data before a ticker
    # is scored at all. Without it, composite_from_factor_pcts renormalises over
    # whatever happens to be present, so a ticker MISSING a factor outscores one
    # that is genuinely worst-in-sector on it — 60.0 vs 39.0 for a null vs a
    # zero-percentile growth reading. That silently re-weights the model (with
    # growth, revisions and momentum absent the effective weights become
    # profitability 0.75 / valuation 0.25) while still stamping the Run 118
    # version hash on the result. 1.0 = every factor required.
    min_factor_coverage: float = 1.0

    # Buy criteria
    buy_criteria: BuyCriteria = field(default_factory=BuyCriteria)

    # Cadence & sizing
    max_positions: int = 50
    position_size_pct: float = 0.035
    # Fixed dollars per entry. When set, this wins over position_size_pct and
    # every pick is funded equally regardless of how the book has grown — the
    # sizing the live book was actually seeded with ($1,000 x 8 positions).
    # None restores percent-of-equity sizing.
    position_size_usd: float | None = None
    max_adds_per_evaluation: int = 1  # Exactly 1 — no adaptive filler
    cash_reserve_buys: int = 2
    sector_concentration: float = 0.30
    eval_frequency: str = "biweekly"

    # Position caps
    position_cap_normal: float = 0.15
    position_trim_target: float = 0.12
    position_cap_house_money: float = 1.00  # Uncapped (Run 118)
    position_trim_house_money: float = 0.15

    # Exits
    strong_sell_rating: float = 1.5
    hold_removal_rating: float = 2.5
    winner_threshold: float = 0.60
    max_underwater_days: int = 270  # Run 118
    underwater_qr_threshold: float = 3.0

    # Conviction & recycling
    allow_double_buy: bool = True
    double_buy_min_gain: float = 0.30
    weak_signal_threshold: float = 4.0  # Active recycling

    # Optional live-only experiments (OFF until backtested)
    enable_qr_velocity: bool = False
    qr_velocity_drop: float = 1.0
    enable_drawdown_circuit_breaker: bool = False
    drawdown_halt_pct: float = -0.15
    drawdown_resume_pct: float = -0.10
    enable_daily_sell_pass: bool = False

    version_label: str = "run118"

    def target_notional(self, equity: float) -> float:
        """Dollars to deploy on one entry."""
        if self.position_size_usd is not None:
            return self.position_size_usd
        return equity * self.position_size_pct

    def factor_weights(self) -> dict[str, float]:
        return {
            "valuation": self.weight_valuation,
            "growth": self.weight_growth,
            "profitability": self.weight_profitability,
            "momentum": self.weight_momentum,
            "revisions": self.weight_revisions,
        }

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    def version_hash(self) -> str:
        payload = json.dumps(self.to_dict(), sort_keys=True, default=str)
        return hashlib.sha256(payload.encode()).hexdigest()[:12]

    def with_overrides(self, **kwargs) -> StrategyParams:
        return replace(self, **kwargs)


RUN118_PARAMS = StrategyParams()
