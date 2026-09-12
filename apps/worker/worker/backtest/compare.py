"""Compare two backtest result JSON files.

Exit 0 if the compare payload matches.
Exit 1 if params+dataset hashes match but diagnostics/metrics/trades differ
(a determinism/regression failure).
Exit 2 if params_version or dataset hash changed and the baseline was not
regenerated in the same change (same discipline as the golden evaluate snapshot).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.services.backtest_metrics import compare_payload, decision_diff_table


def load_result(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


def compare_results(
    current: dict, baseline: dict, *, update_baseline: bool = False
) -> dict[str, Any]:
    left = current.get("compare") or compare_payload(current)
    right = baseline.get("compare") or compare_payload(baseline)
    diffs = _diff(left, right, path="$")
    same_strategy = left.get("params_version") == right.get("params_version")
    same_data = left.get("dataset_sha256") == right.get("dataset_sha256")
    if not diffs:
        status = "match"
        exit_code = 0
    elif same_strategy and same_data:
        status = "determinism_failure"
        exit_code = 1
    else:
        status = "baseline_stale"
        exit_code = 2
    if update_baseline:
        status = "update_baseline"
        exit_code = 0
    table = decision_diff_table(
        (current.get("diagnostics") or {}),
        (baseline.get("diagnostics") or {}),
    )
    return {
        "status": status,
        "exit_code": exit_code,
        "same_strategy": same_strategy,
        "same_data": same_data,
        "n_diffs": len(diffs),
        "diffs": diffs[:50],
        "decision_diff": table,
        "params_version": {"current": left.get("params_version"), "baseline": right.get("params_version")},
        "dataset_sha256": {
            "current": left.get("dataset_sha256"),
            "baseline": right.get("dataset_sha256"),
        },
    }


def summary_markdown(report: dict) -> str:
    lines = [
        "## Backtest compare",
        "",
        f"- Status: `{report['status']}`",
        f"- Params: current `{report['params_version']['current']}` / "
        f"baseline `{report['params_version']['baseline']}`",
        f"- Dataset: current `{_short(report['dataset_sha256']['current'])}` / "
        f"baseline `{_short(report['dataset_sha256']['baseline'])}`",
        f"- Diffs: {report['n_diffs']}",
        "",
    ]
    table = report.get("decision_diff") or {}
    if table:
        lines.extend(
            [
                "### Decision-diff (valid at any N)",
                "",
                f"- Top-pick Fridays that differ: {table.get('top_pick_fridays_differ')}",
                f"- Mean gate-pass Jaccard: {table.get('mean_gate_pass_jaccard')}",
                f"- End holdings current: `{table.get('end_holdings_current')}`",
                f"- End holdings baseline: `{table.get('end_holdings_baseline')}`",
                "",
            ]
        )
    if report["status"] == "baseline_stale":
        lines.append(
            "Strategy or dataset changed. Regenerate `backtests/baselines/run118.json` "
            "in this PR (`UPDATE_BASELINE=1`)."
        )
        lines.append("")
    if report["diffs"]:
        lines.append("| Path | Current | Baseline |")
        lines.append("| --- | --- | --- |")
        for d in report["diffs"][:20]:
            lines.append(
                f"| `{d['path']}` | `{_cell(d.get('current'))}` | `{_cell(d.get('baseline'))}` |"
            )
        lines.append("")
    return "\n".join(lines)


def _short(value: str | None) -> str:
    if not value:
        return "-"
    return value[:12]


def _cell(value: Any) -> str:
    text = json.dumps(value, default=str) if not isinstance(value, str) else value
    if len(text) > 80:
        return text[:77] + "..."
    return text


def _diff(left: Any, right: Any, path: str) -> list[dict]:
    if type(left) is not type(right) and not (
        isinstance(left, (int, float)) and isinstance(right, (int, float))
    ):
        return [{"path": path, "current": left, "baseline": right}]
    if isinstance(left, dict):
        out: list[dict] = []
        keys = sorted(set(left) | set(right))
        for k in keys:
            if k not in left:
                out.append({"path": f"{path}.{k}", "current": None, "baseline": right[k]})
            elif k not in right:
                out.append({"path": f"{path}.{k}", "current": left[k], "baseline": None})
            else:
                out.extend(_diff(left[k], right[k], f"{path}.{k}"))
        return out
    if isinstance(left, list):
        if len(left) != len(right):
            return [
                {
                    "path": path,
                    "current": f"len={len(left)}",
                    "baseline": f"len={len(right)}",
                }
            ]
        out = []
        for i, (a, b) in enumerate(zip(left, right)):
            out.extend(_diff(a, b, f"{path}[{i}]"))
        return out
    if left != right:
        return [{"path": path, "current": left, "baseline": right}]
    return []
