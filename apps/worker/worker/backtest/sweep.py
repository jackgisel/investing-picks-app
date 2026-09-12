"""Perturb numeric thresholds ±10% and report decision diffs vs the canonical run.

Never touches `max_adds_per_evaluation` (always 1) or `position_size_usd`
(canonical $1,000). First §5 experiment candidates are run as named overrides,
not assumed to be better.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS

from app.services.backtest_metrics import decision_diff_table
from worker.backtest.config import BacktestConfig
from worker.backtest.run import run_backtest

# Numeric thresholds that a strategy PR is likely to touch. Bools and the
# sizing/add cap are excluded on purpose.
SWEEP_FIELDS: tuple[str, ...] = (
    "hold_removal_rating",
    "strong_sell_rating",
    "sector_concentration",
    "winner_threshold",
    "weak_signal_threshold",
    "double_buy_min_gain",
    "underwater_qr_threshold",
)

NEVER_SWEEP = frozenset({"max_adds_per_evaluation", "position_size_usd"})

EXPERIMENT_CANDIDATES: tuple[dict[str, Any], ...] = (
    {"name": "min_holding_days_30", "overrides": {"min_holding_days": 30}},
    {"name": "min_holding_days_60", "overrides": {"min_holding_days": 60}},
    {
        "name": "drawdown_breaker_on",
        "overrides": {"enable_drawdown_circuit_breaker": True},
    },
    {"name": "hold_removal_2_7", "overrides": {"hold_removal_rating": 2.7}},
    {"name": "sector_cap_20pct", "overrides": {"sector_concentration": 0.20}},
)

DEFERRED_EXPERIMENTS = (
    {
        "name": "z_score_floor_on",
        "reason": (
            "z_score_floor=1.8 is already the shipped default; the filter runs "
            "when altmanZ exists in the dataset. Not a param flip."
        ),
    },
    {
        "name": "four_window_momentum",
        "reason": (
            "Would change scoring.py (BUG-P7). Bump version_label and do not "
            "re-express momentum outside packages/strategy."
        ),
    },
)


def _perturb(value: float | int, factor: float) -> float | int:
    if isinstance(value, int) and not isinstance(value, bool):
        return int(round(value * factor))
    return type(value)(value * factor)


def run_sweep(
    db: Session,
    cfg: BacktestConfig,
    baseline: dict,
    *,
    skip_hash: bool = True,
) -> dict[str, Any]:
    """Replay with ±10% on each sweep field plus the named experiment list."""
    rows: list[dict[str, Any]] = []
    for field in SWEEP_FIELDS:
        base = getattr(RUN118_PARAMS, field)
        for label, factor in (("minus_10pct", 0.9), ("plus_10pct", 1.1)):
            new_value = _perturb(base, factor)
            if new_value == base:
                rows.append(
                    {
                        "kind": "threshold",
                        "name": f"{field}_{label}",
                        "field": field,
                        "factor": factor,
                        "value": new_value,
                        "skipped": True,
                        "reason": "perturbation did not move the value",
                    }
                )
                continue
            payload = run_backtest(
                db,
                cfg,
                sensitivity=False,
                skip_hash=skip_hash,
                params_overrides={field: new_value},
            )
            diff = decision_diff_table(
                payload.get("diagnostics") or {},
                baseline.get("diagnostics") or {},
            )
            rows.append(
                {
                    "kind": "threshold",
                    "name": f"{field}_{label}",
                    "field": field,
                    "factor": factor,
                    "value": new_value,
                    "skipped": False,
                    "params_version": payload.get("params_version"),
                    **diff,
                }
            )

    experiments: list[dict[str, Any]] = []
    for spec in EXPERIMENT_CANDIDATES:
        blocked = NEVER_SWEEP & spec["overrides"].keys()
        if blocked:
            raise ValueError(f"experiment {spec['name']} touched {sorted(blocked)}")
        payload = run_backtest(
            db,
            cfg,
            sensitivity=False,
            skip_hash=skip_hash,
            params_overrides=spec["overrides"],
        )
        diff = decision_diff_table(
            payload.get("diagnostics") or {},
            baseline.get("diagnostics") or {},
        )
        experiments.append(
            {
                "kind": "experiment",
                "name": spec["name"],
                "overrides": spec["overrides"],
                "params_version": payload.get("params_version"),
                **diff,
            }
        )

    return {
        "canonical_position_size_usd": 1000,
        "max_adds_per_evaluation": 1,
        "n_threshold_runs": len([r for r in rows if not r.get("skipped")]),
        "rows": rows,
        "experiments": experiments,
        "deferred": list(DEFERRED_EXPERIMENTS),
    }


def sweep_markdown(report: dict) -> str:
    lines = [
        "## Threshold sweep (±10%)",
        "",
        f"- Canonical `position_size_usd={report.get('canonical_position_size_usd')}`",
        f"- `max_adds_per_evaluation={report.get('max_adds_per_evaluation')}` (never swept)",
        "",
        "| Run | Top-pick Fridays differ | Mean gate-pass Jaccard |",
        "| --- | --- | --- |",
    ]
    for row in report.get("rows") or []:
        if row.get("skipped"):
            lines.append(f"| `{row['name']}` | skipped | — |")
            continue
        lines.append(
            f"| `{row['name']}` | {row.get('top_pick_fridays_differ')} | "
            f"{row.get('mean_gate_pass_jaccard')} |"
        )
    lines.extend(["", "### Experiment candidates (not assumed)", ""])
    lines.append("| Candidate | Top-pick Fridays differ | Mean gate-pass Jaccard |")
    lines.append("| --- | --- | --- |")
    for row in report.get("experiments") or []:
        lines.append(
            f"| `{row['name']}` | {row.get('top_pick_fridays_differ')} | "
            f"{row.get('mean_gate_pass_jaccard')} |"
        )
    if report.get("deferred"):
        lines.extend(["", "Not swept:", ""])
        for item in report["deferred"]:
            lines.append(f"- `{item['name']}`: {item['reason']}")
        lines.append("")
    return "\n".join(lines)
