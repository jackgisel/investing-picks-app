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
from collections import Counter, defaultdict
from datetime import date
from typing import Any

from outpick_strategy import StrategyParams
from outpick_strategy.signals import meets_buy_criteria

from app.services.replay import ReplayResult, ReplayTrade

MIN_EVALUATIONS_FOR_RETURNS = 24
MIN_EVALUATIONS_FOR_HOLDOUT = 48
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
    tape_stats_by_date: dict[date, dict] | None = None,
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
        gate_pass: list[str] = []
        fail_counts: dict[str, int] = defaultdict(int)
        for t in ranked:
            ok, checks = meets_buy_criteria(scores[t], params)
            if ok:
                gate_pass.append(t)
                continue
            for check in checks:
                if not check.passed:
                    fail_counts[check.rule_id] += 1
        grade_list = [scores[t].revisions_grade for t in ranked]
        grade_counts = dict(Counter(grade_list).most_common())
        mode = None
        mode_share = None
        if grade_list:
            mode, count = Counter(grade_list).most_common(1)[0]
            mode_share = round(count / len(grade_list), 4)
        qrs = [scores[t].quant_rating for t in ranked]
        tape = (tape_stats_by_date or {}).get(ev.as_of) or {}
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
                "max_qr": round(max(qrs), 3) if qrs else None,
                "top_ranked_qr": round(qrs[0], 3) if qrs else None,
                "n_qr_ge_4_0": sum(1 for q in qrs if q >= 4.0),
                "revisions_grade_counts": grade_counts,
                "revisions_grade_mode": mode,
                "revisions_grade_mode_share": mode_share,
                "gate_fail_counts": dict(sorted(fail_counts.items())),
                "revision_lookback_days": tape.get("revision_lookback_days") or {},
                "n_self_paired": int(tape.get("n_self_paired") or 0),
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
    """Always-valid compare: top picks, Jaccard of gate-pass, rule/trade/holdings.

    Fridays present on only one side are listed explicitly and excluded from
    `top_pick_fridays_differ` so a dropped (unscored) Friday reads as a window
    change, not a pick change.
    """
    c_days = {f["as_of"]: f for f in current.get("fridays") or []}
    b_days = {f["as_of"]: f for f in baseline.get("fridays") or []}
    dates = sorted(set(c_days) | set(b_days))
    only_current = sorted(set(c_days) - set(b_days))
    only_baseline = sorted(set(b_days) - set(c_days))
    shared = sorted(set(c_days) & set(b_days))
    top_pick_differ = 0
    jaccards: list[float] = []
    for d in shared:
        cf = c_days.get(d) or {}
        bf = b_days.get(d) or {}
        a = set(cf.get("gate_pass") or [])
        b = set(bf.get("gate_pass") or [])
        union = a | b
        jaccards.append((len(a & b) / len(union)) if union else 1.0)
        if cf.get("top_pick") != bf.get("top_pick"):
            top_pick_differ += 1
    mean_j = sum(jaccards) / len(jaccards) if jaccards else 1.0
    return {
        "n_fridays": len(dates),
        "n_fridays_shared": len(shared),
        "fridays_only_in_current": only_current,
        "fridays_only_in_baseline": only_baseline,
        "top_pick_fridays_differ": top_pick_differ,
        "mean_gate_pass_jaccard": round(mean_j, 4),
        "end_holdings_current": current.get("end_holdings") or [],
        "end_holdings_baseline": baseline.get("end_holdings") or [],
        "trades_by_action_current": current.get("trades_by_action") or {},
        "trades_by_action_baseline": baseline.get("trades_by_action") or {},
        "rule_counts_current": current.get("rule_counts") or {},
        "rule_counts_baseline": baseline.get("rule_counts") or {},
    }


def compare_payload(result_doc: dict[str, Any]) -> dict[str, Any]:
    """Stable subset used by `backtest compare`. Drops curves and timestamps."""
    return {
        "params_version": result_doc.get("params_version"),
        "dataset_sha256": result_doc.get("dataset_sha256"),
        "tape_version": result_doc.get("tape_version"),
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


RESEARCH_SAMPLE_NOTE = (
    "Short-window research result. Production return metrics stay blank "
    "until 24 evaluations. Annualized volatility multiplies the daily "
    "standard deviation by sqrt(252) and is an extrapolation, not a measured year."
)


def stock_book_returns(equity_curve: list[dict], trades: list[ReplayTrade]) -> list[float]:
    """Flows-adjusted daily returns of capital already invested.

    A buy or sell changes `invested` by about the trade notional. That cash
    flow is removed, so a new $1,000 position is not a return. Days with no
    prior invested capital are skipped (there is nothing to divide by).
    """
    buys: dict[date, float] = defaultdict(float)
    sells: dict[date, float] = defaultdict(float)
    for trade in trades:
        if trade.side == "buy":
            buys[trade.fill_date] += trade.notional
        elif trade.side == "sell":
            sells[trade.fill_date] += trade.notional

    out: list[float] = []
    prev: float | None = None
    for point in equity_curve:
        invested = float(point["invested"])
        day = date.fromisoformat(point["date"])
        if prev is not None and prev > 0:
            pnl = invested - prev - buys.get(day, 0.0) + sells.get(day, 0.0)
            out.append(pnl / prev)
        prev = invested
    return out


def _spy_on_or_before(
    spy_closes: dict[date, float], day: date
) -> tuple[date, float] | None:
    found = [(d, px) for d, px in spy_closes.items() if d <= day and px]
    if not found:
        return None
    return max(found)


def research_window_metrics(
    *,
    equity_curve: list[dict],
    trades: list[ReplayTrade],
    spy_closes: dict[date, float] | None = None,
) -> dict[str, Any]:
    """Stock-book vol and same-dollar SPY P&L for a window under 24 evaluations.

    `status` is `research_short_window`, so `assert_no_return_metrics` does
    not treat these keys as a leaked production claim. The official
    `risk_return_metrics` gate is unchanged.
    """
    stock_rets = stock_book_returns(equity_curve, trades)
    growth = 1.0
    for ret in stock_rets:
        growth *= 1.0 + ret
    stock_return = (growth - 1.0) if stock_rets else None
    daily_stdev = _stdev(stock_rets) if len(stock_rets) >= 2 else None
    annualized = (
        daily_stdev * math.sqrt(TRADING_DAYS_PER_YEAR) if daily_stdev is not None else None
    )

    equity_rets = _daily_returns(equity_curve)
    equity_stdev = _stdev(equity_rets) if len(equity_rets) >= 2 else None
    equity_ann = (
        equity_stdev * math.sqrt(TRADING_DAYS_PER_YEAR) if equity_stdev is not None else None
    )
    first_eq = float(equity_curve[0]["equity"]) if equity_curve else None
    last_point = equity_curve[-1] if equity_curve else None
    last_eq = float(last_point["equity"]) if last_point else None
    ending_invested = float(last_point["invested"]) if last_point else None
    ending_cash = float(last_point["cash"]) if last_point else None
    equity_return = (
        (last_eq / first_eq - 1.0) if first_eq and last_eq is not None else None
    )

    net = 0.0
    for trade in trades:
        if trade.side == "buy":
            net += trade.notional
        elif trade.side == "sell":
            net -= trade.notional
    picks_pnl = (ending_invested - net) if ending_invested is not None else None

    spy_block = _spy_matched_pnl(
        trades, spy_closes or {}, equity_curve, picks_pnl=picks_pnl, net=net
    )

    return {
        "status": "research_short_window",
        "note": RESEARCH_SAMPLE_NOTE,
        "min_evaluations_for_production": MIN_EVALUATIONS_FOR_RETURNS,
        "stock_book": {
            "n_return_days": len(stock_rets),
            "return_pct": _pct(stock_return),
            "daily_stdev_pct": _pct(daily_stdev),
            "annualized_vol_pct": _pct(annualized),
            "annualized_vol_is_extrapolation": True,
        },
        "total_equity": {
            "cash_dominated": True,
            "note": (
                "Starting cash is $50,000 and each pick is $1,000, so this "
                "volatility is mostly uninvested cash. It does not test the "
                "thesis that a larger stock book is less volatile."
            ),
            "return_pct": _pct(equity_return),
            "daily_stdev_pct": _pct(equity_stdev),
            "annualized_vol_pct": _pct(equity_ann),
            "ending_equity": round(last_eq, 2) if last_eq is not None else None,
            "ending_invested": round(ending_invested, 2) if ending_invested is not None else None,
            "ending_cash": round(ending_cash, 2) if ending_cash is not None else None,
        },
        "spy": spy_block,
    }


def _spy_matched_pnl(
    trades: list[ReplayTrade],
    spy_closes: dict[date, float],
    equity_curve: list[dict],
    *,
    picks_pnl: float | None,
    net: float,
) -> dict[str, Any]:
    """Buy and sell SPY with each fill's notional, then mark both books to the end."""
    if not equity_curve:
        return {
            "status": "no_equity_curve",
            "picks_pnl": None,
            "spy_pnl": None,
            "alpha_pnl": None,
            "net_contribution": round(net, 2),
            "missing_dates": [],
        }
    end = date.fromisoformat(equity_curve[-1]["date"])
    end_spy = _spy_on_or_before(spy_closes, end)
    missing: list[str] = []
    shares = 0.0
    spy_net = 0.0
    for trade in trades:
        if trade.side not in ("buy", "sell"):
            continue
        found = _spy_on_or_before(spy_closes, trade.fill_date)
        if found is None:
            missing.append(trade.fill_date.isoformat())
            continue
        _, px = found
        qty = trade.notional / px
        if trade.side == "buy":
            shares += qty
            spy_net += trade.notional
        else:
            shares -= qty
            spy_net -= trade.notional

    picks = round(picks_pnl, 2) if picks_pnl is not None else None
    if missing or end_spy is None:
        return {
            "status": "missing_spy",
            "picks_pnl": picks,
            "spy_pnl": None,
            "alpha_pnl": None,
            "net_contribution": round(net, 2),
            "missing_dates": missing or [end.isoformat()],
        }
    spy_value = shares * end_spy[1]
    spy_pnl = spy_value - spy_net
    alpha = None if picks_pnl is None else picks_pnl - spy_pnl
    return {
        "status": "ok",
        "picks_pnl": picks,
        "spy_pnl": round(spy_pnl, 2),
        "alpha_pnl": round(alpha, 2) if alpha is not None else None,
        "net_contribution": round(net, 2),
        "spy_mark_date": end_spy[0].isoformat(),
        "missing_dates": [],
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
