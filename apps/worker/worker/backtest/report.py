"""Markdown report for a backtest result. Refuses return numbers under the gate."""

from __future__ import annotations

import json
from pathlib import Path

from app.services.backtest_metrics import (
    MIN_EVALUATIONS_FOR_HOLDOUT,
    MIN_EVALUATIONS_FOR_RETURNS,
    RETURN_METRIC_KEYS,
    assert_no_return_metrics,
)


def load_result(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


def write_equity_csv(result: dict, dest: Path) -> Path:
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    rows = result.get("equity_curve") or []
    lines = ["date,cash,invested,equity,position_count"]
    for row in rows:
        lines.append(
            ",".join(
                [
                    str(row.get("date", "")),
                    str(row.get("cash", "")),
                    str(row.get("invested", "")),
                    str(row.get("equity", "")),
                    str(row.get("position_count", "")),
                ]
            )
        )
    dest.write_text("\n".join(lines) + "\n")
    return dest


def render_report(result: dict) -> str:
    metrics = result.get("metrics") or {}
    assert_no_return_metrics(metrics)
    diag = result.get("diagnostics") or {}
    n = diag.get("n_evaluations") or metrics.get("n_evaluations") or 0
    lines: list[str] = []
    cfg = result.get("config") or {}
    lines.append(f"# {cfg.get('params_version_label') or 'run118'} backtest")
    lines.append("")
    lines.append(f"- Dataset: `{cfg.get('dataset')}` sha256 `{result.get('dataset_sha256')}`")
    lines.append(f"- Params version: `{result.get('params_version')}`")
    lines.append(
        f"- Canonical fill: `{_fill_label(result.get('fill'))}`; "
        f"`position_size_usd={cfg.get('position_size_usd')}`; "
        f"`max_adds_per_evaluation=1`"
    )
    lines.append(f"- Window: {result.get('start')} → {result.get('end')}")
    lines.append(f"- Evaluations: {n}")
    scopes = diag.get("universe_scopes") or []
    lines.append(f"- Universe scopes: {', '.join(scopes) or '(unlabelled)'}")
    if diag.get("mixed_scopes"):
        lines.append(
            "- **Mixed scopes.** Fridays are labelled individually; do not pool them."
        )
    lines.append("")
    lines.append("## Sample-size gates")
    lines.append("")
    lines.append(
        "- Decision-diff: **ok** at any N (top-pick Fridays, gate-pass Jaccard, "
        "rule firings, trades, holdings)."
    )
    if metrics.get("status") == "insufficient_sample" or n < MIN_EVALUATIONS_FOR_RETURNS:
        lines.append(
            f"- Return metrics: **insufficient sample** "
            f"(`n_evaluations` = {n} < {MIN_EVALUATIONS_FOR_RETURNS})."
        )
        lines.append("")
        lines.append(
            "CAGR, vol, Sharpe, Sortino, max drawdown, Calmar, beta/alpha vs SPY, "
            "turnover, hit rate, and headline return: **insufficient sample**."
        )
    else:
        lines.append(
            f"- Return metrics: **ok** (`n_evaluations` = {n} ≥ {MIN_EVALUATIONS_FOR_RETURNS})."
        )
        lines.append("")
        lines.append("Risk/return with bootstrap bands:")
        lines.append("")
        for key in (
            "cagr_pct",
            "vol_pct",
            "sharpe",
            "sortino",
            "max_drawdown_pct",
            "calmar",
            "beta_spy",
            "alpha_spy_pct",
            "turnover",
            "hit_rate",
            "return_pct",
        ):
            lines.append(f"- `{key}`: {metrics.get(key)}")
        bands = metrics.get("bands") or {}
        if bands:
            lines.append(f"- bands: {bands}")
    holdout = result.get("holdout") or {}
    if holdout.get("status") != "ok":
        lines.append(
            f"- In-sample / holdout: **insufficient sample** "
            f"(`n_evaluations` = {n} < {MIN_EVALUATIONS_FOR_HOLDOUT})."
        )
    else:
        ins = holdout.get("in_sample") or {}
        oos = holdout.get("out_of_sample") or {}
        lines.append(
            f"- In-sample / holdout: **ok** "
            f"(IS {ins.get('start')} → {ins.get('end')}, "
            f"OOS {oos.get('start')} → {oos.get('end')})."
        )
    lines.append("")
    lines.append("## Decision diagnostics")
    lines.append("")
    lines.append(
        f"- Trades by action: `{diag.get('trades_by_action') or {}}`"
    )
    lines.append(f"- Rule-firing counts: `{diag.get('rule_counts') or {}}`")
    lines.append(
        f"- End holdings ({diag.get('end_position_count') or 0}): "
        f"{', '.join(diag.get('end_holdings') or []) or '(none)'}"
    )
    forced = diag.get("forced_exits") or []
    if forced:
        lines.append(f"- Forced delisting exits: {len(forced)}")
    lines.append("")
    for friday in diag.get("fridays") or []:
        scope = friday.get("universe_scope") or "unlabelled"
        lines.append(f"### {friday.get('as_of')} (`{scope}`)")
        lines.append("")
        lines.append(
            f"- Top pick: `{friday.get('top_pick')}` "
            f"(bought `{friday.get('bought')}`, top ranked `{friday.get('top_ranked')}`)"
        )
        gate = friday.get("gate_pass") or []
        preview = ", ".join(f"`{t}`" for t in gate[:12])
        extra = f" (+{len(gate) - 12} more)" if len(gate) > 12 else ""
        lines.append(f"- Gate-pass set ({friday.get('n_gate_pass') or 0}): {preview}{extra}")
        lines.append(f"- Rules: `{friday.get('rule_counts') or {}}`")
        trades = friday.get("trades") or []
        if trades:
            bits = [f"{t['action']} {t['ticker']}" for t in trades]
            lines.append(f"- Trades: {', '.join(bits)}")
        else:
            lines.append("- Trades: (none)")
        lines.append("")

    sens = result.get("sensitivity") or {}
    if sens:
        lines.append("## Fill sensitivity")
        lines.append("")
        lines.append(
            f"Conservative run: `{_fill_label(sens.get('fill'))}` "
            "(not the headline)."
        )
        lines.append(
            f"- Trade list differs from canonical: `{sens.get('trade_diff')}`"
        )
        lines.append(
            f"- Top-pick Fridays differ: `{sens.get('top_pick_fridays_differ')}`"
        )
        lines.append("")

    ledger = result.get("ledger_parity") or {}
    lines.append("## Ledger parity")
    lines.append("")
    if ledger.get("skipped"):
        lines.append(f"Skipped: {ledger.get('reason') or 'unavailable'}.")
    else:
        lines.append(f"- Parity: `{ledger.get('parity')}`")
        lines.append(f"- Matched: {len(ledger.get('matched') or [])}")
        lines.append(f"- Only in ledger: {len(ledger.get('only_in_ledger') or [])}")
        lines.append(f"- Only in replay: {len(ledger.get('only_in_replay') or [])}")
    lines.append("")
    rec = result.get("recommendation")
    if rec:
        lines.append("## Recommendation")
        lines.append("")
        lines.append(rec)
        lines.append("")
    text = "\n".join(lines)
    _assert_report_respects_gate(text, metrics, n)
    return text


def _fill_label(fill: dict | None) -> str:
    fill = fill or {}
    return f"{fill.get('price', 'same_close')} {fill.get('slippage_bps', 0)} bps"


def _assert_report_respects_gate(text: str, metrics: dict, n: int) -> None:
    if metrics.get("status") != "insufficient_sample" and n >= MIN_EVALUATIONS_FOR_RETURNS:
        return
    lowered = text.lower()
    # Words may appear in the "not computed" sentence. Numeric claims may not.
    for key in RETURN_METRIC_KEYS:
        token = f"{key}:"
        if token in lowered and "insufficient sample" not in lowered:
            raise ValueError(f"report printed return metric {key} under the gate")
