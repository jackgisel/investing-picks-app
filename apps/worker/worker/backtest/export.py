"""Copy live Postgres vintages into the dataset sqlite file."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.db.models import ConsensusSnapshot, Fundamentals
from worker.backtest.store import bulk_insert

log = logging.getLogger(__name__)


def _snapshot_row(row: ConsensusSnapshot) -> dict:
    return {
        "ticker": row.ticker,
        "as_of": row.as_of,
        "fiscal_period": row.fiscal_period,
        "eps_avg": row.eps_avg,
        "eps_high": row.eps_high,
        "eps_low": row.eps_low,
        "revenue_avg": row.revenue_avg,
        "revenue_high": row.revenue_high,
        "revenue_low": row.revenue_low,
        "analyst_count": row.analyst_count,
        "raw": dict(row.raw or {}),
        "fetched_at": row.fetched_at,
    }


def _fundamentals_row(row: Fundamentals) -> dict:
    return {
        "ticker": row.ticker,
        "as_of": row.as_of,
        "data": dict(row.data or {}),
    }


def export_live_vintages(src: Session, dest: Session) -> dict:
    """Append-only copy of consensus_snapshots and Segment A fundamentals."""
    snaps = [_snapshot_row(r) for r in src.query(ConsensusSnapshot).all()]
    funds = [_fundamentals_row(r) for r in src.query(Fundamentals).all()]
    n_snaps = bulk_insert(
        dest,
        ConsensusSnapshot.__table__,
        snaps,
        ["ticker", "as_of", "fiscal_period"],
    )
    # Fundamentals uniqueness is (ticker, as_of) via the runtime index, not
    # always a table constraint. Insert-or-skip on that pair.
    n_funds = bulk_insert(
        dest, Fundamentals.__table__, funds, ["ticker", "as_of"]
    )
    log.info(
        "Exported %s consensus snapshots and %s fundamentals rows", n_snaps, n_funds
    )
    return {
        "consensus_snapshots": n_snaps,
        "fundamentals": n_funds,
    }
