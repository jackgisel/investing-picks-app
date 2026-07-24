"""Virtual portfolio executor — apply signals at mark prices, no broker."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from dataclasses import fields

from outpick_strategy import (
    Action,
    PortfolioState,
    PositionState,
    RUN118_PARAMS,
    ScoreSnapshot,
    Signal,
    StrategyParams,
    evaluate,
    evaluate_sells_only,
)
from outpick_strategy.params import BuyCriteria

from app.db.models import (
    CompositeScore,
    Evaluation,
    Portfolio,
    Position,
    SignalReason,
    SignalRow,
    Trade,
)


def params_from_portfolio(portfolio: Portfolio) -> StrategyParams:
    raw = portfolio.params_json or {}
    if not raw:
        return RUN118_PARAMS
    buy = raw.get("buy_criteria") or {}
    criteria = BuyCriteria(
        min_quant_rating=buy.get("min_quant_rating", 4.0),
        min_revisions_grade=buy.get("min_revisions_grade", "B+"),
        min_growth_grade=buy.get("min_growth_grade", "B"),
        min_profitability_grade=buy.get("min_profitability_grade", "D"),
        min_valuation_grade=buy.get("min_valuation_grade", "C-"),
    )
    known = {f.name for f in fields(StrategyParams) if f.name != "buy_criteria"}
    flat = {k: v for k, v in raw.items() if k in known}
    return StrategyParams(buy_criteria=criteria, **flat)


def load_portfolio_state(db: Session, portfolio: Portfolio) -> PortfolioState:
    positions = {
        p.ticker: PositionState(
            ticker=p.ticker,
            shares=p.shares,
            avg_cost=p.avg_cost,
            current_price=p.current_price or 0.0,
            entry_date=p.entry_date,
            initial_investment=p.initial_investment,
            sector=p.sector,
        )
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    }
    return PortfolioState(
        cash=portfolio.cash,
        positions=positions,
        peak_equity=portfolio.peak_equity,
        is_drawdown_halted=portfolio.is_drawdown_halted,
        as_of=date.today(),
    )


def load_latest_scores(db: Session) -> dict[str, ScoreSnapshot]:
    # Latest score per ticker by max(id)
    rows = db.query(CompositeScore).order_by(CompositeScore.id.desc()).all()
    out: dict[str, ScoreSnapshot] = {}
    for r in rows:
        if r.ticker in out:
            # second sighting = prior
            if out[r.ticker].prior_quant_rating is None:
                out[r.ticker].prior_quant_rating = r.quant_rating
            continue
        out[r.ticker] = ScoreSnapshot(
            ticker=r.ticker,
            quant_rating=r.quant_rating,
            valuation_grade=r.valuation_grade,
            growth_grade=r.growth_grade,
            profitability_grade=r.profitability_grade,
            momentum_grade=r.momentum_grade,
            revisions_grade=r.revisions_grade,
            sector=r.sector,
        )
    return out


def ranked_candidates(scores: dict[str, ScoreSnapshot]) -> list[str]:
    return sorted(scores.keys(), key=lambda t: scores[t].quant_rating, reverse=True)


def persist_evaluation(
    db: Session,
    portfolio: Portfolio,
    mode: str,
    params: StrategyParams,
    state: PortfolioState,
    signals: list[Signal],
    executed: bool,
) -> Evaluation:
    ev = Evaluation(
        portfolio_id=portfolio.id,
        mode=mode,
        params_version=params.version_hash(),
        params_json=params.to_dict(),
        portfolio_snapshot={
            "cash": state.cash,
            "equity": state.equity,
            "position_count": state.position_count(),
            "peak_equity": state.peak_equity,
        },
        executed=executed,
    )
    db.add(ev)
    db.flush()

    for sig in signals:
        row = SignalRow(
            evaluation_id=ev.id,
            ticker=sig.ticker,
            action=sig.action.value,
            reason=sig.reason,
            sell_shares=sig.sell_shares,
            keep_shares=sig.keep_shares,
            score_json=sig.to_dict().get("score"),
            metadata_json=sig.metadata,
            executed=executed,
        )
        db.add(row)
        db.flush()
        for rule in sig.rules:
            db.add(
                SignalReason(
                    signal_id=row.id,
                    rule_id=rule.rule_id,
                    passed=rule.passed,
                    inputs=rule.inputs,
                    threshold=rule.threshold,
                    message=rule.message or None,
                )
            )
    return ev


def apply_signals(
    db: Session,
    portfolio: Portfolio,
    signals: list[Signal],
    evaluation: Evaluation,
) -> list[Trade]:
    """Simulate fills at current_price marks."""
    trades: list[Trade] = []
    positions = {
        p.ticker: p
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    }

    # Process sells/trims first, then buys
    order = [
        Action.FULL_SELL,
        Action.PARTIAL_SELL,
        Action.TRIM,
        Action.RECYCLE_TRIM,
        Action.BUY,
        Action.DOUBLE_BUY,
    ]
    sorted_sigs = sorted(
        signals,
        key=lambda s: order.index(s.action) if s.action in order else 99,
    )

    signal_rows = {
        (r.ticker, r.action): r
        for r in db.query(SignalRow).filter(SignalRow.evaluation_id == evaluation.id).all()
    }

    for sig in sorted_sigs:
        srow = signal_rows.get((sig.ticker, sig.action.value))
        if sig.action in (Action.FULL_SELL, Action.PARTIAL_SELL, Action.TRIM, Action.RECYCLE_TRIM):
            pos = positions.get(sig.ticker)
            if not pos or pos.current_price <= 0:
                continue
            if sig.action == Action.FULL_SELL:
                shares = pos.shares
            else:
                shares = min(pos.shares, sig.sell_shares or 0)
            if shares <= 0:
                continue
            notional = shares * pos.current_price
            portfolio.cash += notional
            trade = Trade(
                portfolio_id=portfolio.id,
                evaluation_id=evaluation.id,
                signal_id=srow.id if srow else None,
                ticker=sig.ticker,
                side="sell",
                shares=shares,
                price=pos.current_price,
                notional=notional,
                reason=sig.reason,
                action=sig.action.value,
            )
            db.add(trade)
            trades.append(trade)

            if sig.action == Action.FULL_SELL or shares >= pos.shares - 1e-9:
                db.delete(pos)
                positions.pop(sig.ticker, None)
            else:
                pos.shares -= shares
                if sig.action == Action.PARTIAL_SELL:
                    # Winners Circle: remaining is house money
                    pos.initial_investment = 0.0
                    pos.avg_cost = 0.0

        elif sig.action in (Action.BUY, Action.DOUBLE_BUY):
            # Prefer live mark from scores/stock; fall back metadata
            target = float(sig.metadata.get("target_notional") or 0)
            price = None
            if sig.ticker in positions:
                price = positions[sig.ticker].current_price
            if not price or price <= 0:
                # use score-linked stock price via position state load — require mark
                from app.db.models import Stock

                stock = db.get(Stock, sig.ticker)
                price = stock.last_price if stock else None
            if not price or price <= 0 or target <= 0:
                continue
            shares = target / price
            notional = shares * price
            if notional > portfolio.cash:
                shares = portfolio.cash / price
                notional = shares * price
            if shares <= 0 or notional <= 0:
                continue

            portfolio.cash -= notional
            trade = Trade(
                portfolio_id=portfolio.id,
                evaluation_id=evaluation.id,
                signal_id=srow.id if srow else None,
                ticker=sig.ticker,
                side="buy",
                shares=shares,
                price=price,
                notional=notional,
                reason=sig.reason,
                action=sig.action.value,
            )
            db.add(trade)
            trades.append(trade)

            if sig.ticker in positions:
                pos = positions[sig.ticker]
                new_shares = pos.shares + shares
                pos.avg_cost = (
                    (pos.avg_cost * pos.shares + price * shares) / new_shares
                    if new_shares > 0
                    else price
                )
                pos.shares = new_shares
                pos.current_price = price
                if pos.initial_investment is None:
                    pos.initial_investment = notional
                else:
                    pos.initial_investment += notional
            else:
                sector = sig.score.sector if sig.score else None
                pos = Position(
                    portfolio_id=portfolio.id,
                    ticker=sig.ticker,
                    shares=shares,
                    avg_cost=price,
                    current_price=price,
                    entry_date=date.today(),
                    initial_investment=notional,
                    sector=sector,
                )
                db.add(pos)
                positions[sig.ticker] = pos

    # Update peak equity
    invested = sum(p.shares * (p.current_price or 0) for p in positions.values())
    equity = portfolio.cash + invested
    if portfolio.peak_equity is None or equity > portfolio.peak_equity:
        portfolio.peak_equity = equity

    return trades


def run_evaluation(
    db: Session,
    portfolio_id: int = 1,
    mode: str = "biweekly",
    dry_run: bool = False,
) -> Evaluation:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise ValueError(f"Portfolio {portfolio_id} not found")

    params = params_from_portfolio(portfolio)
    state = load_portfolio_state(db, portfolio)
    scores = load_latest_scores(db)
    ranked = ranked_candidates(scores)

    if mode == "daily":
        signals = evaluate_sells_only(state, scores, params, as_of=date.today())
    else:
        signals = evaluate(state, scores, ranked, params, as_of=date.today())

    ev = persist_evaluation(
        db,
        portfolio,
        mode="dry_run" if dry_run else mode,
        params=params,
        state=state,
        signals=signals,
        executed=not dry_run,
    )

    if not dry_run and signals:
        apply_signals(db, portfolio, signals, ev)

    db.commit()
    db.refresh(ev)
    return ev


def ensure_default_portfolio(db: Session, initial_cash: float = 100_000.0) -> Portfolio:
    portfolio = db.get(Portfolio, 1)
    if portfolio:
        return portfolio
    portfolio = Portfolio(
        id=1,
        name="AP Strategy",
        cash=initial_cash,
        peak_equity=initial_cash,
        params_json=RUN118_PARAMS.to_dict(),
    )
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio
