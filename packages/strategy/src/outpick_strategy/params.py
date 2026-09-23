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
    # Minimum days before the ordinary hold-removal exit (rating below
    # hold_removal_rating) may fire. Deliberately does NOT gate strong_sell:
    # a name collapsing past that threshold is the case you most need to be
    # able to exit, and a turnover control should not become a trap. The
    # underwater stop has its own, longer clock. 0 = Run 118 as backtested.
    min_holding_days: int = 0
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

    # ── Research switches (OFF = Run 118 exactly) ────────────────────────────
    # Each field below is measured by `python -m worker.backtest.factor_ic`
    # (scoring switches) or a replay compare (book switches) before it may
    # become a default. At its neutral value a switch is left out of
    # `version_hash()`, so adding one does not relabel the shipped model.
    #
    # Scoring (worker compute_scores):
    # 12-1 momentum: skip the most recent N calendar days of the 12m window.
    # Short-term reversal lives in that last month.
    momentum_skip_days: int = 0
    # Average the 6m and 12m momentum percentiles (the original Run 118 port).
    momentum_blend_6m: bool = False
    # "pct": EPS revision as % change of the prior estimate (Run 118).
    # "price": EPS revision as (new - old) estimate / share price. A $0.02 ->
    # $0.04 estimate is +100% under "pct" and noise under "price".
    revisions_eps_scaling: str = "pct"
    # Treat a revisions pair shorter than this as missing. 0 = any pair.
    revision_min_lookback_days: int = 0
    # Blend next-fiscal-year revisions into the factor when available.
    revisions_fy2_blend: bool = False
    # Loss-makers carry no P/E or PEG. Missing reads as "not measured", so a
    # loss-maker is valued on sales and book alone. True ranks it worst on
    # P/E and PEG instead.
    valuation_penalize_losses: bool = False
    # EPS growth and net-income growth are close to the same number, so
    # earnings carry two thirds of the growth factor. True drops net income.
    growth_drop_net_income: bool = False
    # Weight of the standardized earnings-surprise factor. 0 = factor absent.
    weight_surprise: float = 0.0
    #
    # Book (evaluate):
    # Rank by the mean of today's and the prior window's rating, so one noisy
    # snapshot cannot decide the single add.
    rank_smoothing: bool = False
    # Skip a buy when the name reports earnings within N calendar days.
    earnings_blackout_days: int = 0
    # Skip a new name whose daily-return correlation with any holding is above
    # this. None = off.
    max_pair_correlation: float | None = None
    correlation_lookback_days: int = 90
    # "max_positions": sector cap = sector_concentration x max_positions
    # (Run 118; 15 names, so it does not bind on a young book).
    # "held": sector_concentration x (names held + 1), floor 1.
    sector_cap_basis: str = "max_positions"

    # Any change to these defaults, signals.py, or scoring.py MUST bump this
    # label (run118 → run119 …), regenerate the golden snapshot and backtest
    # baseline in the same PR, and add a STRATEGY_CHANGELOG.md entry.
    version_label: str = "run118"

    def target_notional(self, equity: float) -> float:
        """Dollars to deploy on one entry."""
        if self.position_size_usd is not None:
            return self.position_size_usd
        return equity * self.position_size_pct

    def factor_weights(self) -> dict[str, float]:
        weights = {
            "valuation": self.weight_valuation,
            "growth": self.weight_growth,
            "profitability": self.weight_profitability,
            "momentum": self.weight_momentum,
            "revisions": self.weight_revisions,
        }
        # Present only when weighted: min_factor_coverage = 1.0 would otherwise
        # make every name without a recent report unscoreable.
        if self.weight_surprise > 0:
            weights["surprise"] = self.weight_surprise
        return weights

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    # Fields safe to serve over the public API.
    #
    # Everything omitted here is the model itself: the factor weights, the
    # scoring filters that shape them, and the rating thresholds each gate
    # fires on. Those are the research, and `to_dict()` was being returned
    # wholesale on GET /api/v1/strategy — so any subscriber could read the
    # exact weighting and reimplement it.
    #
    # What remains is the *discipline* rather than the *model*: how
    # concentrated the book may get, when a winner is trimmed, how long an
    # underwater position is given. Outpick publishes those deliberately —
    # they are the risk contract with a subscriber, and knowing them does not
    # let anyone reproduce a pick.
    PUBLIC_FIELDS = (
        "max_positions",
        "eval_frequency",
        "max_adds_per_evaluation",
        "sector_concentration",
        "position_cap_normal",
        "position_trim_target",
        "position_cap_house_money",
        "winner_threshold",
        "max_underwater_days",
        "min_holding_days",
        "allow_double_buy",
        "version_label",
    )

    def public_dict(self) -> dict:
        """The subset of parameters safe to publish. See PUBLIC_FIELDS."""
        d = asdict(self)
        return {k: d[k] for k in self.PUBLIC_FIELDS}

    def version_hash(self) -> str:
        d = self.to_dict()
        for name, neutral in RESEARCH_SWITCH_NEUTRAL.items():
            if d.get(name) == neutral:
                d.pop(name, None)
        payload = json.dumps(d, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode()).hexdigest()[:12]

    def with_overrides(self, **kwargs) -> StrategyParams:
        return replace(self, **kwargs)


# Research switches and the value at which each one is a no-op. Omitted from
# `version_hash()` at that value; any other value changes the hash.
RESEARCH_SWITCH_NEUTRAL: dict[str, object] = {
    "momentum_skip_days": 0,
    "momentum_blend_6m": False,
    "revisions_eps_scaling": "pct",
    "revision_min_lookback_days": 0,
    "revisions_fy2_blend": False,
    "valuation_penalize_losses": False,
    "growth_drop_net_income": False,
    "weight_surprise": 0.0,
    "rank_smoothing": False,
    "earnings_blackout_days": 0,
    "max_pair_correlation": None,
    "correlation_lookback_days": 90,
    "sector_cap_basis": "max_positions",
}

RUN118_PARAMS = StrategyParams()
