"""Pure portfolio evaluation — shared by live worker and backtest.

Hard rule: no I/O. Callers supply PortfolioState + scores.
"""

from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)


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
            # Turnover control: too soon to act on an ordinary rating decline.
            # Checked here rather than at the top of the loop so it never
            # suppresses strong_sell or the underwater stop above.
            if params.min_holding_days and pos.entry_date:
                days_held = (as_of - pos.entry_date).days
                if days_held < params.min_holding_days:
                    signals.append(
                        Signal(
                            action=Action.HOLD,
                            ticker=pos.ticker,
                            reason=(
                                f"Hold-removal suppressed: {days_held}d held, "
                                f"minimum {params.min_holding_days}d (QR {qr:.1f})"
                            ),
                            score=score,
                            rules=[
                                RuleCheck(
                                    rule_id="min_holding_days",
                                    passed=False,
                                    inputs={"days_held": days_held, "qr": qr},
                                    threshold={"min_holding_days": params.min_holding_days},
                                    message="Rating is below hold, but the position is too young to exit",
                                )
                            ],
                        )
                    )
                    continue
            # A NULL initial_investment means "we do not know the stake", not
            # "the stake was zero". `is_house_money` is False for None, so such a
            # position cleared the `not is_house_money` guard and was then
            # dropped by the truthiness test on the line below — the Winners
            # Circle silently never ran and the winner was fully liquidated
            # instead of having its original stake taken off the table. The
            # executor backfills this on its own buys, so the rows that carry
            # NULL are exactly the hand-entered ones (ops create_position,
            # seeding). Recover the stake from the cost basis we do have, and say
            # so — the same class of failure as the market_cap bug, made loud.
            stake = pos.initial_investment
            if stake is None and is_winner and not pos.is_house_money:
                if pos.shares > 0 and pos.avg_cost and pos.avg_cost > 0:
                    stake = pos.shares * pos.avg_cost
                    logger.warning(
                        "%s has a NULL initial_investment; recovering the Winners "
                        "Circle stake from cost basis (%.4f sh x %.2f = %.2f). "
                        "Backfill initial_investment on this position.",
                        pos.ticker,
                        pos.shares,
                        pos.avg_cost,
                        stake,
                    )
                else:
                    logger.error(
                        "%s has a NULL initial_investment and no usable cost "
                        "basis; the Winners Circle cannot run and the position "
                        "will be fully exited instead of held as house money.",
                        pos.ticker,
                    )

            if (
                is_winner
                and not pos.is_house_money
                and stake is not None
                and stake > 0
                and pos.current_price > 0
            ):
                initial_shares = stake / pos.current_price
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

    # Ticker breaks the tie. Sorting on quant_rating alone left equally-weak
    # names in `portfolio.positions` insertion order, so the same book loaded by
    # a different query ordering recycled a different holding — the live book and
    # a backtest can then diverge on identical inputs, which is fatal to any
    # reproducibility claim.
    candidates.sort(key=lambda x: (x[1], x[0]))
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
    # A full book no longer returns early here. `max_positions` caps how many
    # *names* are held, and a conviction add to a name already held consumes no
    # slot — bailing out at this point silently disabled DOUBLE_BUY in exactly
    # the steady state the strategy is designed to run in (fully deployed). Only
    # a genuinely new name is gated now, inside the loop, against the live count.

    buys = 0
    equity = portfolio.equity
    target_notional = params.target_notional(equity)
    reserve = params.cash_reserve_buys * target_notional
    # Simulate cash freed by pending sells / weight trims.
    #
    # Accumulate per ticker and cap at that position's market value. One holding
    # can appear in more than one selling signal — a weight TRIM alongside a
    # Winners-Circle PARTIAL_SELL — and adding each signal's proceeds
    # independently invents cash the book will never have. The executor cannot
    # overdraw, so the damage is silent: it truncates the buy to whatever cash
    # actually exists, and an entry that was meant to be one equal-weighted
    # `position_size_usd` slug enters at an arbitrary size with nothing in the
    # signal or the ledger recording that it was under-filled.
    freed: dict[str, float] = {}
    for s in prior_signals:
        pos = portfolio.positions.get(s.ticker)
        if not pos:
            continue
        if s.action == Action.FULL_SELL:
            freed[s.ticker] = freed.get(s.ticker, 0.0) + pos.market_value
        elif s.sell_shares:
            freed[s.ticker] = freed.get(s.ticker, 0.0) + s.sell_shares * pos.current_price
    sim_cash = portfolio.cash + sum(
        min(proceeds, portfolio.positions[t].market_value) for t, proceeds in freed.items()
    )

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
            # Never add to a name this same evaluation just cut back. The weight
            # cap has already ruled the position too large; buying it straight
            # back is churn against the rule that just fired, and a subscriber
            # mirroring the book by hand sees "Trim BIG" and "Add to BIG" side by
            # side. `already_trimmed` was collected but only consulted when
            # picking recycle candidates.
            if ticker in already_trimmed:
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

            # Same minimum-funding floor as a first buy. Without it the conviction
            # add was published whenever *any* recycle trim could be planned, no
            # matter how small: $10 of cash plus a $10 trim authorised a $3,000
            # add, which the executor then filled at whatever cash existed. The
            # identical position on a new name was already being rejected here.
            if sim_cash < target_notional * 0.5:
                continue

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
                        # Built here rather than shared with the BUY path: the
                        # module-level rule object was frozen at attempted=0, so
                        # every conviction add's audit row claimed no buy had
                        # been attempted on the evaluation that emitted it.
                        RuleCheck(
                            rule_id="max_adds_per_evaluation",
                            passed=True,
                            inputs={"limit": max_buys, "attempted": buys + 1},
                            threshold={"max_adds_per_evaluation": max_buys},
                            message="Exactly 1 buy per eval (Run 118) — no adaptive filler",
                        ),
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

        # A new name needs a free slot; counted live, because a buy earlier in
        # this same loop has already been added to `held`.
        if len(held) >= params.max_positions:
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
    removals = _removal_signals(portfolio, scores, params, as_of)

    # One ticker, one exit instruction. `_weight_trim_signals` and
    # `_removal_signals` do not know about each other, so a holding that is both
    # over its weight cap and below the exit rating used to be published with a
    # TRIM *and* a FULL_SELL. The TRIM was already a no-op at execution —
    # `apply_signals` sorts FULL_SELL first and pops the position — so dropping
    # it here changes no fill. What it does fix is everything downstream of the
    # extra signal: contradictory instructions to anyone mirroring the book, a
    # ledger row stamped `executed` for a trade that never happened (BUG-A5),
    # and the sale being counted twice as available cash by `_buy_signals`.
    exiting_now = {s.ticker for s in removals if s.action == Action.FULL_SELL}
    signals.extend(t for t in weight_trims if t.ticker not in exiting_now)
    signals.extend(removals)

    halted, dd_rules = _drawdown_halted(portfolio, params)
    buys = _buy_signals(
        portfolio, scores, ranked_tickers, params, signals, halted
    )
    if halted and not buys:
        # Record that buys were blocked.
        #
        # This used to be a zero-share TRIM carrying metadata={"skip_execution":
        # True}, and the return statement filtered on exactly that key — so the
        # placeholder was built and immediately thrown away. A halted evaluation
        # returned an empty list, indistinguishable from one where nothing
        # qualified, and the one state you most need to be able to see left no
        # trace in the ledger or the ops UI.
        #
        # Action.HOLD is the existing "a rule fired, no trade" carrier:
        # `apply_signals` dispatches on an explicit allow-list of buy and sell
        # actions, so a HOLD is inert at execution by construction rather than by
        # a flag that something else has to remember to honour.
        signals.append(
            Signal(
                action=Action.HOLD,
                ticker="__DRAWDOWN__",
                reason="Buys halted by drawdown circuit breaker",
                rules=dd_rules,
            )
        )
    signals.extend(buys)
    return signals


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
    return _sell_side_signals(portfolio, scores, params, as_of)


def evaluate_dca_sells(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams | None = None,
    as_of: date | None = None,
) -> list[Signal]:
    """Sell-side only for the weekly DCA sample book.

    Weight trims and removal rules, no buys, no recycle, no daily-sell flag.
    The DCA book buys the whole BUY list with fresh cash every Friday, so the
    live evaluator's `max_adds_per_evaluation=1` path must not run on it.
    """
    params = params or StrategyParams()
    as_of = as_of or portfolio.as_of or date.today()
    return _sell_side_signals(portfolio, scores, params, as_of)


def _sell_side_signals(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams,
    as_of: date,
) -> list[Signal]:
    weight_trims = _weight_trim_signals(portfolio, params)
    removals = _removal_signals(portfolio, scores, params, as_of)
    exiting_now = {s.ticker for s in removals if s.action == Action.FULL_SELL}
    signals = [t for t in weight_trims if t.ticker not in exiting_now]
    signals.extend(removals)
    return signals
