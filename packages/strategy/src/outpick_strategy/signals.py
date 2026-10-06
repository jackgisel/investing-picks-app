"""Pure portfolio evaluation — shared by live worker and backtest.

Hard rule: no I/O. Callers supply PortfolioState + scores.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
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
    # Floor of one. `int(3 * 0.30)` is 0, and `count >= 0` is true for an empty
    # book, so a small `max_positions` used to forbid every classified buy
    # forever (BUG-S7). A cap can never be stricter than "one name per sector".
    if params.sector_cap_basis == "held":
        # Sized to the book after this buy. 30% of 50 slots is 15 names, which
        # a book adding one name a fortnight does not reach for over a year.
        basis = len(held) + 1
    else:
        basis = params.max_positions
    max_in_sector = max(1, int(basis * params.sector_concentration))
    count = 0
    for t in held:
        s = scores.get(t)
        pos_sector = (s.sector if s else None) or (
            positions[t].sector if t in positions else None
        )
        if pos_sector == sector:
            count += 1
    return count >= max_in_sector


def rank_candidates(
    scores: dict[str, ScoreSnapshot], params: StrategyParams | None = None
) -> list[str]:
    """Tickers in buy-priority order.

    Run 118 ranks on today's quant rating. With `rank_smoothing` the key is the
    mean of today's rating and `prior_quant_rating` (the snapshot a week or
    more back), so a name that spiked on one scoring run does not jump a name
    that has held its rating. A name with no prior ranks on today's rating.

    Ties break on ticker. Run 118 sorted on the rating alone, which left equal
    ratings in dict insertion order: stored ratings are rounded to three
    decimals, so ties happen, and the same universe loaded by a different query
    order then bought a different name. Run 118's recycle trim had the same bug
    and the same fix; the buy path now matches.
    """
    params = params or StrategyParams()
    if not params.rank_smoothing:
        return sorted(scores.keys(), key=lambda t: (-scores[t].quant_rating, t))

    def key(t: str) -> tuple[float, str]:
        s = scores[t]
        qr = s.quant_rating
        if s.prior_quant_rating is not None:
            qr = (qr + s.prior_quant_rating) / 2.0
        return (-qr, t)

    return sorted(scores.keys(), key=key)


def _earnings_blackout(
    score: ScoreSnapshot, params: StrategyParams, as_of: date
) -> RuleCheck | None:
    """A failed rule when `score` reports inside the blackout window."""
    days = params.earnings_blackout_days
    if not days or score.next_earnings_date is None:
        return None
    until = (score.next_earnings_date - as_of).days
    if 0 <= until <= days:
        return RuleCheck(
            rule_id="earnings_blackout",
            passed=False,
            inputs={
                "next_earnings_date": score.next_earnings_date.isoformat(),
                "days_until": until,
            },
            threshold={"earnings_blackout_days": days},
            message=f"Reports in {until}d; buys wait until after the print",
        )
    return None


def _correlation(a: dict[date, float], b: dict[date, float]) -> float | None:
    """Pearson correlation over the dates both series share; None if < 20."""
    common = sorted(a.keys() & b.keys())
    if len(common) < 20:
        return None
    xs = [a[d] for d in common]
    ys = [b[d] for d in common]
    n = len(common)
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return None
    return cov / (vx * vy) ** 0.5


def _correlation_block(
    ticker: str,
    held: set[str],
    params: StrategyParams,
    return_series: dict[str, dict[date, float]] | None,
) -> RuleCheck | None:
    """A failed rule when `ticker` moves too closely with a holding.

    Abstains when the switch is off or a series is missing: no data is not
    evidence of correlation, and failing closed here would stop every buy on a
    price-history gap.
    """
    limit = params.max_pair_correlation
    if limit is None:
        return None
    if return_series is None:
        logger.error(
            "max_pair_correlation=%s is set but no return series were supplied; "
            "the correlation cap is not running",
            limit,
        )
        return None
    mine = return_series.get(ticker)
    if not mine:
        return None
    worst: tuple[float, str] | None = None
    for other in sorted(held):
        theirs = return_series.get(other)
        if not theirs:
            continue
        rho = _correlation(mine, theirs)
        if rho is not None and (worst is None or rho > worst[0]):
            worst = (rho, other)
    if worst is None or worst[0] <= limit:
        return None
    return RuleCheck(
        rule_id="max_pair_correlation",
        passed=False,
        inputs={"with": worst[1], "correlation": round(worst[0], 3)},
        threshold={
            "max": limit,
            "lookback_days": params.correlation_lookback_days,
        },
        message=f"Moves with {worst[1]} (correlation {worst[0]:.2f})",
    )


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
        gain = pos.gain_pct

        # Price-based stop. Checked before anything that needs a score, so a
        # name that is both unrated and down past the floor still exits. House
        # money reports gain 0 and is never caught here, correctly: nothing of
        # the original stake is at risk.
        if (
            params.max_loss_pct is not None
            and pos.avg_cost
            and pos.avg_cost > 0
            and not pos.is_house_money
            and gain <= params.max_loss_pct
        ):
            signals.append(
                Signal(
                    action=Action.FULL_SELL,
                    ticker=pos.ticker,
                    reason=f"Max-loss stop ({gain * 100:.0f}%)",
                    score=score,
                    rules=[
                        RuleCheck(
                            rule_id="max_loss_stop",
                            passed=True,
                            inputs={"gain_pct": round(gain, 4)},
                            threshold={"max_loss_pct": params.max_loss_pct},
                            message="Exit on price alone; the rating is not consulted",
                        )
                    ],
                )
            )
            continue

        if not score:
            # No rating, so no rating rule can run. Run 118 skipped the name
            # forever and logged an incident. Exit once it has been unrated for
            # longer than `max_unrated_days`, counting from the last score it
            # had, or from entry when it never had one.
            if params.max_unrated_days:
                since = pos.last_scored or pos.entry_date
                if since is not None:
                    unrated_days = (as_of - since).days
                    if unrated_days > params.max_unrated_days:
                        signals.append(
                            Signal(
                                action=Action.FULL_SELL,
                                ticker=pos.ticker,
                                reason=f"Unrated for {unrated_days}d",
                                rules=[
                                    RuleCheck(
                                        rule_id="unrated_exit",
                                        passed=True,
                                        inputs={
                                            "unrated_days": unrated_days,
                                            "last_scored": (
                                                pos.last_scored.isoformat()
                                                if pos.last_scored
                                                else None
                                            ),
                                        },
                                        threshold={
                                            "max_unrated_days": params.max_unrated_days
                                        },
                                        message=(
                                            "No composite score; the rating rules "
                                            "cannot judge this holding"
                                        ),
                                    )
                                ],
                            )
                        )
            continue

        qr = score.quant_rating
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


def _buy_signals(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    ranked_tickers: list[str],
    params: StrategyParams,
    prior_signals: list[Signal],
    drawdown_halted: bool,
    as_of: date,
    return_series: dict[str, dict[date, float]] | None = None,
) -> list[Signal]:
    """The one add per evaluation, with no cash gate.

    run119 assumes a pick is always funded. Run 118 simulated cash freed by the
    pending sells, held back a two-pick reserve, trimmed the weakest holding to
    cover any shortfall and refused a buy below half the target notional. All
    of that was cash management, which this book does not do: the executor
    funds whatever the pick costs and records the deposit. The buy is sized by
    `target_notional` and gated on the model and the book's shape only.
    """
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
        if s.action in (Action.TRIM, Action.PARTIAL_SELL)
    }
    held = set(portfolio.positions.keys()) - exiting
    # A full book no longer returns early here. `max_positions` caps how many
    # *names* are held, and a conviction add to a name already held consumes no
    # slot — bailing out at this point silently disabled DOUBLE_BUY in exactly
    # the steady state the strategy is designed to run in (fully deployed). Only
    # a genuinely new name is gated now, inside the loop, against the live count.

    buys = 0
    target_notional = params.target_notional(portfolio.equity)

    for ticker in ranked_tickers:
        if buys >= max_buys:
            break

        score = scores.get(ticker)
        if not score:
            continue

        ok, criteria_checks = meets_buy_criteria(score, params)
        if not ok:
            continue
        if _earnings_blackout(score, params, as_of) is not None:
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
            # side.
            if ticker in already_trimmed:
                continue
            if pos.gain_pct < params.double_buy_min_gain:
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
                        RuleCheck(
                            rule_id="max_adds_per_evaluation",
                            passed=True,
                            inputs={"limit": max_buys, "attempted": buys + 1},
                            threshold={"max_adds_per_evaluation": max_buys},
                            message="Exactly 1 buy per eval — no adaptive filler",
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
            continue

        # A new name needs a free slot; counted live, because a buy earlier in
        # this same loop has already been added to `held`.
        if len(held) >= params.max_positions:
            continue

        if _would_exceed_sector_cap(
            ticker, score.sector, held, scores, portfolio.positions, params
        ):
            continue
        if _correlation_block(ticker, held, params, return_series) is not None:
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
                        message="Exactly 1 buy per eval — no adaptive filler",
                    ),
                    *criteria_checks,
                ],
                metadata={"target_notional": target_notional},
            )
        )
        held.add(ticker)
        buys += 1

    return signals


def evaluate(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    ranked_tickers: list[str],
    params: StrategyParams | None = None,
    as_of: date | None = None,
    return_series: dict[str, dict[date, float]] | None = None,
) -> list[Signal]:
    """Full biweekly evaluation: trims → removals → the one add.

    `return_series` is daily returns by ticker and date, read only by the
    `max_pair_correlation` switch. Callers build it when that switch is on.
    """
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
    signals.extend(_reconcile_exits(weight_trims, removals))

    halted, dd_rules = _drawdown_halted(portfolio, params)
    buys = _buy_signals(
        portfolio, scores, ranked_tickers, params, signals, halted, as_of, return_series
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
    """Removal rules only for the weekly DCA sample book.

    Equal-weight Friday adds are the sizing. The live book's 15% cap would
    trim names back to 12% and dump the proceeds into whoever just joined,
    which is the opposite of dollar-cost averaging.
    """
    params = params or StrategyParams()
    as_of = as_of or portfolio.as_of or date.today()
    return _removal_signals(portfolio, scores, params, as_of)


def _sell_side_signals(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams,
    as_of: date,
) -> list[Signal]:
    weight_trims = _weight_trim_signals(portfolio, params)
    removals = _removal_signals(portfolio, scores, params, as_of)
    return _reconcile_exits(weight_trims, removals)


def _reconcile_exits(weight_trims: list[Signal], removals: list[Signal]) -> list[Signal]:
    """One ticker, one exit instruction.

    `_weight_trim_signals` and `_removal_signals` do not know about each other.
    A holding that is both over its weight cap and below the exit rating used to
    be published with a TRIM *and* a FULL_SELL; a holding over the cap that also
    qualified for the Winners Circle got a TRIM *and* a PARTIAL_SELL whose share
    counts summed to more than the position (BUG-S1: 126 shares ordered out of
    100 held). The removal wins in both cases:

    - FULL_SELL: the TRIM was already a no-op at execution (`apply_signals` sorts
      FULL_SELL first and pops the position). Dropping it fixes what sat
      downstream of the extra signal: contradictory instructions to anyone
      mirroring the book, a ledger row stamped executed for a trade that never
      happened, and the sale counted twice as available cash by `_buy_signals`.
    - PARTIAL_SELL: the Winners Circle takes the original stake off and flags
      what remains as house money, and house money answers to
      `position_cap_house_money`, not the normal cap the TRIM was enforcing. If
      the remainder is still too large under *that* cap, the next evaluation's
      weight pass trims it as house money, which is the rule that should apply.
    """
    superseded = {
        s.ticker for s in removals if s.action in (Action.FULL_SELL, Action.PARTIAL_SELL)
    }
    signals = [t for t in weight_trims if t.ticker not in superseded]
    signals.extend(removals)
    return signals


# How many high-QR names that fail a buy criterion to keep on the queue after
# the names that actually clear the grade gates. The rest of the universe is
# noise for an operator validating Friday's pick.
NEAR_MISS_LIMIT = 10

_BUY_ACTIONS = (Action.BUY, Action.DOUBLE_BUY)


@dataclass
class BuyQueueEntry:
    """One ranked name, with the reason it is or is not Friday's buy."""

    ticker: str
    rank: int
    score: ScoreSnapshot
    held: bool
    criteria_ok: bool
    criteria: list[RuleCheck]
    status: str  # selected | blocked | near_miss
    blocked_by: str | None = None
    message: str = ""
    action: str | None = None

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "rank": self.rank,
            "held": self.held,
            "criteria_ok": self.criteria_ok,
            "criteria": [c.to_dict() for c in self.criteria],
            "status": self.status,
            "blocked_by": self.blocked_by,
            "message": self.message,
            "action": self.action,
            "score": self.score.to_dict(),
        }


@dataclass
class BuyQueue:
    selected_ticker: str | None
    selected_action: str | None
    drawdown_halted: bool
    candidates: list[BuyQueueEntry]

    def to_dict(self) -> dict:
        return {
            "selected_ticker": self.selected_ticker,
            "selected_action": self.selected_action,
            "drawdown_halted": self.drawdown_halted,
            "candidates": [c.to_dict() for c in self.candidates],
        }


def _buy_session_state(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams,
    as_of: date,
) -> tuple[list[Signal], bool, set[str], set[str]]:
    """Held set and exit list `_buy_signals` starts from.

    Same prior-signal construction as `evaluate()`: weight trims reconciled
    against removals. The explainer has to see that book, not the pre-eval
    one, or a name whose slot is freed by a pending sell would look blocked.
    """
    prior = _reconcile_exits(
        _weight_trim_signals(portfolio, params),
        _removal_signals(portfolio, scores, params, as_of),
    )
    halted, _ = _drawdown_halted(portfolio, params)
    exiting = {s.ticker for s in prior if s.action == Action.FULL_SELL}
    already_trimmed = {
        s.ticker
        for s in prior
        if s.action in (Action.TRIM, Action.PARTIAL_SELL)
    }
    held = set(portfolio.positions.keys()) - exiting
    return prior, halted, held, already_trimmed


def _book_gate(
    ticker: str,
    score: ScoreSnapshot,
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    params: StrategyParams,
    held: set[str],
    already_trimmed: set[str],
    as_of: date,
    return_series: dict[str, dict[date, float]] | None = None,
) -> tuple[str | None, str]:
    """Book constraint that stops this name, or (None, '') if it would buy.

    Mirrors the continue-points inside `_buy_signals` after `meets_buy_criteria`
    has already passed. Does not apply the one-add cap — the caller does that
    once it knows whether evaluate() already picked someone.
    """
    blackout = _earnings_blackout(score, params, as_of)
    if blackout is not None:
        return "earnings_blackout", blackout.message
    if ticker in held:
        if not params.allow_double_buy:
            return "already_held", "Already held; conviction adds are off"
        pos = portfolio.positions.get(ticker)
        if not pos:
            return "already_held", "Already held"
        if ticker in already_trimmed:
            return "already_trimmed", "Trimmed this evaluation; no conviction add"
        if pos.gain_pct < params.double_buy_min_gain:
            return (
                "conviction_add_gain",
                (
                    f"Already held; gain {pos.gain_pct:.0%} is below the "
                    f"{params.double_buy_min_gain:.0%} conviction-add minimum"
                ),
            )
        return None, ""

    if len(held) >= params.max_positions:
        return "no_slot", f"Book is at max_positions ({params.max_positions})"
    if _would_exceed_sector_cap(
        ticker, score.sector, held, scores, portfolio.positions, params
    ):
        cap_pct = int(params.sector_concentration * 100)
        return "sector_cap", f"Would exceed the {cap_pct}% sector cap"
    corr = _correlation_block(ticker, held, params, return_series)
    if corr is not None:
        return "max_pair_correlation", corr.message
    return None, ""


def _near_miss_message(checks: list[RuleCheck]) -> str:
    failed = [c.rule_id for c in checks if not c.passed]
    if not failed:
        return "Fails a buy criterion"
    return "Fails " + ", ".join(failed)


def explain_buy_queue(
    portfolio: PortfolioState,
    scores: dict[str, ScoreSnapshot],
    ranked_tickers: list[str],
    params: StrategyParams | None = None,
    as_of: date | None = None,
    near_miss_limit: int = NEAR_MISS_LIMIT,
    return_series: dict[str, dict[date, float]] | None = None,
) -> BuyQueue:
    """Ranked Friday-buy queue with skip reasons. Does not change evaluate().

    `selected_ticker` is taken from `evaluate()` so the ops page cannot disagree
    with the dry-run about who the engine would buy. Book-gate reasons on the
    other names reuse the same predicates `_buy_signals` uses.
    """
    params = params or StrategyParams()
    as_of = as_of or portfolio.as_of or date.today()

    signals = evaluate(portfolio, scores, ranked_tickers, params, as_of, return_series)
    chosen = next((s for s in signals if s.action in _BUY_ACTIONS), None)
    selected_ticker = chosen.ticker if chosen else None
    selected_action = chosen.action.value if chosen else None

    _prior, halted, held, already_trimmed = _buy_session_state(
        portfolio, scores, params, as_of
    )

    candidates: list[BuyQueueEntry] = []
    near_misses: list[BuyQueueEntry] = []

    for rank, ticker in enumerate(ranked_tickers, start=1):
        score = scores.get(ticker)
        if not score:
            continue
        ok, criteria = meets_buy_criteria(score, params)
        held_now = ticker in held

        if not ok:
            if len(near_misses) < near_miss_limit:
                near_misses.append(
                    BuyQueueEntry(
                        ticker=ticker,
                        rank=rank,
                        score=score,
                        held=held_now,
                        criteria_ok=False,
                        criteria=criteria,
                        status="near_miss",
                        blocked_by="criteria",
                        message=_near_miss_message(criteria),
                    )
                )
            continue

        if halted:
            candidates.append(
                BuyQueueEntry(
                    ticker=ticker,
                    rank=rank,
                    score=score,
                    held=held_now,
                    criteria_ok=True,
                    criteria=criteria,
                    status="blocked",
                    blocked_by="drawdown",
                    message="Buys halted by drawdown circuit breaker",
                )
            )
            continue

        if ticker == selected_ticker:
            candidates.append(
                BuyQueueEntry(
                    ticker=ticker,
                    rank=rank,
                    score=score,
                    held=held_now,
                    criteria_ok=True,
                    criteria=criteria,
                    status="selected",
                    message=chosen.reason if chosen else "",
                    action=selected_action,
                )
            )
            continue

        blocked_by, message = _book_gate(
            ticker,
            score,
            portfolio,
            scores,
            params,
            held,
            already_trimmed,
            as_of,
            return_series,
        )
        if blocked_by is None and selected_ticker:
            blocked_by = "max_adds"
            message = "Clears the gates; another name took the one add"
        elif blocked_by is None:
            # evaluate() found no buy, but this name looks clear. Surface it
            # rather than dropping it — a silent omission is how the ops page
            # and the ledger drift apart.
            blocked_by = "not_selected"
            message = "Passes the gates here; evaluate() did not buy"
        candidates.append(
            BuyQueueEntry(
                ticker=ticker,
                rank=rank,
                score=score,
                held=held_now,
                criteria_ok=True,
                criteria=criteria,
                status="blocked",
                blocked_by=blocked_by,
                message=message,
            )
        )

    return BuyQueue(
        selected_ticker=selected_ticker,
        selected_action=selected_action,
        drawdown_halted=halted,
        candidates=candidates + near_misses,
    )
