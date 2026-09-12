"""Backtest diagnostics and sample-size-gated risk/return metrics.

Pure: no I/O. Callers supply a `ReplayResult` plus the scores/membership that
were visible on each evaluation Friday. Buy-gate membership uses
`meets_buy_criteria` from `packages/strategy` — the same function `evaluate()`
uses — so this module does not re-express strategy rules.

Return metrics (CAGR, vol, Sharpe, Sortino, max DD, Calmar, beta/alpha vs SPY,
turnover, hit rate, headline return) exist only when `n_evaluations >= 24`.
Below that the dict carries `status=insufficient_sample` and none of those
keys. The report renderer must not invent them.
"""

from __future__ import annotations

import math
import random
from collections import defaultdict
from datetime import date
from typing import Any

from outpick_strategy import StrategyParams
from outpick_strategy.signals import meets_buy_criteria

from app.services.replay import ReplayResult, ReplayTrade

MIN_EVALUATIONS_FOR_RETURNS = 24
TRADING_DAYS_PER_YEAR = 252

# Keys that constitute a performance claim. None of these may appear on a
# payload or in a report while n_evaluations < MIN_EVALUATIONS_FOR_RETURNS.
RETURN_METRIC_KEYS = frozenset(
    {
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
        "bands",
        "starting_equity",
        "ending_equity",
        "annualized_return_pct",
    }
)


def decision_diagnostics(
    result: ReplayResult,
    *,
    params: StrategyParams,
    scores_by_date: dict[date, dict],
    universe_scope_by_date: dict[date, str],
) -> dict[str, Any]:
    """Per-Friday decisions. Valid at any N, including N = 4."""
    rule_totals: dict[str, int] = defaultdict(int)
    trades_by_action: dict[str, int] = defaultdict(int)
    fridays: list[dict[str, Any]] = []
    scopes: set[str] = set()

    for ev in result.evaluations:
        scores = scores_by_date.get(ev.as_of) or {}
        ranked = sorted(
            scores.keys(),
            key=lambda t: scores[t].quant_rating,
            reverse=True,
        )
        gate_pass = [
            t for t in ranked if meets_buy_criteria(scores[t], params)[0]
        ]
        bought = next(
            (t.ticker for t in ev.trades if t.side == "buy"),
            None,
        )
        if bought is None:
            bought = next(
                (
                    s.ticker
                    for s in ev.signals
                    if s.action.value in ("buy", "double_buy")
                ),
                None,
            )
        day_rules: dict[str, int] = defaultdict(int)
        for sig in ev.signals:
            for check in sig.rules:
                if check.passed:
                    day_rules[check.rule_id] += 1
                    rule_totals[check.rule_id] += 1
        forced = [t.ticker for t in ev.trades if t.reason.startswith("delisted")]
        for t in ev.trades:
            trades_by_action[t.action] += 1
        scope = universe_scope_by_date.get(ev.as_of)
        if scope:
            scopes.add(scope)
        fridays.append(
            {
                "as_of": ev.as_of.isoformat(),
                "universe_scope": scope,
                "top_pick": bought or (gate_pass[0] if gate_pass else None),
                "bought": bought,
                "top_ranked": ranked[0] if ranked else None,
                "gate_pass": gate_pass,
                "n_gate_pass": len(gate_pass),
                "n_scored": len(scores),
                "rule_counts": dict(sorted(day_rules.items())),
                "trades": [t.to_dict() for t in ev.trades],
                "forced_exits": forced,
                "signals": [
                    {
                        "action": s.action.value,
                        "ticker": s.ticker,
                        "reason": s.reason,
                        "rules": [r.rule_id for r in s.rules if r.passed],
                    }
                    for s in ev.signals
                ],
                "holdings_after": sorted(ev.after.get("positions", {}).keys()),
            }
        )

    for t in result.forced_exits:
        trades_by_action[t.action] += 1

    mixed_scopes = len(scopes) > 1
    return {
        "n_evaluations": len(result.evaluations),
        "universe_scopes": sorted(scopes),
        "mixed_scopes": mixed_scopes,
        "trades_by_action": dict(sorted(trades_by_action.items())),
        "rule_counts": dict(sorted(rule_totals.items())),
        "end_holdings": sorted(result.final.positions.keys()),
        "end_position_count": len(result.final.positions),
        "forced_exits": (
            [t.to_dict() for ev in result.evaluations for t in ev.trades if t.reason.startswith("delisted")]
            + [t.to_dict() for t in result.forced_exits]
        ),
        "fridays": fridays,
    }


def risk_return_metrics(
    *,
    n_evaluations: int,
    equity_curve: list[dict],
    trades: list[ReplayTrade],
    spy_closes: dict[date, float] | None = None,
    rng_seed: int = 118,
) -> dict[str, Any]:
    """Risk/return block. Empty of return keys when the sample is too small."""
    if n_evaluations < MIN_EVALUATIONS_FOR_RETURNS:
        return {
            "status": "insufficient_sample",
            "n_evaluations": n_evaluations,
            "min_evaluations": MIN_EVALUATIONS_FOR_RETURNS,
        }

    daily = _daily_returns(equity_curve)
    if len(equity_curve) < 2 or not daily:
        return {
            "status": "insufficient_sample",
            "n_evaluations": n_evaluations,
            "min_evaluations": MIN_EVALUATIONS_FOR_RETURNS,
            "reason": "equity_curve_too_short",
        }

    first = equity_curve[0]["equity"]
    last = equity_curve[-1]["equity"]
    start_d = date.fromisoformat(equity_curve[0]["date"])
    end_d = date.fromisoformat(equity_curve[-1]["date"])
    days = max(1, (end_d - start_d).days)
    total_return = (last / first - 1.0) if first else 0.0
    cagr = (last / first) ** (365.0 / days) - 1.0 if first and last > 0 else 0.0
    vol = _stdev(daily) * math.sqrt(TRADING_DAYS_PER_YEAR)
    mean_d = sum(daily) / len(daily)
    sharpe = (mean_d * TRADING_DAYS_PER_YEAR / vol) if vol else None
    downside = [r for r in daily if r < 0]
    down_dev = _stdev(downside) * math.sqrt(TRADING_DAYS_PER_YEAR) if downside else 0.0
    sortino = (mean_d * TRADING_DAYS_PER_YEAR / down_dev) if down_dev else None
    max_dd = _max_drawdown(equity_curve)
    calmar = (cagr / abs(max_dd)) if max_dd else None
    turnover = _turnover(trades, equity_curve)
    hit_rate = _hit_rate(trades)

    spy_beta = None
    spy_alpha = None
    if spy_closes:
        spy_r = _aligned_spy_returns(equity_curve, spy_closes)
        if spy_r and len(spy_r) == len(daily):
            spy_beta = _beta(daily, spy_r)
            spy_mean = sum(spy_r) / len(spy_r)
            if spy_beta is not None:
                spy_alpha = (mean_d - spy_beta * spy_mean) * TRADING_DAYS_PER_YEAR

    payload = {
        "status": "ok",
        "n_evaluations": n_evaluations,
        "min_evaluations": MIN_EVALUATIONS_FOR_RETURNS,
        "cagr_pct": _pct(cagr),
        "vol_pct": _pct(vol),
        "sharpe": _round(sharpe, 3),
        "sortino": _round(sortino, 3),
        "max_drawdown_pct": _pct(max_dd),
        "calmar": _round(calmar, 3),
        "beta_spy": _round(spy_beta, 3),
        "alpha_spy_pct": _pct(spy_alpha) if spy_alpha is not None else None,
        "turnover": _round(turnover, 4),
        "hit_rate": _round(hit_rate, 4),
        "return_pct": _pct(total_return),
        "starting_equity": round(first, 2),
        "ending_equity": round(last, 2),
        "bands": _bootstrap_bands(daily, rng_seed=rng_seed),
    }
    return payload


def assert_no_return_metrics(metrics: dict[str, Any]) -> None:
    """Raise if a below-gate payload leaked a performance number."""
    if metrics.get("status") != "insufficient_sample":
        return
    leaked = sorted(k for k in RETURN_METRIC_KEYS if k in metrics)
    if leaked:
        raise ValueError(f"return metrics leaked under the N≥24 gate: {leaked}")


def compare_payload(result_doc: dict[str, Any]) -> dict[str, Any]:
    """Stable subset used by `backtest compare`. Drops curves and timestamps."""
    return {
        "params_version": result_doc.get("params_version"),
        "dataset_sha256": result_doc.get("dataset_sha256"),
        "fill": result_doc.get("fill"),
        "start": result_doc.get("start"),
        "end": result_doc.get("end"),
        "diagnostics": result_doc.get("diagnostics"),
        "metrics": result_doc.get("metrics"),
        "trades": result_doc.get("trades"),
        "sensitivity": {
            "fill": (result_doc.get("sensitivity") or {}).get("fill"),
            "trades": (result_doc.get("sensitivity") or {}).get("trades"),
            "diagnostics": {
                "n_evaluations": ((result_doc.get("sensitivity") or {}).get("diagnostics") or {}).get(
                    "n_evaluations"
                ),
                "trades_by_action": ((result_doc.get("sensitivity") or {}).get("diagnostics") or {}).get(
                    "trades_by_action"
                ),
                "end_holdings": ((result_doc.get("sensitivity") or {}).get("diagnostics") or {}).get(
                    "end_holdings"
                ),
            },
        },
    }


def _daily_returns(curve: list[dict]) -> list[float]:
    out: list[float] = []
    prev = None
    for point in curve:
        eq = point["equity"]
        if prev and prev > 0:
            out.append(eq / prev - 1.0)
        prev = eq
    return out


def _stdev(xs: list[float]) -> float:
    if len(xs) < 2:
        return 0.0
    mean = sum(xs) / len(xs)
    var = sum((x - mean) ** 2 for x in xs) / (len(xs) - 1)
    return math.sqrt(var)


def _max_drawdown(curve: list[dict]) -> float:
    peak = None
    worst = 0.0
    for point in curve:
        eq = point["equity"]
        if peak is None or eq > peak:
            peak = eq
        if peak and peak > 0:
            worst = min(worst, (eq - peak) / peak)
    return worst


def _turnover(trades: list[ReplayTrade], curve: list[dict]) -> float | None:
    if not curve:
        return None
    avg_eq = sum(p["equity"] for p in curve) / len(curve)
    if avg_eq <= 0:
        return None
    notional = sum(abs(t.notional) for t in trades)
    return notional / avg_eq


def _hit_rate(trades: list[ReplayTrade]) -> float | None:
    """Round-trips: a sell following a buy of the same ticker, PnL vs that buy."""
    lots: dict[str, list[tuple[float, float]]] = defaultdict(list)
    wins = 0
    rounds = 0
    for t in trades:
        if t.side == "buy":
            lots[t.ticker].append((t.shares, t.price))
            continue
        remaining = t.shares
        while remaining > 1e-9 and lots[t.ticker]:
            shares, cost = lots[t.ticker][0]
            take = min(shares, remaining)
            pnl = (t.price - cost) * take
            rounds += 1
            if pnl > 0:
                wins += 1
            remaining -= take
            if take >= shares - 1e-9:
                lots[t.ticker].pop(0)
            else:
                lots[t.ticker][0] = (shares - take, cost)
    if rounds == 0:
        return None
    return wins / rounds


def _aligned_spy_returns(
    curve: list[dict], spy_closes: dict[date, float]
) -> list[float] | None:
    rets: list[float] = []
    prev_eq = None
    prev_spy = None
    for point in curve:
        d = date.fromisoformat(point["date"])
        spy = spy_closes.get(d)
        if prev_eq and prev_spy and prev_spy > 0 and spy:
            rets.append(spy / prev_spy - 1.0)
        elif prev_eq:
            return None
        prev_eq = point["equity"]
        if spy:
            prev_spy = spy
    return rets


def _beta(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) != len(ys) or len(xs) < 2:
        return None
    mx = sum(xs) / len(xs)
    my = sum(ys) / len(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (len(xs) - 1)
    var = sum((y - my) ** 2 for y in ys) / (len(ys) - 1)
    if var == 0:
        return None
    return cov / var


def _bootstrap_bands(
    daily: list[float], *, rng_seed: int, n: int = 1000, ci: float = 0.9
) -> dict[str, dict[str, float | None]]:
    """Percentile bands on CAGR-from-resampled-dailies, Sharpe, max DD of the path."""
    rng = random.Random(rng_seed)
    nobs = len(daily)
    cagrs: list[float] = []
    sharpes: list[float] = []
    for _ in range(n):
        sample = [daily[rng.randrange(nobs)] for _ in range(nobs)]
        total = 1.0
        for r in sample:
            total *= 1.0 + r
        cagrs.append(total ** (TRADING_DAYS_PER_YEAR / nobs) - 1.0 if total > 0 else 0.0)
        vol = _stdev(sample) * math.sqrt(TRADING_DAYS_PER_YEAR)
        mean_d = sum(sample) / nobs
        sharpes.append((mean_d * TRADING_DAYS_PER_YEAR / vol) if vol else 0.0)
    return {
        "cagr_pct": _percentile_band(cagrs, ci, pct=True),
        "sharpe": _percentile_band(sharpes, ci, pct=False),
    }


def _percentile_band(xs: list[float], ci: float, *, pct: bool) -> dict[str, float | None]:
    if not xs:
        return {"low": None, "high": None}
    xs = sorted(xs)
    lo_i = max(0, int(round((1.0 - ci) / 2.0 * (len(xs) - 1))))
    hi_i = min(len(xs) - 1, int(round((1.0 + ci) / 2.0 * (len(xs) - 1))))
    lo, hi = xs[lo_i], xs[hi_i]
    if pct:
        return {"low": _pct(lo), "high": _pct(hi)}
    return {"low": _round(lo, 3), "high": _round(hi, 3)}


def _pct(x: float | None) -> float | None:
    if x is None:
        return None
    return round(x * 100.0, 2)


def _round(x: float | None, ndigits: int) -> float | None:
    if x is None:
        return None
    return round(x, ndigits)
