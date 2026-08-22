"""Weekly $1,000 DCA sample books.

Two parallel virtual books, identical deposits, different buy mandates:

  * `dca_voo`   — buy only VOO, never sell
  * `dca_picks` — split cash across the live book's open positions that are
                  still rated BUY or STRONG BUY that day, then apply the
                  live book's sell rules

Neither book goes through `evaluate()`. That path enforces one add per cycle.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from outpick_strategy import (
    Action,
    RUN118_PARAMS,
    SIGNAL_THRESHOLDS,
    Signal,
    evaluate_dca_sells,
)

from app.db.models import (
    CompositeScore,
    Evaluation,
    Portfolio,
    PortfolioContribution,
    PortfolioSnapshot,
    Position,
    PriceBar,
    SignalReason,
    SignalRow,
    Stock,
    Trade,
)
from app.services.portfolio import (
    SHARE_EPSILON,
    apply_signals,
    load_portfolio_state,
    load_scores_as_of,
    params_from_portfolio,
    persist_evaluation,
)

log = logging.getLogger(__name__)

KIND_LIVE = "live"
KIND_DCA_VOO = "dca_voo"
KIND_DCA_PICKS = "dca_picks"

DCA_WEEKLY_AMOUNT = 1_000.0
DCA_VOO_TICKER = "VOO"
# Live book inception. The first Friday on/after this (holiday-adjusted) is
# session one. 2026-04-03 is Good Friday, so that week lands on Thursday.
DCA_START = date(2026, 4, 1)
DCA_FIRST_SESSION = date(2026, 4, 2)

VOO_PORTFOLIO_NAME = "Weekly $1,000 · VOO"
PICKS_PORTFOLIO_NAME = "Weekly $1,000 · Open buys"


def _market_calendar():
    from worker.services.market_calendar import last_trading_day_on_or_before

    return last_trading_day_on_or_before


def session_for_friday(friday: date) -> date:
    """Trading session used for a calendar Friday (holiday → prior session)."""
    return _market_calendar()(friday)


def dca_sessions_between(start: date, end: date) -> list[date]:
    """Unique holiday-adjusted Friday sessions with start ≤ session ≤ end."""
    if end < start:
        return []
    sessions: list[date] = []
    seen: set[date] = set()
    cursor = start + timedelta(days=(4 - start.weekday()) % 7)
    last_trading_day_on_or_before = _market_calendar()
    while True:
        session = last_trading_day_on_or_before(cursor)
        if session > end:
            break
        if session >= start and session not in seen:
            seen.add(session)
            sessions.append(session)
        cursor += timedelta(days=7)
        if cursor > end + timedelta(days=7):
            break
    return sessions


def first_dca_session() -> date:
    return DCA_FIRST_SESSION


def portfolio_by_kind(db: Session, kind: str) -> Portfolio | None:
    return db.query(Portfolio).filter(Portfolio.kind == kind).first()


def ensure_dca_portfolios(db: Session) -> tuple[Portfolio, Portfolio]:
    """Idempotent: the two sample books exist and have kind set."""
    inception = first_dca_session()
    voo = _ensure_book(
        db,
        kind=KIND_DCA_VOO,
        name=VOO_PORTFOLIO_NAME,
        id_hint=2,
        inception=inception,
        params={},
    )
    picks = _ensure_book(
        db,
        kind=KIND_DCA_PICKS,
        name=PICKS_PORTFOLIO_NAME,
        id_hint=3,
        inception=inception,
        params=RUN118_PARAMS.to_dict(),
    )
    db.commit()
    db.refresh(voo)
    db.refresh(picks)
    return voo, picks


def _ensure_book(
    db: Session,
    *,
    kind: str,
    name: str,
    id_hint: int,
    inception: date,
    params: dict,
) -> Portfolio:
    existing = portfolio_by_kind(db, kind)
    if existing:
        if existing.name != name:
            existing.name = name
        return existing
    taken = db.get(Portfolio, id_hint)
    row = Portfolio(
        id=None if taken is not None else id_hint,
        name=name,
        cash=0.0,
        peak_equity=0.0,
        params_json=params,
        inception_date=inception,
        kind=kind,
    )
    db.add(row)
    db.flush()
    return row


def close_on(db: Session, ticker: str, as_of: date) -> float | None:
    row = (
        db.query(PriceBar)
        .filter(PriceBar.ticker == ticker, PriceBar.date == as_of)
        .one_or_none()
    )
    if row is None or row.close is None or row.close <= 0:
        return None
    return float(row.close)


def scores_as_of_date(db: Session, as_of: date) -> date | None:
    """Newest scoring date on or before `as_of`."""
    from sqlalchemy import func

    return (
        db.query(func.max(CompositeScore.as_of))
        .filter(CompositeScore.as_of <= as_of)
        .scalar()
    )


def _trade_session_date(trade: Trade) -> date | None:
    stamped = trade.timestamp
    if stamped is None:
        return None
    if stamped.tzinfo is None:
        stamped = stamped.replace(tzinfo=timezone.utc)
    return stamped.date()


def live_portfolio(db: Session) -> Portfolio | None:
    return portfolio_by_kind(db, KIND_LIVE) or db.get(Portfolio, 1)


def live_open_tickers(db: Session, as_of: date) -> list[str]:
    """Live-book tickers that were still open on `as_of`.

    Rebuilt from fills so a Friday backfill sees that day's open table, not
    today's. Imported lots with no trade history use `entry_date`.
    """
    live = live_portfolio(db)
    if live is None:
        return []

    shares: dict[str, float] = {}
    traded: set[str] = set()
    for trade in db.query(Trade).filter(Trade.portfolio_id == live.id):
        session = _trade_session_date(trade)
        if session is None or session > as_of:
            continue
        traded.add(trade.ticker)
        qty = trade.shares or 0.0
        if trade.side == "buy":
            shares[trade.ticker] = shares.get(trade.ticker, 0.0) + qty
        else:
            shares[trade.ticker] = shares.get(trade.ticker, 0.0) - qty

    open_names = {ticker for ticker, qty in shares.items() if qty > SHARE_EPSILON}
    today = date.today()
    for pos in db.query(Position).filter(Position.portfolio_id == live.id):
        if pos.ticker in traded:
            continue
        if not pos.shares or pos.shares <= SHARE_EPSILON:
            continue
        if pos.entry_date is not None:
            if pos.entry_date <= as_of:
                open_names.add(pos.ticker)
        elif as_of >= today:
            open_names.add(pos.ticker)
    return sorted(open_names)


def buy_universe(db: Session, as_of: date) -> list[str]:
    """Live open positions rated BUY or STRONG BUY as of `as_of`.

    The badge threshold (`quant_rating >= 3.5`), not evaluate()'s 4.0 gate.
    Names on the scored BUY list that the live book does not hold are ignored.
    """
    held = live_open_tickers(db, as_of)
    if not held:
        return []
    score_date = scores_as_of_date(db, as_of)
    if score_date is None:
        return []
    rows = (
        db.query(CompositeScore.ticker)
        .filter(
            CompositeScore.as_of == score_date,
            CompositeScore.ticker.in_(held),
            CompositeScore.quant_rating >= SIGNAL_THRESHOLDS["buy"],
        )
        .order_by(CompositeScore.ticker.asc())
        .all()
    )
    return [t for (t,) in rows]


def _contribution_exists(db: Session, portfolio_id: int, as_of: date) -> bool:
    return (
        db.query(PortfolioContribution)
        .filter(
            PortfolioContribution.portfolio_id == portfolio_id,
            PortfolioContribution.date == as_of,
        )
        .first()
        is not None
    )


def _mark_from_bars(db: Session, portfolio: Portfolio, as_of: date) -> None:
    for pos in db.query(Position).filter(Position.portfolio_id == portfolio.id).all():
        px = close_on(db, pos.ticker, as_of)
        if px is not None:
            pos.current_price = px
            stock = db.get(Stock, pos.ticker)
            if stock is not None:
                stock.last_price = px
        else:
            log.warning(
                "DCA %s: no close for held %s on %s; leaving mark at %s",
                portfolio.kind,
                pos.ticker,
                as_of,
                pos.current_price,
            )
    db.flush()


def _fill_ts(as_of: date) -> datetime:
    return datetime(as_of.year, as_of.month, as_of.day, 20, 0, tzinfo=timezone.utc)


def _fill_buy(
    db: Session,
    portfolio: Portfolio,
    ticker: str,
    price: float,
    notional: float,
    as_of: date,
    reason: str,
    evaluation_id: int | None,
    sector: str | None,
) -> Trade | None:
    if price <= 0 or notional <= 0 or portfolio.cash <= 0:
        return None
    spend = min(notional, portfolio.cash)
    shares = spend / price
    if shares <= 0:
        return None
    portfolio.cash -= spend
    trade = Trade(
        portfolio_id=portfolio.id,
        evaluation_id=evaluation_id,
        ticker=ticker,
        side="buy",
        shares=shares,
        price=price,
        notional=spend,
        reason=reason,
        action=Action.BUY.value,
        timestamp=_fill_ts(as_of),
    )
    db.add(trade)
    pos = (
        db.query(Position)
        .filter(Position.portfolio_id == portfolio.id, Position.ticker == ticker)
        .one_or_none()
    )
    if pos is None:
        db.add(
            Position(
                portfolio_id=portfolio.id,
                ticker=ticker,
                shares=shares,
                avg_cost=price,
                current_price=price,
                entry_date=as_of,
                initial_investment=spend,
                sector=sector,
            )
        )
    else:
        new_shares = pos.shares + shares
        pos.avg_cost = (
            (pos.avg_cost * pos.shares + price * shares) / new_shares
            if new_shares > 0
            else price
        )
        pos.shares = new_shares
        pos.current_price = price
        if pos.initial_investment is None:
            pos.initial_investment = spend
        else:
            pos.initial_investment += spend
        pos.is_house_money = False
        if sector and not pos.sector:
            pos.sector = sector
    return trade


def _sector_for(db: Session, ticker: str, as_of: date) -> str | None:
    score = (
        db.query(CompositeScore)
        .filter(CompositeScore.ticker == ticker, CompositeScore.as_of <= as_of)
        .order_by(CompositeScore.as_of.desc())
        .first()
    )
    if score and score.sector:
        return score.sector
    stock = db.get(Stock, ticker)
    return stock.sector if stock else None


def _equal_weight_buys(
    db: Session,
    portfolio: Portfolio,
    tickers: list[str],
    as_of: date,
    reason: str,
    evaluation_id: int | None,
) -> tuple[list[Trade], list[str]]:
    """Split remaining cash equally across tickers that have a close that day.

    Names with no bar are skipped and the slice is redistributed across the rest.
    """
    priced: list[tuple[str, float]] = []
    missing: list[str] = []
    for ticker in tickers:
        px = close_on(db, ticker, as_of)
        if px is None:
            missing.append(ticker)
            continue
        priced.append((ticker, px))
    if missing:
        log.info(
            "DCA %s %s: skipping %s names with no close (%s)",
            portfolio.kind,
            as_of,
            len(missing),
            ", ".join(missing[:12]) + ("…" if len(missing) > 12 else ""),
        )
    if not priced or portfolio.cash <= 0:
        return [], missing
    slice_amt = portfolio.cash / len(priced)
    trades: list[Trade] = []
    for ticker, price in priced:
        sector = _sector_for(db, ticker, as_of)
        trade = _fill_buy(
            db,
            portfolio,
            ticker,
            price,
            slice_amt,
            as_of,
            reason,
            evaluation_id,
            sector,
        )
        if trade is not None:
            trades.append(trade)
    return trades, missing


def _deposit(db: Session, portfolio: Portfolio, as_of: date) -> PortfolioContribution:
    portfolio.cash = (portfolio.cash or 0.0) + DCA_WEEKLY_AMOUNT
    row = PortfolioContribution(
        portfolio_id=portfolio.id,
        date=as_of,
        amount=DCA_WEEKLY_AMOUNT,
    )
    db.add(row)
    db.flush()
    return row


def _upsert_snapshot(db: Session, portfolio: Portfolio, as_of: date) -> None:
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    invested = sum(p.market_value for p in positions)
    cash = portfolio.cash or 0.0
    spy = close_on(db, "SPY", as_of)
    if spy is None:
        stock = db.get(Stock, "SPY")
        spy = stock.last_price if stock else None
    existing = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.portfolio_id == portfolio.id,
            PortfolioSnapshot.date == as_of,
        )
        .one_or_none()
    )
    if existing:
        existing.cash = cash
        existing.invested_value = invested
        existing.total_value = cash + invested
        existing.position_count = len(positions)
        existing.spy_value = spy
    else:
        db.add(
            PortfolioSnapshot(
                portfolio_id=portfolio.id,
                date=as_of,
                cash=cash,
                invested_value=invested,
                total_value=cash + invested,
                spy_value=spy,
                position_count=len(positions),
            )
        )
    invested_eq = cash + invested
    if portfolio.peak_equity is None or invested_eq > portfolio.peak_equity:
        portfolio.peak_equity = invested_eq


def _run_voo_friday(db: Session, portfolio: Portfolio, as_of: date) -> dict:
    if _contribution_exists(db, portfolio.id, as_of):
        return {"skipped": "already_ran", "kind": KIND_DCA_VOO, "as_of": str(as_of)}
    _mark_from_bars(db, portfolio, as_of)
    _deposit(db, portfolio, as_of)
    trades, missing = _equal_weight_buys(
        db,
        portfolio,
        [DCA_VOO_TICKER],
        as_of,
        reason="Weekly DCA: VOO",
        evaluation_id=None,
    )
    _upsert_snapshot(db, portfolio, as_of)
    return {
        "kind": KIND_DCA_VOO,
        "as_of": str(as_of),
        "buys": len(trades),
        "missing_prices": missing,
        "cash": portfolio.cash,
    }


def _run_picks_friday(db: Session, portfolio: Portfolio, as_of: date) -> dict:
    if _contribution_exists(db, portfolio.id, as_of):
        return {"skipped": "already_ran", "kind": KIND_DCA_PICKS, "as_of": str(as_of)}
    _mark_from_bars(db, portfolio, as_of)
    scores = load_scores_as_of(db, as_of)
    params = params_from_portfolio(portfolio)
    state = load_portfolio_state(db, portfolio, as_of=as_of)
    sell_signals: list[Signal] = evaluate_dca_sells(state, scores, params, as_of=as_of)
    ev = persist_evaluation(
        db,
        portfolio,
        mode="dca",
        params=params,
        state=state,
        signals=sell_signals,
        executed=True,
    )
    sells = 0
    if sell_signals:
        trades = apply_signals(db, portfolio, sell_signals, ev, as_of=as_of)
        sells = len(trades)
    _deposit(db, portfolio, as_of)
    universe = buy_universe(db, as_of)
    if not universe:
        log.warning(
            "DCA picks %s: no live open BUY/STRONG BUY names; carrying cash",
            as_of,
        )
    trades, missing = _equal_weight_buys(
        db,
        portfolio,
        universe,
        as_of,
        reason="Weekly DCA: live open BUY",
        evaluation_id=ev.id,
    )
    _upsert_snapshot(db, portfolio, as_of)
    return {
        "kind": KIND_DCA_PICKS,
        "as_of": str(as_of),
        "universe": len(universe),
        "buys": len(trades),
        "sells": sells,
        "missing_prices": missing,
        "cash": portfolio.cash,
    }


def run_dca_friday(
    db: Session, as_of: date, *, commit: bool = True
) -> dict:
    """One Friday session for both sample books. Idempotent per book/date."""
    voo, picks = ensure_dca_portfolios(db)
    voo_result = _run_voo_friday(db, voo, as_of)
    picks_result = _run_picks_friday(db, picks, as_of)
    if commit:
        db.commit()
    return {"as_of": str(as_of), "voo": voo_result, "picks": picks_result}


def reset_dca_books(db: Session) -> dict[str, int]:
    """Wipe sample-book fills so a backfill can replay from scratch."""
    voo, picks = ensure_dca_portfolios(db)
    ids = [voo.id, picks.id]
    eval_ids = [
        eid
        for (eid,) in db.query(Evaluation.id)
        .filter(Evaluation.portfolio_id.in_(ids))
        .all()
    ]
    n_trades = db.query(Trade).filter(Trade.portfolio_id.in_(ids)).delete(
        synchronize_session=False
    )
    sig_ids: list[int] = []
    if eval_ids:
        sig_ids = [
            sid
            for (sid,) in db.query(SignalRow.id)
            .filter(SignalRow.evaluation_id.in_(eval_ids))
            .all()
        ]
    if sig_ids:
        db.query(SignalReason).filter(SignalReason.signal_id.in_(sig_ids)).delete(
            synchronize_session=False
        )
    if eval_ids:
        db.query(SignalRow).filter(SignalRow.evaluation_id.in_(eval_ids)).delete(
            synchronize_session=False
        )
        db.query(Evaluation).filter(Evaluation.id.in_(eval_ids)).delete(
            synchronize_session=False
        )
    n_contrib = (
        db.query(PortfolioContribution)
        .filter(PortfolioContribution.portfolio_id.in_(ids))
        .delete(synchronize_session=False)
    )
    db.query(PortfolioSnapshot).filter(PortfolioSnapshot.portfolio_id.in_(ids)).delete(
        synchronize_session=False
    )
    n_pos = db.query(Position).filter(Position.portfolio_id.in_(ids)).delete(
        synchronize_session=False
    )
    for book in (voo, picks):
        book.cash = 0.0
        book.peak_equity = 0.0
        book.is_drawdown_halted = False
    db.commit()
    return {
        "trades": int(n_trades or 0),
        "contributions": int(n_contrib or 0),
        "positions": int(n_pos or 0),
    }


def backfill_dca(
    db: Session,
    start: date | None = None,
    end: date | None = None,
    *,
    reset: bool = True,
) -> dict:
    """Replay every Friday session from `start` through `end` inclusive.

    Defaults to wiping the sample books first. The weekly Friday job does not
    call this; it only adds the new week.
    """
    if reset:
        reset_dca_books(db)
    start = start or DCA_START
    if end is None:
        end = _market_calendar()(date.today())
    sessions = dca_sessions_between(start, end)
    ran: list[str] = []
    skipped: list[str] = []
    for session in sessions:
        result = run_dca_friday(db, session, commit=True)
        voo_skip = result["voo"].get("skipped")
        picks_skip = result["picks"].get("skipped")
        if voo_skip and picks_skip:
            skipped.append(str(session))
        else:
            ran.append(str(session))
    return {
        "start": str(start),
        "end": str(end),
        "sessions": len(sessions),
        "ran": ran,
        "skipped": skipped,
    }


def contributed_total(db: Session, portfolio_id: int) -> float:
    from sqlalchemy import func

    total = (
        db.query(func.coalesce(func.sum(PortfolioContribution.amount), 0.0))
        .filter(PortfolioContribution.portfolio_id == portfolio_id)
        .scalar()
    )
    return float(total or 0.0)


def dca_performance_payload(db: Session) -> dict:
    voo = portfolio_by_kind(db, KIND_DCA_VOO)
    picks = portfolio_by_kind(db, KIND_DCA_PICKS)
    if voo is None or picks is None:
        return {
            "inception_date": str(first_dca_session()),
            "weekly_amount": DCA_WEEKLY_AMOUNT,
            "contributed": 0.0,
            "weeks": 0,
            "voo": None,
            "picks": None,
            "delta": None,
            "series": [],
        }

    contributed = contributed_total(db, voo.id)
    weeks = (
        db.query(PortfolioContribution)
        .filter(PortfolioContribution.portfolio_id == voo.id)
        .count()
    )

    def book_summary(p: Portfolio) -> dict:
        positions = db.query(Position).filter(Position.portfolio_id == p.id).all()
        invested = sum(pos.market_value for pos in positions)
        cash = p.cash or 0.0
        value = cash + invested
        roc = (
            round((value / contributed - 1) * 100, 2) if contributed > 0 else None
        )
        return {
            "value": round(value, 2),
            "cash": round(cash, 2),
            "invested": round(invested, 2),
            "position_count": len(positions),
            "return_on_contributed_pct": roc,
        }

    voo_sum = book_summary(voo)
    picks_sum = book_summary(picks)
    delta_dollars = round(picks_sum["value"] - voo_sum["value"], 2)
    delta_pct = (
        round(delta_dollars / contributed * 100, 2) if contributed > 0 else None
    )

    voo_snaps = {
        s.date: s
        for s in db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == voo.id)
        .order_by(PortfolioSnapshot.date.asc())
        .all()
    }
    picks_snaps = {
        s.date: s
        for s in db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == picks.id)
        .order_by(PortfolioSnapshot.date.asc())
        .all()
    }
    contrib_rows = (
        db.query(PortfolioContribution)
        .filter(PortfolioContribution.portfolio_id == voo.id)
        .order_by(PortfolioContribution.date.asc())
        .all()
    )
    running = 0.0
    contrib_by_date: dict[date, float] = {}
    for row in contrib_rows:
        running += row.amount
        contrib_by_date[row.date] = running

    dates = sorted(set(voo_snaps) | set(picks_snaps) | set(contrib_by_date))
    series = []
    last_contrib = 0.0
    for d in dates:
        if d in contrib_by_date:
            last_contrib = contrib_by_date[d]
        series.append(
            {
                "date": d.isoformat(),
                "contributed": round(last_contrib, 2),
                "voo": round(voo_snaps[d].total_value, 2) if d in voo_snaps else None,
                "picks": (
                    round(picks_snaps[d].total_value, 2) if d in picks_snaps else None
                ),
            }
        )

    return {
        "inception_date": (voo.inception_date or first_dca_session()).isoformat(),
        "weekly_amount": DCA_WEEKLY_AMOUNT,
        "contributed": round(contributed, 2),
        "weeks": weeks,
        "voo": voo_sum,
        "picks": picks_sum,
        "delta": {
            "dollars": delta_dollars,
            "pct_of_contributed": delta_pct,
        },
        "series": series,
    }


def dca_holdings_payload(db: Session) -> dict:
    from outpick_strategy import quant_to_signal

    voo = portfolio_by_kind(db, KIND_DCA_VOO)
    picks = portfolio_by_kind(db, KIND_DCA_PICKS)
    score_date = scores_as_of_date(db, date.today())
    ratings: dict[str, CompositeScore] = {}
    if score_date is not None:
        ratings = {
            r.ticker: r
            for r in db.query(CompositeScore)
            .filter(CompositeScore.as_of == score_date)
            .all()
        }

    def holding_row(pos: Position, equity: float) -> dict:
        score = ratings.get(pos.ticker)
        pnl = None
        if pos.avg_cost and pos.avg_cost > 0 and pos.current_price:
            pnl = round((pos.current_price - pos.avg_cost) / pos.avg_cost * 100, 2)
        weight = (
            round(pos.market_value / equity * 100, 2) if equity > 0 else 0.0
        )
        rating = score.quant_rating if score else None
        return {
            "ticker": pos.ticker,
            "sector": pos.sector or (score.sector if score else None),
            "entry_date": pos.entry_date.isoformat() if pos.entry_date else None,
            "weight_pct": weight,
            "pnl_pct": pnl,
            "quant_rating": round(rating, 2) if rating is not None else None,
            "signal": quant_to_signal(rating) if rating is not None else None,
        }

    def holdings_for(p: Portfolio | None) -> list[dict]:
        if p is None:
            return []
        positions = db.query(Position).filter(Position.portfolio_id == p.id).all()
        equity = (p.cash or 0.0) + sum(pos.market_value for pos in positions)
        rows = [holding_row(pos, equity) for pos in positions]
        rows.sort(key=lambda r: r["weight_pct"] or 0, reverse=True)
        return rows

    return {
        "rating_as_of": score_date.isoformat() if score_date else None,
        "voo": holdings_for(voo),
        "picks": holdings_for(picks),
    }
