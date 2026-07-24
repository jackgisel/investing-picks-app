"""Pure portfolio evaluation — shared by live worker and backtest.

Hard rule: no I/O. Callers supply PortfolioState + scores.
"""

from __future__ import annotations

from datetime import date

from outpick_strategy.grades import grade_meets_minimum
from outpick_strategy.params import StrategyParams
from outpick_strategy.types import (
    Action,
    PortfolioState,
    PositionState,
    RuleCheck,
    ScoreSnapshot,
    Signal,
)


def meets_buy_criteria(score: ScoreSnapshot, params: StrategyParams) -> tuple[bool, list[RuleCheck]]:
    c = params.buy_criteria
    checks = [
        RuleCheck(
            rule_id="min_quant_rating",
            passed=score.quant_rating >= c.min_quant_rating,
            inputs={"quant_rating": score.quant_rating},
            threshold={"min": c.min_quant_rating},
        ),
        RuleCheck(
            rule_id="min_revisions_grade",
            passed=grade_meets_minimum(score.revisions_grade, c.min_revisions_grade),
            inputs={"revisions_grade": score.revisions_grade},
            threshold={"min": c.min_revisions_grade},
        ),
        RuleCheck(
            rule_id="min_growth_grade",
            passed=grade_meets_minimum(score.growth_grade, c.min_growth_grade),
            inputs={"growth_grade": score.growth_grade},
            threshold={"min": c.min_growth_grade},
        ),
        RuleCheck(
            rule_id="min_profitability_grade",
            passed=grade_meets_minimum(score.profitability_grade, c.min_profitability_grade),
            inputs={"profitability_grade": score.profitability_grade},
            threshold={"min": c.min_profitability_grade},
        ),
        RuleCheck(
            rule_id="min_valuation_grade",
            passed=grade_meets_minimum(score.valuation_grade, c.min_valuation_grade),
            inputs={"valuation_grade": score.valuation_grade},
            threshold={"min": c.min_valuation_grade},
        ),
    ]
    return all(ch.passed for ch in checks), checks


def _would_exceed_sector_cap(
    ticker: str,
    sector: str | None,
    held: set[str],
    scores: dict[str, ScoreSnapshot],
    positions: dict[str, PositionState],
    params: StrategyParams,
) -> bool:
    if not sector:
        return False
    max_in_sector = int(params.max_positions * params.sector_concentration)
    count = 0
    for t in held:
        s = scores.get(t)
        pos_sector = (s.sector if s else None) or (
            positions[t].sector if t in positions else None
        )
        if pos_sector == sector:
            count += 1
    return count >= max_in_sector


def _weight_trim_signals(
    portfolio: PortfolioState, params: StrategyParams
) -> list[Signal]:
    equity = portfolio.equity
    if equity <= 0:
        return []

    signals: list[Signal] = []
    for pos in portfolio.positions.values():
        weight = pos.market_value / equity
        if pos.is_house_money:
            cap = params.position_cap_house_money
            target = params.position_trim_house_money
        else:
            cap = params.position_cap_normal
            target = params.position_trim_target

        if weight > cap and pos.current_price > 0:
            target_value = equity * target
            trim_shares = (pos.market_value - target_value) / pos.current_price
            if trim_shares > 0.01:
                signals.append(
                    Signal(
                        action=Action.TRIM,
                        ticker=pos.ticker,
                        sell_shares=trim_shares,
                        reason=f"Trim{' (house money)' if pos.is_house_money else ''}: "
                        f"{weight * 100:.0f}% → {target * 100:.0f}%",
                        rules=[
                            RuleCheck(
                                rule_id="position_weight_cap",
                                passed=True,
                                inputs={
                                    "weight": round(weight, 4),
                                    "is_house_money": pos.is_house_money,
                                },
                                threshold={"cap": cap, "target": target},
                            )
                        ],
                    )
                )
    return signals


def _removal_signals(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams,
    as_of: date,
) -> list[Signal]:
    signals: list[Signal] = []

    for pos in portfolio.positions.values():
        score = scores.get(pos.ticker)
        if not score:
            continue

        qr = score.quant_rating
        gain = pos.gain_pct
        is_winner = gain >= params.winner_threshold

        # Optional QR velocity
        if (
            params.enable_qr_velocity
            and score.prior_quant_rating is not None
            and (qr - score.prior_quant_rating) < -params.qr_velocity_drop
        ):
            delta = qr - score.prior_quant_rating
            signals.append(
                Signal(
                    action=Action.FULL_SELL,
                    ticker=pos.ticker,
                    reason=f"QR velocity sell (QR {score.prior_quant_rating:.1f} → {qr:.1f})",
                    score=score,
                    rules=[
                        RuleCheck(
                            rule_id="qr_velocity",
                            passed=True,
                            inputs={"delta": round(delta, 2), "qr": qr},
                            threshold={"drop": -params.qr_velocity_drop},
                        )
                    ],
                )
            )
            continue

        # Underwater stop
        if pos.entry_date and pos.avg_cost and pos.current_price < pos.avg_cost:
            days_held = (as_of - pos.entry_date).days
            if (
                days_held > params.max_underwater_days
                and qr < params.underwater_qr_threshold
            ):
                signals.append(
                    Signal(
                        action=Action.FULL_SELL,
                        ticker=pos.ticker,
                        reason=f"Underwater stop ({days_held}d, QR {qr:.1f}, {gain * 100:.0f}%)",
                        score=score,
                        rules=[
                            RuleCheck(
                                rule_id="underwater_stop",
                                passed=True,
                                inputs={
                                    "days_held": days_held,
                                    "qr": qr,
                                    "gain_pct": round(gain, 4),
                                },
                                threshold={
                                    "max_days": params.max_underwater_days,
                                    "qr_max": params.underwater_qr_threshold,
                                },
                            )
                        ],
                    )
                )
                continue

        # Strong sell
        if qr < params.strong_sell_rating:
            signals.append(
                Signal(
                    action=Action.FULL_SELL,
                    ticker=pos.ticker,
                    reason=f"Strong sell (QR {qr:.1f})",
                    score=score,
                    rules=[
                        RuleCheck(
                            rule_id="strong_sell",
                            passed=True,
                            inputs={"qr": qr},
                            threshold={"max": params.strong_sell_rating},
                        )
                    ],
                )
            )
            continue

        # Hold removal / Winners Circle
        if qr < params.hold_removal_rating:
            if (
                is_winner
                and not pos.is_house_money
                and pos.initial_investment
                and pos.current_price > 0
            ):
                initial_shares = pos.initial_investment / pos.current_price
                keep_shares = pos.shares - initial_shares
                if keep_shares > 0 and initial_shares > 0:
                    signals.append(
                        Signal(
                            action=Action.PARTIAL_SELL,
                            ticker=pos.ticker,
                            sell_shares=initial_shares,
                            keep_shares=keep_shares,
                            reason=f"Winner partial sell (keep house money, +{gain * 100:.0f}%)",
                            score=score,
                            rules=[
                                RuleCheck(
                                    rule_id="winners_circle",
                                    passed=True,
                                    inputs={
                                        "qr": qr,
                                        "gain_pct": round(gain, 4),
                                        "sell_shares": round(initial_shares, 4),
                                    },
                                    threshold={
                                        "hold_removal": params.hold_removal_rating,
                                        "winner_threshold": params.winner_threshold,
                                    },
                                )
                            ],
                        )
                    )
                    continue

            signals.append(
                Signal(
                    action=Action.FULL_SELL,
                    ticker=pos.ticker,
                    reason=f"Below hold ({params.hold_removal_rating})",
                    score=score,
                    rules=[
                        RuleCheck(
                            rule_id="hold_removal",
                            passed=True,
                            inputs={"qr": qr, "is_winner": is_winner},
                            threshold={"hold_removal": params.hold_removal_rating},
                        )
                    ],
                )
            )

    return signals


def _drawdown_halted(
    portfolio: PortfolioState, params: StrategyParams
) -> tuple[bool, list[RuleCheck]]:
    if not params.enable_drawdown_circuit_breaker:
        return False, [
            RuleCheck(
                rule_id="drawdown_circuit_breaker",
                passed=False,
                inputs={"enabled": False},
                message="Disabled (Run 118 default)",
            )
        ]

    equity = portfolio.equity
    peak = portfolio.peak_equity or equity
    if equity > peak:
        peak = equity
    drawdown = (equity - peak) / peak if peak > 0 else 0.0

    halted = portfolio.is_drawdown_halted
    if halted:
        if drawdown > params.drawdown_resume_pct:
            halted = False
    else:
        if drawdown < params.drawdown_halt_pct:
            halted = True

    return halted, [
        RuleCheck(
            rule_id="drawdown_circuit_breaker",
            passed=halted,
            inputs={"drawdown": round(drawdown, 4), "equity": round(equity, 2)},
            threshold={
                "halt": params.drawdown_halt_pct,
                "resume": params.drawdown_resume_pct,
            },
        )
    ]


def _plan_recycle_trims(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    shortfall: float,
    params: StrategyParams,
    already_exiting: set[str],
) -> list[Signal]:
    """Trim weakest non–house-money QR < weak_signal_threshold to fund a buy."""
    if shortfall <= 0:
        return []

    candidates: list[tuple[str, float, float]] = []
    for ticker, pos in portfolio.positions.items():
        if ticker in already_exiting:
            continue
        if pos.is_house_money:
            continue
        score = scores.get(ticker)
        if not score or score.quant_rating >= params.weak_signal_threshold:
            continue
        if pos.current_price <= 0:
            continue
        candidates.append((ticker, score.quant_rating, pos.current_price))

    if not candidates:
        return []

    candidates.sort(key=lambda x: x[1])
    ticker, qr, price = candidates[0]
    pos = portfolio.positions[ticker]
    trim_amount = shortfall * 1.1
    trim_shares = min(pos.shares, trim_amount / price)
    if trim_shares <= 0.01:
        return []

    return [
        Signal(
            action=Action.RECYCLE_TRIM,
            ticker=ticker,
            sell_shares=trim_shares,
            reason=f"Trim weakest (QR {qr:.1f}) to fund new buy",
            score=scores.get(ticker),
            rules=[
                RuleCheck(
                    rule_id="active_recycling",
                    passed=True,
                    inputs={
                        "qr": qr,
                        "shortfall": round(shortfall, 2),
                        "trim_shares": round(trim_shares, 4),
                    },
                    threshold={"weak_signal_threshold": params.weak_signal_threshold},
                    message="Core Run 118 alpha: recycle weak names into new picks",
                )
            ],
        )
    ]


def _buy_signals(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    ranked_tickers: list[str],
    params: StrategyParams,
    prior_signals: list[Signal],
    drawdown_halted: bool,
) -> list[Signal]:
    signals: list[Signal] = []
    max_buys = params.max_adds_per_evaluation

    limit_rule = RuleCheck(
        rule_id="max_adds_per_evaluation",
        passed=True,
        inputs={"limit": max_buys, "attempted": 0},
        threshold={"max_adds_per_evaluation": max_buys},
        message="Exactly 1 buy per eval (Run 118) — no adaptive filler",
    )

    if drawdown_halted:
        return signals

    exiting = {
        s.ticker
        for s in prior_signals
        if s.action == Action.FULL_SELL
    }
    already_trimmed = {
        s.ticker
        for s in prior_signals
        if s.action in (Action.TRIM, Action.RECYCLE_TRIM, Action.PARTIAL_SELL)
    }
    held = set(portfolio.positions.keys()) - exiting
    position_count = len(held)
    open_slots = params.max_positions - position_count
    if open_slots <= 0:
        return signals

    buys = 0
    equity = portfolio.equity
    target_notional = equity * params.position_size_pct
    reserve = params.cash_reserve_buys * target_notional
    # Simulate cash freed by pending sells / weight trims
    sim_cash = portfolio.cash
    for s in prior_signals:
        if s.action == Action.FULL_SELL and s.ticker in portfolio.positions:
            sim_cash += portfolio.positions[s.ticker].market_value
        elif s.sell_shares and s.ticker in portfolio.positions:
            sim_cash += s.sell_shares * portfolio.positions[s.ticker].current_price

    for ticker in ranked_tickers:
        if buys >= max_buys:
            break

        score = scores.get(ticker)
        if not score:
            continue

        ok, criteria_checks = meets_buy_criteria(score, params)
        if not ok:
            continue

        if ticker in held:
            if not params.allow_double_buy:
                continue
            pos = portfolio.positions.get(ticker)
            if not pos:
                continue
            if pos.gain_pct < params.double_buy_min_gain:
                continue
            shortfall = max(0.0, target_notional + reserve - sim_cash)
            if shortfall > 0:
                recycle = _plan_recycle_trims(
                    portfolio,
                    scores,
                    shortfall,
                    params,
                    exiting | already_trimmed | {ticker},
                )
                if not recycle and sim_cash < target_notional:
                    continue
                for r in recycle:
                    sim_cash += (r.sell_shares or 0) * portfolio.positions[r.ticker].current_price
                    signals.append(r)
                    already_trimmed.add(r.ticker)

            signals.append(
                Signal(
                    action=Action.DOUBLE_BUY,
                    ticker=ticker,
                    reason=(
                        f"Conviction add (+{pos.gain_pct * 100:.0f}%): "
                        f"Quant {score.quant_rating:.1f}, Rev={score.revisions_grade}, "
                        f"Gro={score.growth_grade}"
                    ),
                    score=score,
                    rules=[
                        limit_rule,
                        RuleCheck(
                            rule_id="double_buy",
                            passed=True,
                            inputs={"gain_pct": round(pos.gain_pct, 4)},
                            threshold={"min_gain": params.double_buy_min_gain},
                        ),
                        *criteria_checks,
                    ],
                    metadata={"target_notional": target_notional},
                )
            )
            buys += 1
            sim_cash -= target_notional
            continue

        if _would_exceed_sector_cap(
            ticker, score.sector, held, scores, portfolio.positions, params
        ):
            continue

        shortfall = max(0.0, target_notional + reserve - sim_cash)
        if shortfall > 0:
            recycle = _plan_recycle_trims(
                portfolio,
                scores,
                shortfall,
                params,
                exiting | already_trimmed | {ticker},
            )
            if not recycle and sim_cash < target_notional:
                continue
            for r in recycle:
                sim_cash += (r.sell_shares or 0) * portfolio.positions[r.ticker].current_price
                signals.append(r)
                already_trimmed.add(r.ticker)

        if sim_cash < target_notional * 0.5:
            continue

        signals.append(
            Signal(
                action=Action.BUY,
                ticker=ticker,
                reason=(
                    f"Top pick: Quant {score.quant_rating:.1f}, "
                    f"Rev={score.revisions_grade}, Gro={score.growth_grade}, "
                    f"Val={score.valuation_grade}"
                ),
                score=score,
                rules=[
                    RuleCheck(
                        rule_id="max_adds_per_evaluation",
                        passed=True,
                        inputs={"limit": max_buys, "attempted": buys + 1},
                        threshold={"max_adds_per_evaluation": max_buys},
                        message="Exactly 1 buy per eval (Run 118) — no adaptive filler",
                    ),
                    *criteria_checks,
                ],
                metadata={"target_notional": target_notional},
            )
        )
        held.add(ticker)
        buys += 1
        sim_cash -= target_notional

    return signals


def evaluate(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    ranked_tickers: list[str],
    params: StrategyParams | None = None,
    as_of: date | None = None,
) -> list[Signal]:
    """Full biweekly evaluation: trims → removals → (optional) buys with recycling."""
    params = params or StrategyParams()
    as_of = as_of or portfolio.as_of or date.today()

    signals: list[Signal] = []
    weight_trims = _weight_trim_signals(portfolio, params)
    signals.extend(weight_trims)
    removals = _removal_signals(portfolio, scores, params, as_of)
    signals.extend(removals)

    halted, dd_rules = _drawdown_halted(portfolio, params)
    buys = _buy_signals(
        portfolio, scores, ranked_tickers, params, signals, halted
    )
    if halted and not buys:
        # Record that buys were blocked
        signals.append(
            Signal(
                action=Action.TRIM,  # placeholder won't execute (0 shares)
                ticker="__DRAWDOWN__",
                sell_shares=0,
                reason="Buys halted by drawdown circuit breaker",
                rules=dd_rules,
                metadata={"skip_execution": True},
            )
        )
    signals.extend(buys)
    return [s for s in signals if not s.metadata.get("skip_execution")]


def evaluate_sells_only(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams | None = None,
    as_of: date | None = None,
) -> list[Signal]:
    """Daily sell-side pass (only if enable_daily_sell_pass)."""
    params = params or StrategyParams()
    if not params.enable_daily_sell_pass:
        return []
    as_of = as_of or portfolio.as_of or date.today()
    signals: list[Signal] = []
    signals.extend(_weight_trim_signals(portfolio, params))
    signals.extend(_removal_signals(portfolio, scores, params, as_of))
    return signals
