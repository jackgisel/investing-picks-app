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
MIN_EVALUATIONS_FOR_HOLDOUT = 48
TRADING_DAYS_PER_YEAR = 252
# Band the run120 QR-floor knob opens. Named after the historical 4.0 floor
# and the product BUY badge (3.5), not the live `min_quant_rating`, so the
# compare table still sizes that band after the default flips.
QR_FLOOR_LEGACY = 4.0
QR_BAND_LOW = 3.5
TOP_N_GATE_FAILS = 25

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
        gate = _gate_readout(ranked, scores, params)
        gate_pass = gate["gate_pass"]
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
                "top_ranked": gate["top_ranked"],
                "top_ranked_qr": gate["top_ranked_qr"],
                "max_qr": gate["max_qr"],
                "gate_pass": gate_pass,
                "n_gate_pass": len(gate_pass),
                "n_scored": len(scores),
                "n_qr_ge_4_0": gate["n_qr_ge_4_0"],
                "n_qr_in_3_5_4_0": gate["n_qr_in_3_5_4_0"],
                "gate_fail_counts": gate["gate_fail_counts"],
                "gate_fail_counts_top25": gate["gate_fail_counts_top25"],
                "score_cards": gate["score_cards"],
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


def holdout_split(
    diagnostics: dict[str, Any],
    *,
    equity_curve: list[dict] | None = None,
    trades: list[ReplayTrade] | None = None,
    spy_closes: dict[date, float] | None = None,
) -> dict[str, Any]:
    """Chronological half/half in-sample vs holdout. Silent until N ≥ 48."""
    fridays = list(diagnostics.get("fridays") or [])
    n = int(diagnostics.get("n_evaluations") or len(fridays))
    if n < MIN_EVALUATIONS_FOR_HOLDOUT or len(fridays) < MIN_EVALUATIONS_FOR_HOLDOUT:
        return {
            "status": "insufficient_sample",
            "n_evaluations": n,
            "min_evaluations": MIN_EVALUATIONS_FOR_HOLDOUT,
            "in_sample": None,
            "out_of_sample": None,
        }
    mid = n // 2
    in_s, oos = fridays[:mid], fridays[mid:]
    payload = {
        "status": "ok",
        "n_evaluations": n,
        "min_evaluations": MIN_EVALUATIONS_FOR_HOLDOUT,
        "in_sample": _holdout_slice(in_s, equity_curve, trades, spy_closes),
        "out_of_sample": _holdout_slice(oos, equity_curve, trades, spy_closes),
    }
    return payload


def _holdout_slice(
    fridays: list[dict[str, Any]],
    equity_curve: list[dict] | None,
    trades: list[ReplayTrade] | None,
    spy_closes: dict[date, float] | None,
) -> dict[str, Any]:
    start = fridays[0]["as_of"]
    end = fridays[-1]["as_of"]
    slice_n = len(fridays)
    out: dict[str, Any] = {
        "n_evaluations": slice_n,
        "start": start,
        "end": end,
        "top_picks": [f.get("top_pick") for f in fridays],
        "n_gate_pass_mean": round(
            sum(int(f.get("n_gate_pass") or 0) for f in fridays) / slice_n, 2
        ),
        "metrics": {
            "status": "insufficient_sample",
            "n_evaluations": slice_n,
            "min_evaluations": MIN_EVALUATIONS_FOR_RETURNS,
        },
    }
    if (
        slice_n >= MIN_EVALUATIONS_FOR_RETURNS
        and equity_curve
        and trades is not None
    ):
        curve = [
            p
            for p in equity_curve
            if start <= str(p.get("date") or "") <= end
        ]
        window_trades = [
            t
            for t in trades
            if start <= t.eval_date.isoformat() <= end
        ]
        out["metrics"] = risk_return_metrics(
            n_evaluations=slice_n,
            equity_curve=curve,
            trades=window_trades,
            spy_closes=spy_closes,
        )
        assert_no_return_metrics(out["metrics"])
    return out


def promotion_gates(n_evaluations: int) -> dict[str, Any]:
    """Which comparison tables are honest at this sample size."""
    return {
        "decision_diff": {
            "status": "ok",
            "n_evaluations": n_evaluations,
            "min_evaluations": 0,
        },
        "returns": {
            "status": (
                "ok"
                if n_evaluations >= MIN_EVALUATIONS_FOR_RETURNS
                else "insufficient_sample"
            ),
            "n_evaluations": n_evaluations,
            "min_evaluations": MIN_EVALUATIONS_FOR_RETURNS,
        },
        "holdout": {
            "status": (
                "ok"
                if n_evaluations >= MIN_EVALUATIONS_FOR_HOLDOUT
                else "insufficient_sample"
            ),
            "n_evaluations": n_evaluations,
            "min_evaluations": MIN_EVALUATIONS_FOR_HOLDOUT,
        },
    }


def decision_diff_table(
    current: dict[str, Any], baseline: dict[str, Any]
) -> dict[str, Any]:
    """Always-valid compare: top picks, Jaccard of gate-pass, rule/trade/holdings."""
    c_days = {f["as_of"]: f for f in current.get("fridays") or []}
    b_days = {f["as_of"]: f for f in baseline.get("fridays") or []}
    dates = sorted(set(c_days) | set(b_days))
    top_pick_differ = 0
    jaccards: list[float] = []
    spearmans: list[float] = []
    friday_rows: list[dict[str, Any]] = []
    for d in dates:
        cf = c_days.get(d) or {}
        bf = b_days.get(d) or {}
        a = set(cf.get("gate_pass") or [])
        b = set(bf.get("gate_pass") or [])
        union = a | b
        jaccard = (len(a & b) / len(union)) if union else 1.0
        jaccards.append(jaccard)
        if cf.get("top_pick") != bf.get("top_pick"):
            top_pick_differ += 1
        c_cards = cf.get("score_cards") or {}
        b_cards = bf.get("score_cards") or {}
        rho = _spearman_qr(_qr_map(c_cards), _qr_map(b_cards))
        if rho is not None:
            spearmans.append(rho)
        admitted = sorted(a - b)
        excluded = sorted(b - a)
        friday_rows.append(
            {
                "as_of": d,
                "top_pick_current": cf.get("top_pick"),
                "top_pick_baseline": bf.get("top_pick"),
                "n_scored_current": cf.get("n_scored"),
                "n_scored_baseline": bf.get("n_scored"),
                "n_gate_pass_current": cf.get("n_gate_pass"),
                "n_gate_pass_baseline": bf.get("n_gate_pass"),
                "top_ranked_current": cf.get("top_ranked"),
                "top_ranked_baseline": bf.get("top_ranked"),
                "top_ranked_qr_current": cf.get("top_ranked_qr"),
                "top_ranked_qr_baseline": bf.get("top_ranked_qr"),
                "max_qr_current": cf.get("max_qr"),
                "max_qr_baseline": bf.get("max_qr"),
                "n_qr_ge_4_0_current": cf.get("n_qr_ge_4_0"),
                "n_qr_in_3_5_4_0_current": cf.get("n_qr_in_3_5_4_0"),
                "gate_fail_counts_current": cf.get("gate_fail_counts") or {},
                "gate_fail_counts_top25_current": cf.get("gate_fail_counts_top25") or {},
                "gate_fail_counts_baseline": bf.get("gate_fail_counts") or {},
                "gate_fail_counts_top25_baseline": bf.get("gate_fail_counts_top25") or {},
                "jaccard": round(jaccard, 4),
                "spearman_qr": round(rho, 4) if rho is not None else None,
                "newly_admitted": _named_cards(admitted, c_cards),
                "newly_excluded": _named_cards(excluded, b_cards or c_cards),
            }
        )
    mean_j = sum(jaccards) / len(jaccards) if jaccards else 1.0
    mean_rho = sum(spearmans) / len(spearmans) if spearmans else None
    return {
        "n_fridays": len(dates),
        "top_pick_fridays_differ": top_pick_differ,
        "mean_gate_pass_jaccard": round(mean_j, 4),
        "mean_spearman_qr": round(mean_rho, 4) if mean_rho is not None else None,
        "end_holdings_current": current.get("end_holdings") or [],
        "end_holdings_baseline": baseline.get("end_holdings") or [],
        "trades_by_action_current": current.get("trades_by_action") or {},
        "trades_by_action_baseline": baseline.get("trades_by_action") or {},
        "rule_counts_current": current.get("rule_counts") or {},
        "rule_counts_baseline": baseline.get("rule_counts") or {},
        "fridays": friday_rows,
    }


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


def _score_card(score: Any) -> dict[str, Any]:
    return {
        "quant_rating": round(float(score.quant_rating), 4),
        "valuation_grade": score.valuation_grade,
        "growth_grade": score.growth_grade,
        "profitability_grade": score.profitability_grade,
        "momentum_grade": score.momentum_grade,
        "revisions_grade": score.revisions_grade,
    }


def _gate_readout(
    ranked: list[str],
    scores: dict,
    params: StrategyParams,
) -> dict[str, Any]:
    fail_all: dict[str, int] = defaultdict(int)
    fail_top25: dict[str, int] = defaultdict(int)
    n_qr_ge_4_0 = 0
    n_qr_in_3_5_4_0 = 0
    gate_pass: list[str] = []
    cards: dict[str, dict[str, Any]] = {}
    for i, ticker in enumerate(ranked):
        snapshot = scores[ticker]
        cards[ticker] = _score_card(snapshot)
        qr = snapshot.quant_rating
        if qr >= QR_FLOOR_LEGACY:
            n_qr_ge_4_0 += 1
        elif qr >= QR_BAND_LOW:
            n_qr_in_3_5_4_0 += 1
        ok, checks = meets_buy_criteria(snapshot, params)
        if ok:
            gate_pass.append(ticker)
        for check in checks:
            if not check.passed:
                fail_all[check.rule_id] += 1
                if i < TOP_N_GATE_FAILS:
                    fail_top25[check.rule_id] += 1
    top = ranked[0] if ranked else None
    top_qr = scores[top].quant_rating if top else None
    max_qr = max((s.quant_rating for s in scores.values()), default=None)
    return {
        "gate_pass": gate_pass,
        "score_cards": cards,
        "gate_fail_counts": dict(sorted(fail_all.items())),
        "gate_fail_counts_top25": dict(sorted(fail_top25.items())),
        "n_qr_ge_4_0": n_qr_ge_4_0,
        "n_qr_in_3_5_4_0": n_qr_in_3_5_4_0,
        "top_ranked": top,
        "top_ranked_qr": round(float(top_qr), 4) if top_qr is not None else None,
        "max_qr": round(float(max_qr), 4) if max_qr is not None else None,
    }


def _qr_map(cards: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for ticker, card in (cards or {}).items():
        if not isinstance(card, dict):
            continue
        qr = card.get("quant_rating")
        if qr is None:
            continue
        out[str(ticker)] = float(qr)
    return out


def _named_cards(tickers: list[str], cards: dict) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for ticker in tickers:
        row: dict[str, Any] = {"ticker": ticker}
        card = (cards or {}).get(ticker) or {}
        if isinstance(card, dict):
            row.update(card)
        rows.append(row)
    return rows


def _average_ranks(values: list[float]) -> list[float]:
    indexed = sorted(enumerate(values), key=lambda iv: iv[1], reverse=True)
    ranks = [0.0] * len(values)
    i = 0
    while i < len(indexed):
        j = i + 1
        while j < len(indexed) and indexed[j][1] == indexed[i][1]:
            j += 1
        avg = (i + 1 + j) / 2.0
        for k in range(i, j):
            ranks[indexed[k][0]] = avg
        i = j
    return ranks


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2 or n != len(ys):
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs)
    dy = sum((y - my) ** 2 for y in ys)
    if dx == 0 and dy == 0:
        return 1.0
    if dx == 0 or dy == 0:
        return None
    return num / math.sqrt(dx * dy)


def _spearman_qr(left: dict[str, float], right: dict[str, float]) -> float | None:
    common = sorted(set(left) & set(right))
    if len(common) < 2:
        return None
    xs = [left[t] for t in common]
    ys = [right[t] for t in common]
    return _pearson(_average_ranks(xs), _average_ranks(ys))


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
