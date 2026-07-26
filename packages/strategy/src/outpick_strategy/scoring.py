"""Lightweight composite scoring helpers (pure)."""

from __future__ import annotations

from outpick_strategy.grades import percentile_to_grade
from outpick_strategy.params import StrategyParams


def factor_percentile_score(
    values: list[float | None],
    higher_is_better: bool,
) -> list[float | None]:
    """Rank non-null values into 0–100 percentiles within the list."""
    indexed = [(i, v) for i, v in enumerate(values) if v is not None]
    if not indexed:
        return [None] * len(values)

    indexed.sort(key=lambda x: x[1], reverse=higher_is_better)
    n = len(indexed)
    out: list[float | None] = [None] * len(values)
    for rank, (i, _) in enumerate(indexed):
        # Higher rank index among sorted-best-first → higher percentile
        pct = 100.0 * (n - 1 - rank) / max(n - 1, 1) if n > 1 else 50.0
        out[i] = pct
    return out


def average_percentile(pcts: list[float | None]) -> float | None:
    valid = [p for p in pcts if p is not None]
    if not valid:
        return None
    return sum(valid) / len(valid)


def composite_from_factor_pcts(
    factor_pcts: dict[str, float | None],
    params: StrategyParams,
    momentum_12m: float | None = None,
    z_score: float | None = None,
) -> tuple[float | None, dict[str, str]]:
    """Return (composite 0–100, grades), or (None, grades) if unscoreable.

    None means "we cannot rate this ticker" — a failed Z-filter, or too little
    factor coverage to be the strategy we claim to be running. Callers must
    treat it as absent rather than as a bad score; `_removal_signals` already
    skips positions with no score, so an unrated holding fails safe.
    """
    grades = {
        name: percentile_to_grade(pct) if pct is not None else "F"
        for name, pct in factor_pcts.items()
    }

    if z_score is not None and z_score < params.z_score_floor:
        return None, grades

    weights = params.factor_weights()
    total_w = 0.0
    score = 0.0
    for name, w in weights.items():
        pct = factor_pcts.get(name)
        if pct is None:
            continue
        score += pct * w
        total_w += w

    if total_w <= 0:
        return None, grades

    # Coverage floor. Renormalising over the surviving factors does not degrade
    # gracefully — it silently redistributes the missing weight onto whatever
    # data happens to exist, so a missing factor reads as better than a bad one.
    # Refuse to rate the ticker instead.
    all_w = sum(weights.values())
    if all_w > 0 and (total_w / all_w) < params.min_factor_coverage:
        return None, grades

    composite = score / total_w
    if momentum_12m is not None and momentum_12m < 0:
        composite -= params.momentum_penalty

    # Quant rating 1.0–5.0 from composite
    return composite, grades


def quant_rating_from_composite(composite: float) -> float:
    """Map 0–100 composite to 1–5 quant rating."""
    return max(1.0, min(5.0, 1.0 + (composite / 100.0) * 4.0))
