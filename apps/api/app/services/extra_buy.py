"""A one-off second buy on an evaluation that has already run.

Run 118 makes exactly one add per evaluation, and `run_evaluation` refuses to
replay an executed one, so there is no way to get a second name into a cycle
through the engine. This is that way, deliberately narrow:

  - It attaches to TODAY's executed evaluation rather than writing a new one.
    The ledger then shows both buys as one cycle, and `research-facts` finds a
    real buy signal with rule checks for the research note.
  - The name has to pass the same gates the engine applies (buy criteria,
    earnings blackout, slots, sector cap, correlation, funding), checked on the
    book as it stands after the cycle's first buy. The only rule it overrides
    is `max_adds_per_evaluation`, and the override is recorded as a failed
    rule check on the signal so the audit trail says so.
  - It never repeats. A second call for the same ticker on the same evaluation
    is a no-op.

Dry run unless `commit=True`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from outpick_strategy import Action, RuleCheck, Signal, explain_buy_queue

from app.db.models import Portfolio, SignalRow, Stock
from app.services.portfolio import (
    apply_signals,
    executed_evaluation_today,
    load_latest_scores,
    load_portfolio_state,
    params_from_portfolio,
    persist_signal,
    ranked_candidates,
    return_series_for,
)

log = logging.getLogger(__name__)

# Gates a deliberate second pick may pass through. `max_adds` means "clears
# every gate, another name took the one add" — exactly the situation this
# exists for. `selected` means the engine would buy it next on its own.
_ALLOWED = {"selected", "max_adds", "not_selected"}


class ExtraBuyRefused(Exception):
    pass


@dataclass
class ExtraBuyResult:
    ticker: str
    evaluation_id: int
    committed: bool
    rank: int | None
    queue_status: str
    price: float | None
    target_notional: float
    cash_before: float
    cash_after: float | None = None
    shares: float | None = None
    notional: float | None = None
    cycle_buys: list[str] = field(default_factory=list)
    already_done: bool = False

    def to_dict(self) -> dict:
        return dict(self.__dict__)


def run_extra_buy(
    db: Session,
    ticker: str,
    *,
    portfolio_id: int = 1,
    mode: str = "biweekly",
    commit: bool = False,
    as_of: date | None = None,
) -> ExtraBuyResult:
    ticker = ticker.strip().upper()
    as_of = as_of or date.today()
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise ExtraBuyRefused(f"Portfolio {portfolio_id} not found")

    ev = executed_evaluation_today(db, portfolio_id, mode)
    if ev is None:
        raise ExtraBuyRefused(
            f"No executed '{mode}' evaluation today. Run the cycle first; "
            "this only adds a second name to a cycle that already bought one."
        )

    cycle_rows = (
        db.query(SignalRow)
        .filter(
            SignalRow.evaluation_id == ev.id,
            SignalRow.action.in_(("buy", "double_buy")),
            SignalRow.executed.is_(True),
        )
        .all()
    )
    cycle_buys = [r.ticker for r in cycle_rows]
    if not cycle_buys:
        raise ExtraBuyRefused(
            f"Evaluation {ev.id} bought nothing. A second pick needs a first one."
        )

    params = params_from_portfolio(portfolio)
    state = load_portfolio_state(db, portfolio)
    target = params.target_notional(state.equity)

    if ticker in cycle_buys:
        return ExtraBuyResult(
            ticker=ticker,
            evaluation_id=ev.id,
            committed=False,
            rank=None,
            queue_status="already_bought",
            price=None,
            target_notional=target,
            cash_before=state.cash,
            cycle_buys=cycle_buys,
            already_done=True,
        )
    if ticker in state.positions:
        raise ExtraBuyRefused(f"{ticker} is already held. This is for a new name.")

    scores = load_latest_scores(db)
    ranked = ranked_candidates(scores, params)
    series = return_series_for(db, state, scores, params, as_of)
    queue = explain_buy_queue(
        state, scores, ranked, params, as_of=as_of, return_series=series
    )
    entry = next((c for c in queue.candidates if c.ticker == ticker), None)
    if entry is None:
        raise ExtraBuyRefused(f"{ticker} is not scored or not in the ranked universe.")
    status = "selected" if entry.status == "selected" else (entry.blocked_by or entry.status)
    if status not in _ALLOWED:
        raise ExtraBuyRefused(
            f"{ticker} (rank #{entry.rank}) is blocked: {status}. {entry.message}"
        )

    stock = db.get(Stock, ticker)
    price = stock.last_price if stock else None
    if not price or price <= 0:
        raise ExtraBuyRefused(f"{ticker} has no mark to fill at. Refresh marks first.")
    if state.cash < target:
        # apply_signals would quietly fill whatever cash exists. An under-sized
        # second pick is not what anyone asked for, so stop here instead.
        raise ExtraBuyRefused(
            f"Cash ${state.cash:,.2f} is short of the ${target:,.2f} target size."
        )

    score = entry.score
    signal = Signal(
        action=Action.BUY,
        ticker=ticker,
        reason=(
            f"Second pick this cycle (rank #{entry.rank}): "
            f"Quant {score.quant_rating:.1f}, Rev={score.revisions_grade}, "
            f"Gro={score.growth_grade}, Val={score.valuation_grade}"
        ),
        score=score,
        rules=[
            RuleCheck(
                rule_id="max_adds_per_evaluation",
                passed=False,
                inputs={"limit": params.max_adds_per_evaluation, "attempted": len(cycle_buys) + 1},
                threshold={"max_adds_per_evaluation": params.max_adds_per_evaluation},
                message="One-off override: a second buy added to this cycle by hand",
            ),
            *entry.criteria,
        ],
        metadata={
            "target_notional": target,
            "one_off_extra_buy": True,
            "queue_rank": entry.rank,
            "queue_status": status,
            "cycle_buys": cycle_buys,
        },
    )

    result = ExtraBuyResult(
        ticker=ticker,
        evaluation_id=ev.id,
        committed=False,
        rank=entry.rank,
        queue_status=status,
        price=price,
        target_notional=target,
        cash_before=state.cash,
        cycle_buys=cycle_buys,
    )
    if not commit:
        return result

    persist_signal(db, ev.id, signal)
    trades = apply_signals(db, portfolio, [signal], ev, as_of=as_of)
    if not trades:
        db.rollback()
        raise ExtraBuyRefused(f"{ticker} did not fill; nothing was written.")
    db.commit()
    trade = trades[0]
    result.committed = True
    result.shares = trade.shares
    result.notional = trade.notional
    result.cash_after = portfolio.cash
    result.cycle_buys = [*cycle_buys, ticker]
    log.info("Extra buy %s on evaluation %s: %s", ticker, ev.id, result.to_dict())
    return result
