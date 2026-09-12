"""Materialise composite_scores for every evaluation Friday in a dataset."""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import CompositeScore, UniverseMembership
from worker.services.backtest_derive import derive_universe
from worker.services.scoring import compute_scores

log = logging.getLogger(__name__)


def persist_scores(db: Session, scored, as_of: date) -> dict:
    """Upsert scores for `as_of`; drop stale same-day rows. No live side effects."""
    existing = {
        row.ticker: row
        for row in db.query(CompositeScore).filter(CompositeScore.as_of == as_of).all()
    }
    written = 0
    with_revisions = 0
    for s in scored:
        if s.factor_pcts.get("revisions") is not None:
            with_revisions += 1
        row = existing.pop(s.ticker, None)
        if row is None:
            row = CompositeScore(ticker=s.ticker, as_of=as_of)
            db.add(row)
        row.quant_rating = round(s.quant_rating, 3)
        row.composite = round(s.composite, 3)
        row.valuation_grade = s.grades.get("valuation", "F")
        row.growth_grade = s.grades.get("growth", "F")
        row.profitability_grade = s.grades.get("profitability", "F")
        row.momentum_grade = s.grades.get("momentum", "F")
        row.revisions_grade = s.grades.get("revisions", "F")
        row.sector = s.sector
        written += 1
    dropped = 0
    for stale in existing.values():
        db.delete(stale)
        dropped += 1
    db.commit()
    return {
        "as_of": as_of.isoformat(),
        "written": written,
        "dropped": dropped,
        "with_revisions": with_revisions,
    }


def score_dataset(
    db: Session,
    start: date,
    end: date,
    params: StrategyParams | None = None,
) -> dict:
    """Derive PIT fundamentals and score every evaluation Friday in the window."""
    params = params or RUN118_PARAMS
    fridays = evaluation_fridays_between(start, end)
    results = []
    for friday in fridays:
        members = (
            db.query(UniverseMembership).filter(UniverseMembership.as_of == friday).all()
        )
        if not members:
            log.info("No membership for %s; skipping", friday.isoformat())
            continue
        tickers = [m.ticker for m in members]
        scope = members[0].universe_scope
        derived = derive_universe(db, friday, tickers, universe_scope=scope)
        scored, missing, considered = compute_scores(
            db, params, friday, universe=tickers
        )
        persisted = persist_scores(db, scored, friday)
        persisted.update(
            {
                "universe_scope": scope,
                "membership": len(tickers),
                "derived": derived,
                "considered": considered,
                "missing_factors": missing,
            }
        )
        log.info(
            "Scored %s %s: %s/%s written",
            friday.isoformat(),
            scope,
            persisted["written"],
            considered,
        )
        results.append(persisted)
    return {"fridays": results, "n_fridays": len(results)}
