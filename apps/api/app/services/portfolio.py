"""Virtual portfolio executor — apply signals at mark prices, no broker."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, inspect as sa_inspect, text
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
    PortfolioSnapshot,
    Position,
    SignalReason,
    SignalRow,
    Trade,
)

log = logging.getLogger(__name__)


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


def _position_to_state(p: Position) -> PositionState:
    """Adapt a DB Position to the (frozen-ish) strategy PositionState.

    `packages/strategy` still expresses "house money" as `initial_investment <= 0`
    and derives `gain_pct` from `avg_cost`. The DB now keeps the *true* cost
    basis on those fields and carries house-money status in its own boolean, so
    we zero them here — at the boundary only — to hand the strategy engine
    exactly the inputs it saw before. Reporting reads the DB, so the public
    return number is no longer a casualty of a strategy-internal sentinel.
    """
    if p.is_house_money:
        return PositionState(
            ticker=p.ticker,
            shares=p.shares,
            avg_cost=0.0,
            current_price=p.current_price or 0.0,
            entry_date=p.entry_date,
            initial_investment=0.0,
            sector=p.sector,
        )
    return PositionState(
        ticker=p.ticker,
        shares=p.shares,
        avg_cost=p.avg_cost,
        current_price=p.current_price or 0.0,
        entry_date=p.entry_date,
        initial_investment=p.initial_investment,
        sector=p.sector,
    )


def load_portfolio_state(
    db: Session, portfolio: Portfolio, as_of: date | None = None
) -> PortfolioState:
    positions = {
        p.ticker: _position_to_state(p)
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    }
    return PortfolioState(
        cash=portfolio.cash,
        positions=positions,
        peak_equity=portfolio.peak_equity,
        is_drawdown_halted=portfolio.is_drawdown_halted,
        as_of=as_of or date.today(),
    )


# ---------------------------------------------------------------------------
# Performance math
# ---------------------------------------------------------------------------


def portfolio_equity(db: Session, portfolio: Portfolio) -> tuple[float, float, float]:
    """(cash, invested market value, total equity)."""
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    invested = sum(p.market_value for p in positions)
    cash = portfolio.cash or 0.0
    return cash, invested, cash + invested


def initial_capital(db: Session, portfolio: Portfolio) -> float | None:
    """Capital the book started with — the denominator of the headline return.

    Preference order:
      1. `Portfolio.initial_capital` if the column exists (forward compatible).
      2. The earliest portfolio snapshot's total value: the equity on day one of
         the live track record, and the same base `/performance` indexes its
         chart off — so the headline number agrees with the chart's last point.
      3. Configured seed cash.

    There are no external deposits or withdrawals in this book, so equity over
    starting equity is a true time-weighted return.
    """
    declared = getattr(portfolio, "initial_capital", None)
    if isinstance(declared, (int, float)) and declared > 0:
        return float(declared)

    first = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == portfolio.id)
        .order_by(PortfolioSnapshot.date.asc())
        .first()
    )
    if first and first.total_value and first.total_value > 0:
        return float(first.total_value)

    from app.config import get_settings

    seed = get_settings().initial_cash
    return float(seed) if seed and seed > 0 else None


#: Admin corrections, not investment outcomes. A manual removal refunds the
#: position's cost basis and a manual edit settles the difference in cash, so
#: both are backed out of (or added to) deployed capital rather than counted as
#: a sale — otherwise deleting a mistyped entry would land in the track record
#: as a flat trade and drag the average toward zero.
CORRECTION_ACTIONS = ("manual_remove", "manual_adjust")

#: Share counts are floats derived from notional/price, so "flat" is a tolerance
#: rather than an equality.
SHARE_EPSILON = 1e-9


def _trade_order_key(t: Trade) -> tuple[datetime, int]:
    """Chronological order for one ticker's trades, id as the tie-break.

    Timestamps arrive both naive (SQLite's CURRENT_TIMESTAMP) and tz-aware
    (Postgres' now(), and the explicit entry-dated stamps ops writes), and
    sorting a mixed list raises. Normalise to UTC so the two can be compared.
    """
    stamped = t.timestamp
    if stamped is None:
        stamped = datetime.min
    if stamped.tzinfo is None:
        stamped = stamped.replace(tzinfo=timezone.utc)
    return (stamped, t.id or 0)


def exit_basis(trades: list[Trade]) -> dict[int, dict]:
    """Average cost and opening date behind every position-reducing sell.

    Keyed by the exiting trade's id. Each ticker's trades are walked oldest
    first under average-cost accounting, so an exit is measured against the cost
    of EVERY lot that was open. Pricing it off the most recent buy alone reports
    a genuine winner as a loser whenever the last lot was added higher — buy 100
    at $10, add 100 at $30, sell 200 at $25 is +25% and used to publish as
    -16.67%. `allow_double_buy` is on in Run 118, so multi-lot positions are
    routine, not an edge case.

    The basis resets whenever the position goes flat, so a name that was closed
    and later re-bought starts a fresh round trip instead of averaging the new
    lot against the old one's cost.
    """
    grouped: dict[str, list[Trade]] = {}
    for t in trades:
        grouped.setdefault(t.ticker, []).append(t)

    out: dict[int, dict] = {}
    for rows in grouped.values():
        shares = 0.0
        basis = 0.0
        opened: datetime | None = None
        for t in sorted(rows, key=_trade_order_key):
            qty = t.shares or 0.0
            notional = t.notional or 0.0
            avg = basis / shares if shares > SHARE_EPSILON else None
            correction = t.action in CORRECTION_ACTIONS
            if t.side == "buy":
                if shares <= SHARE_EPSILON:
                    opened = t.timestamp
                shares += qty
                basis += notional
            elif correction:
                # A correction restates the book: its notional IS the change in
                # cost basis, not a fill at the average price.
                shares -= qty
                basis -= notional
            else:
                shares -= qty
                basis -= (avg or 0.0) * qty
                out[t.id] = {
                    "avg_cost": avg,
                    "opened": opened,
                    "closes_position": shares <= SHARE_EPSILON,
                }
            if shares <= SHARE_EPSILON:
                shares = 0.0
                basis = 0.0
                opened = None
    return out


def picks_return(db: Session, portfolio: Portfolio) -> dict[str, float | int | None]:
    """Cumulative return on capital actually deployed into picks.

        (proceeds from closed picks + market value of open picks)
        / capital deployed - 1

    This is the research product's number: it measures the picks, not the book,
    so idle cash neither helps nor hurts it. `total_return_pct` answers a
    different question — what the whole portfolio did, cash drag included — and
    with a partly-invested book the two differ a lot.

    Closed picks are included deliberately. Counting only open positions would
    be survivorship bias: every sold loser would silently vanish from the track
    record while the winners stayed, which is exactly the distortion that makes
    a published record meaningless.
    """
    trades = db.query(Trade).filter(Trade.portfolio_id == portfolio.id).all()

    deployed = 0.0
    realized = 0.0
    for t in trades:
        notional = t.notional or 0.0
        if t.action in CORRECTION_ACTIONS:
            # Corrections move capital without any market outcome, so they move
            # the denominator and never the numerator. An edit that adds shares
            # must add its cash to `deployed`: without it the live market value
            # doubles while the denominator stays at the original cost, and
            # correcting a typed share count from 10 to 20 publishes +100% on a
            # book that earned nothing.
            deployed += notional if t.side == "buy" else -notional
        elif t.side == "buy":
            deployed += notional
        elif t.side == "sell":
            realized += notional

    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    open_value = sum(p.market_value for p in positions)

    # Completed round trips, not distinct tickers. A set difference on ticker
    # reported 0 closed picks for a name that was sold and later re-bought,
    # because it is in the open book again.
    closed_count = sum(
        1 for e in exit_basis(trades).values() if e["closes_position"]
    )

    if deployed <= 0:
        return {
            "return_pct": None,
            "deployed": 0.0,
            "open_value": round(open_value, 2),
            "realized": round(realized, 2),
            "open_count": len(positions),
            "closed_count": closed_count,
        }

    return {
        "return_pct": round(((realized + open_value) / deployed - 1) * 100, 2),
        "deployed": round(deployed, 2),
        "open_value": round(open_value, 2),
        "realized": round(realized, 2),
        "open_count": len(positions),
        "closed_count": closed_count,
    }


def picks_return_pct(db: Session, portfolio: Portfolio) -> float | None:
    value = picks_return(db, portfolio)["return_pct"]
    return value if isinstance(value, (int, float)) else None


def total_return_pct(db: Session, portfolio: Portfolio) -> float | None:
    """Percent return of the whole book since inception.

    (cash + market value of holdings) / initial capital - 1.

    This counts cash and every realized gain or loss, because sale proceeds land
    in cash. The old formula divided current market value by the cost basis of
    *open positions only*, which ignored cash and realized P&L and — because a
    Winners Circle partial sell used to zero `avg_cost` — let the best positions
    add market value to the numerator while adding nothing to the denominator.
    That ratio grew without bound.
    """
    base = initial_capital(db, portfolio)
    if not base or base <= 0:
        return None
    _cash, _invested, equity = portfolio_equity(db, portfolio)
    return round((equity / base - 1) * 100, 2)


# How far back "prior" reaches when measuring a rating drop. This is a fixed
# span in DAYS, deliberately not "the previous scoring run".
#
# The QR velocity rule sells on `qr - prior_qr < -qr_velocity_drop`. While the
# universe was scored weekly those were the same thing, so prior simply meant
# the second-most-recent as_of. Scoring now runs every trading day, and reading
# prior as "the run before this one" would silently reinterpret the rule as a
# one-DAY drop — a threshold a rating almost never crosses overnight, which
# retires a risk control without anyone changing it. Pinning the span keeps the
# rule meaning the same thing at any scoring cadence.
QR_VELOCITY_LOOKBACK_DAYS = 7


def load_latest_scores(db: Session) -> dict[str, ScoreSnapshot]:
    """Current score per ticker, plus its rating a lookback window ago."""
    return load_scores_as_of(db, None)


def load_scores_as_of(
    db: Session, as_of: date | None
) -> dict[str, ScoreSnapshot]:
    """Scores on `as_of` (or the newest date on or before it).

    `as_of=None` means the latest row in the table, matching `load_latest_scores`.
    """
    current_q = db.query(func.max(CompositeScore.as_of))
    if as_of is not None:
        current_q = current_q.filter(CompositeScore.as_of <= as_of)
    current_date = current_q.scalar()
    if current_date is None:
        return {}

    # The most recent snapshot at least a full window back. None when the table
    # does not reach that far yet, which correctly leaves prior_quant_rating
    # unset so the velocity rule abstains rather than firing on a short window.
    prior_date = (
        db.query(func.max(CompositeScore.as_of))
        .filter(CompositeScore.as_of <= current_date - timedelta(days=QR_VELOCITY_LOOKBACK_DAYS))
        .scalar()
    )

    recent_dates = [d for d in (current_date, prior_date) if d is not None]

    rows = (
        db.query(CompositeScore)
        .filter(CompositeScore.as_of.in_(recent_dates))
        .order_by(CompositeScore.id.asc())
        .all()
    )

    out: dict[str, ScoreSnapshot] = {}
    prior: dict[str, float] = {}
    for r in rows:
        if r.as_of == current_date:
            # ascending id => last write for the day wins
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
        elif prior_date is not None and r.as_of == prior_date:
            prior[r.ticker] = r.quant_rating

    for ticker, snapshot in out.items():
        snapshot.prior_quant_rating = prior.get(ticker)
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
            # Never `executed` here: this runs BEFORE apply_signals, which skips
            # a TRIM suppressed behind a FULL_SELL, a buy with no usable mark and
            # a sell on a position that is already gone. Stamping the run's
            # intent onto every row recorded those skips as trades that were
            # made. apply_signals flips this to True per row as it fills, so the
            # ledger — the artifact that makes a published record checkable —
            # says what actually happened.
            executed=False,
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
    as_of: date | None = None,
) -> list[Trade]:
    """Simulate fills at current_price marks."""
    trades: list[Trade] = []
    fill_date = as_of or date.today()
    fill_ts = datetime(fill_date.year, fill_date.month, fill_date.day, 20, 0, tzinfo=timezone.utc)
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
                timestamp=fill_ts,
            )
            db.add(trade)
            trades.append(trade)
            if srow:
                srow.executed = True

            if sig.action == Action.FULL_SELL or shares >= pos.shares - 1e-9:
                db.delete(pos)
                positions.pop(sig.ticker, None)
            else:
                pos.shares -= shares
                if sig.action == Action.PARTIAL_SELL:
                    # Winners Circle: the original stake has been recovered, so
                    # what remains rides as house money. Flag it — do NOT zero
                    # avg_cost / initial_investment. Those are the cost basis the
                    # public return and per-holding P&L are computed from, and
                    # zeroing them made the biggest winners report 0% while
                    # inflating the headline return without bound.
                    pos.is_house_money = True

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
                timestamp=fill_ts,
            )
            db.add(trade)
            trades.append(trade)
            if srow:
                srow.executed = True

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
                # Fresh capital is at risk again, so it is no longer house money.
                # (Previously implied by `initial_investment` going back above 0.)
                pos.is_house_money = False
            else:
                sector = sig.score.sector if sig.score else None
                pos = Position(
                    portfolio_id=portfolio.id,
                    ticker=sig.ticker,
                    shares=shares,
                    avg_cost=price,
                    current_price=price,
                    entry_date=fill_date,
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


def _recorded_on(ev: Evaluation) -> date | None:
    """Local calendar date an evaluation was written on.

    SQLite's CURRENT_TIMESTAMP is naive UTC while Postgres' now() is tz-aware;
    both are normalised so this means the same thing as `date.today()` on either.
    """
    stamped = ev.created_at
    if stamped is None:
        return None
    if stamped.tzinfo is None:
        stamped = stamped.replace(tzinfo=timezone.utc)
    return stamped.astimezone().date()


def executed_evaluation_today(
    db: Session, portfolio_id: int, mode: str
) -> Evaluation | None:
    """The executed evaluation already run for this portfolio, mode and day."""
    latest = (
        db.query(Evaluation)
        .filter(
            Evaluation.portfolio_id == portfolio_id,
            Evaluation.mode == mode,
            Evaluation.executed.is_(True),
        )
        .order_by(Evaluation.id.desc())
        .first()
    )
    if latest is not None and _recorded_on(latest) == date.today():
        return latest
    return None


def run_evaluation(
    db: Session,
    portfolio_id: int = 1,
    mode: str = "biweekly",
    dry_run: bool = False,
) -> Evaluation:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise ValueError(f"Portfolio {portfolio_id} not found")

    # An executed evaluation is not safe to replay. Sells and trims converge —
    # the position is already gone the second time — but buys do not: the second
    # run simply buys the next-ranked candidate, putting two adds in a cycle that
    # `max_adds_per_evaluation = 1` publicly claims will only ever make one, and
    # inflating `deployed` with it. A double-clicked POST /api/ops/evaluate, a
    # scheduler retry and a redeploy replaying job_biweekly_evaluate all land
    # here, and none of them carried a guard. Dry runs are untouched: they write
    # no trades, so previewing a cycle again is always safe.
    if not dry_run:
        already = executed_evaluation_today(db, portfolio_id, mode)
        if already is not None:
            log.info(
                "Evaluation %s already ran '%s' for portfolio %s today; "
                "returning it rather than trading again",
                already.id,
                mode,
                portfolio_id,
            )
            return already

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


# ---------------------------------------------------------------------------
# Lightweight schema upkeep
# ---------------------------------------------------------------------------

_SCHEMA_READY = False


def _recover_avg_cost_from_trades(conn) -> int:
    """Rebuild avg_cost for positions whose basis a legacy partial sell wiped.

    A partial sell reduces share count but not the average cost of the shares
    that remain, so the weighted average buy price across the position's buy
    trades is the correct basis. Positions imported from a snapshot have no buy
    trades and cannot be recovered — they are left alone and reported below.
    """
    rows = conn.execute(
        text(
            "SELECT id, portfolio_id, ticker FROM positions "
            "WHERE avg_cost IS NULL OR avg_cost <= 0"
        )
    ).fetchall()
    fixed = 0
    for pos_id, portfolio_id, ticker in rows:
        agg = conn.execute(
            text(
                "SELECT SUM(notional), SUM(shares) FROM trades "
                "WHERE portfolio_id = :pid AND ticker = :t AND side = 'buy'"
            ),
            {"pid": portfolio_id, "t": ticker},
        ).first()
        if not agg or not agg[0] or not agg[1] or agg[1] <= 0:
            log.warning(
                "Position %s (%s) has no cost basis and no buy trades to rebuild "
                "it from; its P&L will read as unavailable until re-imported.",
                pos_id,
                ticker,
            )
            continue
        conn.execute(
            text("UPDATE positions SET avg_cost = :c WHERE id = :id"),
            {"c": float(agg[0]) / float(agg[1]), "id": pos_id},
        )
        fixed += 1
    return fixed


def ensure_schema(db: Session, force: bool = False) -> None:
    """Idempotent, additive schema upkeep for databases created before these
    columns/constraints existed. `Base.metadata.create_all` only creates missing
    tables; it will not alter an existing one, and this project has no Alembic.
    """
    global _SCHEMA_READY
    if _SCHEMA_READY and not force:
        return

    try:
        engine = db.get_bind()
        engine = getattr(engine, "engine", engine)
        inspector = sa_inspect(engine)
        tables = set(inspector.get_table_names())

        with engine.begin() as conn:
            if "positions" in tables:
                cols = {c["name"] for c in inspector.get_columns("positions")}
                if "is_house_money" not in cols:
                    default = "0" if engine.dialect.name == "sqlite" else "FALSE"
                    conn.execute(
                        text(
                            "ALTER TABLE positions ADD COLUMN is_house_money "
                            f"BOOLEAN NOT NULL DEFAULT {default}"
                        )
                    )

                # Backfill runs unconditionally, not only when the column was
                # just added, so it is idempotent and self-healing if a previous
                # run died between the ALTER and the data fix. Current code never
                # writes initial_investment <= 0 or avg_cost <= 0, so anything
                # matching is by definition a legacy row.
                migrated = conn.execute(
                    text(
                        "UPDATE positions SET is_house_money = TRUE "
                        "WHERE initial_investment IS NOT NULL "
                        "AND initial_investment <= 0 "
                        "AND is_house_money = FALSE"
                    )
                ).rowcount
                if migrated:
                    log.info("Migrated %s legacy house-money positions", migrated)
                if "trades" in tables:
                    recovered = _recover_avg_cost_from_trades(conn)
                    if recovered:
                        log.info("Rebuilt avg_cost for %s positions", recovered)

            if "portfolios" in tables:
                cols = {c["name"] for c in inspector.get_columns("portfolios")}
                if "inception_date" not in cols:
                    # Must be added here rather than lazily on first ops request:
                    # startup calls ensure_default_portfolio, which SELECTs every
                    # mapped Portfolio column, so a missing column crashes the
                    # app before any request is served.
                    conn.execute(
                        text("ALTER TABLE portfolios ADD COLUMN inception_date DATE")
                    )
                if "kind" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE portfolios ADD COLUMN kind "
                            "VARCHAR(16) DEFAULT 'live'"
                        )
                    )

            if "composite_scores" in tables:
                covered = [
                    list(c.get("column_names") or [])
                    for c in inspector.get_unique_constraints("composite_scores")
                ] + [
                    list(i.get("column_names") or [])
                    for i in inspector.get_indexes("composite_scores")
                    if i.get("unique")
                ]
                if not any(set(c) == {"ticker", "as_of"} for c in covered):
                    conn.execute(
                        text(
                            "DELETE FROM composite_scores WHERE id NOT IN "
                            "(SELECT MAX(id) FROM composite_scores GROUP BY ticker, as_of)"
                        )
                    )
                    conn.execute(
                        text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS "
                            "uq_composite_scores_ticker_as_of "
                            "ON composite_scores (ticker, as_of)"
                        )
                    )

            if "fundamentals" in tables:
                # Same hazard as composite_scores, with a longer fuse. Blind
                # inserts let a re-run write a second row for the same
                # (ticker, as_of); score_universe takes the highest id, so a
                # degraded retry silently overwrites a good snapshot. Worse,
                # `_prior_estimate_snapshot` reads the last-written row at the
                # lookback date — so a bad retry today can null out estimate
                # revisions three weeks from now, which blocks every buy.
                covered = [
                    list(c.get("column_names") or [])
                    for c in inspector.get_unique_constraints("fundamentals")
                ] + [
                    list(i.get("column_names") or [])
                    for i in inspector.get_indexes("fundamentals")
                    if i.get("unique")
                ]
                if not any(set(c) == {"ticker", "as_of"} for c in covered):
                    conn.execute(
                        text(
                            "DELETE FROM fundamentals WHERE id NOT IN "
                            "(SELECT MAX(id) FROM fundamentals GROUP BY ticker, as_of)"
                        )
                    )
                    conn.execute(
                        text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS "
                            "uq_fundamentals_ticker_as_of "
                            "ON fundamentals (ticker, as_of)"
                        )
                    )
        _SCHEMA_READY = True
    except Exception:  # pragma: no cover - never block startup on upkeep
        log.exception("Schema upkeep failed; continuing with existing schema")


def ensure_default_portfolio(db: Session, initial_cash: float = 100_000.0) -> Portfolio:
    ensure_schema(db)
    portfolio = db.get(Portfolio, 1)
    if not portfolio:
        portfolio = Portfolio(
            id=1,
            name="AP Strategy",
            cash=initial_cash,
            peak_equity=initial_cash,
            params_json=RUN118_PARAMS.to_dict(),
            kind="live",
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    from app.services.dca import ensure_dca_portfolios

    ensure_dca_portfolios(db)
    return portfolio
