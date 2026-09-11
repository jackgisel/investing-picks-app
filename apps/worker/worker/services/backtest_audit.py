"""Segment A audit: what revisions history already lives in `fundamentals`."""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.db.models import ConsensusSnapshot, Fundamentals
from outpick_strategy.cadence import evaluation_fridays_between
from worker.services.ingest import compute_estimate_revisions


def _has_eps_estimate(data: dict | None) -> bool:
    if not data:
        return False
    return data.get("epsEstimateAvg") is not None


def _estimate_payload(data: dict) -> dict:
    return {
        "estimatePeriod": data.get("estimatePeriod"),
        "epsEstimateAvg": data.get("epsEstimateAvg"),
        "revenueEstimateAvg": data.get("revenueEstimateAvg"),
    }


def _latest_fundamentals_on_or_before(
    by_ticker: dict[str, list[Fundamentals]], ticker: str, as_of: date
) -> Fundamentals | None:
    rows = by_ticker.get(ticker) or []
    for row in reversed(rows):
        if row.as_of <= as_of:
            return row
    return None


def audit_segment_a(db: Session, *, today: date | None = None) -> dict:
    """Describe the live weekly-fundamentals revisions window (Segment A).

    Segment A is top-400-by-cap + held names, labelled `top400_live`. Full-
    universe coverage starts the day `snapshot_consensus` first writes.
    """
    today = today or date.today()
    rows = (
        db.query(Fundamentals)
        .order_by(Fundamentals.ticker, Fundamentals.as_of, Fundamentals.id)
        .all()
    )

    first_eps_as_of: date | None = None
    tickers_with_eps: set[str] = set()
    by_date: dict[date, list[Fundamentals]] = defaultdict(list)
    by_ticker: dict[str, list[Fundamentals]] = defaultdict(list)

    for row in rows:
        data = row.data or {}
        by_ticker[row.ticker].append(row)
        if not _has_eps_estimate(data):
            continue
        if first_eps_as_of is None or row.as_of < first_eps_as_of:
            first_eps_as_of = row.as_of
        by_date[row.as_of].append(row)
        tickers_with_eps.add(row.ticker)

    weekly: list[dict] = []
    for as_of in sorted(by_date):
        n_pairs = 0
        for row in by_date[as_of]:
            revision = compute_estimate_revisions(
                db, row.ticker, _estimate_payload(row.data or {}), as_of
            )
            if "epsRevisionPct" in revision and "revenueRevisionPct" in revision:
                n_pairs += 1
        weekly.append(
            {
                "as_of": as_of.isoformat(),
                "tickers_with_estimate": len(by_date[as_of]),
                "tickers_with_revision_pair": n_pairs,
            }
        )

    eval_fridays: list[dict] = []
    if first_eps_as_of is not None:
        for friday in evaluation_fridays_between(first_eps_as_of, today):
            n_estimates = 0
            n_pairs = 0
            for ticker in tickers_with_eps:
                snap = _latest_fundamentals_on_or_before(by_ticker, ticker, friday)
                if snap is None or not _has_eps_estimate(snap.data or {}):
                    continue
                n_estimates += 1
                revision = compute_estimate_revisions(
                    db, ticker, _estimate_payload(snap.data or {}), snap.as_of
                )
                if "epsRevisionPct" in revision and "revenueRevisionPct" in revision:
                    n_pairs += 1
            eval_fridays.append(
                {
                    "friday": friday.isoformat(),
                    "universe_scope": "top400_live",
                    "tickers_with_estimate": n_estimates,
                    "tickers_with_revision_pair": n_pairs,
                }
            )

    first_full = db.query(ConsensusSnapshot.as_of).order_by(
        ConsensusSnapshot.as_of.asc()
    ).first()

    return {
        "first_eps_estimate_as_of": (
            first_eps_as_of.isoformat() if first_eps_as_of else None
        ),
        "tickers_ever_with_estimate": len(tickers_with_eps),
        "weekly_fundamentals": weekly,
        "evaluation_fridays": eval_fridays,
        "universe_scope": "top400_live",
        "segment_b_starts": first_full[0].isoformat() if first_full else None,
    }


def format_segment_a_markdown(audit: dict) -> str:
    """Render the audit dict as the Segment A section of BACKTEST_DATA.md."""
    lines = [
        "## Segment A audit (live `fundamentals` vintages)",
        "",
        f"- Universe scope: `{audit['universe_scope']}` (top-400-by-cap + held).",
        f"- First `fundamentals.as_of` carrying `epsEstimateAvg`: "
        f"**{audit['first_eps_estimate_as_of'] or 'none'}**.",
        f"- Distinct tickers that ever carried an EPS estimate: "
        f"**{audit['tickers_ever_with_estimate']}**.",
        f"- Segment B (full-universe `consensus_snapshots`) starts: "
        f"**{audit['segment_b_starts'] or 'not yet — Phase 1 job has not written'}**.",
        "",
        "### Weekly fundamentals refreshes",
        "",
        "| as_of | tickers with estimate | tickers with 5–21 day pair |",
        "|---|---:|---:|",
    ]
    for row in audit.get("weekly_fundamentals") or []:
        lines.append(
            f"| {row['as_of']} | {row['tickers_with_estimate']} | "
            f"{row['tickers_with_revision_pair']} |"
        )
    if not audit.get("weekly_fundamentals"):
        lines.append("| — | 0 | 0 |")
    lines += [
        "",
        "### Evaluation Fridays in the window",
        "",
        "| friday | universe_scope | tickers with estimate | tickers with 5–21 day pair |",
        "|---|---|---:|---:|",
    ]
    for row in audit.get("evaluation_fridays") or []:
        lines.append(
            f"| {row['friday']} | {row['universe_scope']} | "
            f"{row['tickers_with_estimate']} | {row['tickers_with_revision_pair']} |"
        )
    if not audit.get("evaluation_fridays"):
        lines.append("| — | top400_live | 0 | 0 |")
    lines.append("")
    return "\n".join(lines)
