"""Materialise composite_scores for every evaluation Friday in a dataset."""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import CompositeScore, Fundamentals, UniverseMembership
from worker.services.backtest_derive import DERIVE_VERSION, SOURCE_PIT, derive_universe
from worker.services.scoring import compute_scores

log = logging.getLogger(__name__)

DEGENERATE_REVISIONS_SHARE = 0.90


class DegenerateRevisionsError(RuntimeError):
    """A scored Friday's revisions factor is a constant (self-pair / no info)."""


def revisions_mode_share(grades: list[str]) -> tuple[str | None, float]:
    """Modal revisions grade and its share of `grades`. Share is 0.0 if empty."""
    if not grades:
        return None, 0.0
    mode, count = Counter(grades).most_common(1)[0]
    return mode, count / len(grades)


def assert_revisions_not_degenerate(
    grades: list[str],
    *,
    as_of: date | None = None,
    allow: bool = False,
    threshold: float = DEGENERATE_REVISIONS_SHARE,
) -> tuple[str | None, float]:
    """Raise if n>0 and the modal revisions grade covers `threshold` or more.

    `--allow-degenerate-revisions` sets `allow=True` so a known-bad tape can
    still be scored while the guard is being wired. Production scoring must
    not pass that flag.
    """
    mode, share = revisions_mode_share(grades)
    if grades and share >= threshold and not allow:
        day = as_of.isoformat() if as_of else "unknown"
        raise DegenerateRevisionsError(
            f"degenerate revisions on {day}: mode {mode} share={share:.3f} "
            f"n={len(grades)} (threshold {threshold:.2f})"
        )
    return mode, share


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


def pit_derive_version(data: dict | None) -> int | None:
    if not data or data.get("source") != SOURCE_PIT:
        return None
    raw = data.get("deriveVersion")
    if raw is None:
        return 0
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


def friday_needs_rederive(db: Session, friday: date) -> bool:
    """True when membership exists but pit rows are missing or older than tape v2."""
    has_members = (
        db.query(UniverseMembership.ticker)
        .filter(UniverseMembership.as_of == friday)
        .first()
        is not None
    )
    if not has_members:
        return False
    rows = (
        db.query(Fundamentals)
        .filter(Fundamentals.as_of == friday)
        .limit(32)
        .all()
    )
    pit = [r for r in rows if (r.data or {}).get("source") == SOURCE_PIT]
    if not pit:
        return True
    return any(
        v is None or v < DERIVE_VERSION
        for v in (pit_derive_version(r.data or {}) for r in pit)
    )


def earliest_stale_derive_date(db: Session, start: date, end: date) -> date | None:
    """First evaluation Friday in [start, end] whose pit tape is older than now."""
    for friday in evaluation_fridays_between(start, end):
        if friday_needs_rederive(db, friday):
            return friday
    return None


def revisions_tape_stats(db: Session, as_of: date) -> dict:
    """Lookback histogram and self-pair count from derived pit rows on `as_of`."""
    lookbacks: Counter[int] = Counter()
    n_self = 0
    n_pit = 0
    for row in db.query(Fundamentals).filter(Fundamentals.as_of == as_of).all():
        data = row.data or {}
        if data.get("source") != SOURCE_PIT:
            continue
        n_pit += 1
        lookback = data.get("revisionLookbackDays")
        if lookback is not None:
            try:
                lookbacks[int(lookback)] += 1
            except (TypeError, ValueError):
                pass
        vintage = data.get("estimateVintageAsOf")
        basis = data.get("revisionBasisDate")
        if vintage and basis and vintage == basis:
            n_self += 1
    return {
        "revision_lookback_days": {str(k): v for k, v in sorted(lookbacks.items())},
        "n_self_paired": n_self,
        "n_pit": n_pit,
    }


def score_dataset(
    db: Session,
    start: date,
    end: date,
    params: StrategyParams | None = None,
    *,
    allow_degenerate_revisions: bool = False,
) -> dict:
    """Derive PIT fundamentals and score every evaluation Friday in the window.

    Always re-derives; callers that only want new Fridays pass a narrowed
    `[start, end]`. Walk-forward expands `start` to the earliest Friday whose
    pit rows carry an older or missing `deriveVersion` so a tape fix cannot
    leave stragglers.
    """
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
        grades = [s.grades.get("revisions", "F") for s in scored]
        mode, share = assert_revisions_not_degenerate(
            grades, as_of=friday, allow=allow_degenerate_revisions
        )
        persisted = persist_scores(db, scored, friday)
        tape = revisions_tape_stats(db, friday)
        persisted.update(
            {
                "universe_scope": scope,
                "membership": len(tickers),
                "derived": derived,
                "considered": considered,
                "missing_factors": missing,
                "revisions_grade_mode": mode,
                "revisions_grade_mode_share": round(share, 4) if grades else None,
                "n_self_paired": tape["n_self_paired"],
                "revision_lookback_days": tape["revision_lookback_days"],
                "derive_version": DERIVE_VERSION,
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
    return {
        "fridays": results,
        "n_fridays": len(results),
        "derive_version": DERIVE_VERSION,
    }
