"""Lightweight composite scoring helpers (pure)."""

from __future__ import annotations

from math import isnan

from outpick_strategy.grades import percentile_to_grade
from outpick_strategy.params import StrategyParams


def factor_percentile_score(
    values: list[float | None],
    higher_is_better: bool,
) -> list[float | None]:
    """Rank non-null values into 0–100 percentiles within the list.

    Equal values receive an equal percentile. Spreading ties across the range by
    list position invents a ranking out of nothing, and it bites hardest exactly
    where ties are common: a short revisions window leaves most of the universe
    at 0.0% change, which would otherwise be dealt arbitrary grades — and
    revisions carries weight 0.30 and gates every buy.
    """
    # NaN counts as missing. `v is not None` alone let one through: the worker
    # does float(raw) on FMP payloads, so a NaN survives as a genuine float, and
    # every comparison against it is False — it lands wherever the sort happens
    # to leave it, takes a percentile it has no claim to, and then satisfies
    # min_factor_coverage, so the ticker is scored and buyable on data that does
    # not exist. Ordering also stops being reproducible. NaN != NaN is the test.
    indexed = [
        (i, v) for i, v in enumerate(values) if v is not None and not isnan(v)
    ]
    if not indexed:
        return [None] * len(values)

    indexed.sort(key=lambda x: x[1], reverse=higher_is_better)
    n = len(indexed)
    out: list[float | None] = [None] * len(values)

    rank = 0
    while rank < n:
        # Consume the whole run of equal values, then give each the percentile
        # of the run's midpoint.
        end = rank
        while end + 1 < n and indexed[end + 1][1] == indexed[rank][1]:
            end += 1
        if n > 1:
            pct = 100.0 * (n - 1 - (rank + end) / 2.0) / (n - 1)
        else:
            pct = 50.0
        for k in range(rank, end + 1):
            out[indexed[k][0]] = pct
        rank = end + 1
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
