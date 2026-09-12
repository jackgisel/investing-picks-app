"""Nightly walk-forward: extend the dataset, re-derive, live ledger checks.

A weekday without a consensus snapshot is a permanent hole in the revisions
window. This module fails loudly rather than paper over it.

Dataset replay vs the live ledger is a diagnostic. Those score tapes do not
match yet, so a trade diff must not fail the job or block the pin PR.
Replay against live scores with `params_from_portfolio` is the engine-drift
check and still fails the job.
"""

from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import CompositeScore, Portfolio
from app.services.portfolio import params_from_portfolio
from app.services.replay import reconstruct_book, replay
from worker.backtest.config import BacktestConfig, load_config, update_config_pin
from worker.backtest.export import export_live_vintages
from worker.backtest.ingest import ingest_delta
from worker.backtest.manifest import sha256_file, write_manifest
from worker.backtest.membership import write_universe_membership
from worker.backtest.run import params_from_config, run_backtest, scored_eval_dates, write_result
from worker.backtest.score import score_dataset
from worker.backtest.upload import upload_dataset
from worker.services.fmp import FMPClient
from worker.services.ingest import missing_snapshot_weekdays

log = logging.getLogger(__name__)


class WalkForwardError(RuntimeError):
    exit_code = 1


class SnapshotGapError(WalkForwardError):
    """A weekday is missing from consensus_snapshots. Permanent hole."""

    exit_code = 1


class LedgerParityError(WalkForwardError):
    """Live-score replay disagrees with the live ledger. Engine drift."""

    exit_code = 2


def latest_complete_evaluation_friday(today: date) -> date | None:
    """Newest 1st/3rd Friday strictly before `today`.

    Nightly CI runs at 08:00 UTC, before the 11:00 ET evaluation, so a Friday
    morning must not treat today as complete.
    """
    fridays = evaluation_fridays_between(date(2026, 1, 1), today - timedelta(days=1))
    return fridays[-1] if fridays else None


def require_no_snapshot_gaps(live_db: Session, today: date) -> list[date]:
    gaps = missing_snapshot_weekdays(live_db, today)
    if gaps:
        listed = ", ".join(d.isoformat() for d in gaps[:20])
        extra = f" (+{len(gaps) - 20} more)" if len(gaps) > 20 else ""
        raise SnapshotGapError(
            f"permanent consensus snapshot hole(s) before {today.isoformat()}: "
            f"{listed}{extra}"
        )
    return []


def last_scored_friday(dataset_db: Session) -> date | None:
    return dataset_db.query(func.max(CompositeScore.as_of)).scalar()


def _live_portfolio(live_db: Session, portfolio_id: int | None) -> Portfolio | None:
    if portfolio_id is not None:
        return live_db.get(Portfolio, portfolio_id)
    return (
        live_db.query(Portfolio)
        .filter(Portfolio.kind == "live")
        .order_by(Portfolio.id.asc())
        .first()
    )


def _opening_book(
    live_db: Session, cfg: BacktestConfig, portfolio_id: int | None
) -> tuple[Portfolio | None, Any]:
    portfolio = _live_portfolio(live_db, portfolio_id)
    if portfolio is None:
        return None, None
    return portfolio, reconstruct_book(live_db, portfolio, cfg.start - timedelta(days=1))


def _mismatch_row(row: dict[str, Any]) -> dict[str, str]:
    day = row.get("date") or row.get("fill_date") or ""
    if hasattr(day, "isoformat"):
        day = day.isoformat()
    return {
        "date": str(day),
        "ticker": str(row.get("ticker") or ""),
        "side": str(row.get("side") or ""),
        "action": str(row.get("action") or ""),
    }


def mismatch_rows(diff: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    return {
        "only_in_ledger": [_mismatch_row(r) for r in (diff.get("only_in_ledger") or [])],
        "only_in_replay": [_mismatch_row(r) for r in (diff.get("only_in_replay") or [])],
    }


def _format_mismatches(diff: dict[str, Any]) -> str:
    rows = mismatch_rows(diff)
    parts: list[str] = []
    for key in ("only_in_ledger", "only_in_replay"):
        listed = ", ".join(
            f"{r['date']} {r['ticker']} {r['side']} {r['action']}" for r in rows[key]
        )
        parts.append(f"{key}=[{listed}]" if listed else f"{key}=[]")
    return " ".join(parts)


def _append_step_summary(lines: list[str]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a") as fh:
        fh.write("\n".join(lines) + "\n")


def _mismatch_table(title: str, rows: list[dict[str, str]]) -> list[str]:
    if not rows:
        return [f"### {title}", "", "_none_", ""]
    out = [
        f"### {title}",
        "",
        "| date | ticker | side | action |",
        "| --- | --- | --- | --- |",
    ]
    for r in rows:
        out.append(f"| {r['date']} | {r['ticker']} | {r['side']} | {r['action']} |")
    out.append("")
    return out


def write_dataset_ledger_summary(payload: dict[str, Any]) -> None:
    """Dataset-vs-live diffs go in the step summary. They do not fail the job."""
    if payload.get("skipped"):
        _append_step_summary(
            [
                "## Dataset vs live ledger",
                "",
                f"Skipped ({payload.get('reason') or 'unspecified'}).",
                "",
            ]
        )
        return
    rows = mismatch_rows(payload)
    lines = [
        "## Dataset vs live ledger",
        "",
        "Replay used dataset scores. Those can disagree with the live book until "
        "the score tapes match. This does not fail the job or block the pin PR.",
        "",
    ]
    if payload.get("parity"):
        lines.append("Matched on engine trades in the window.")
        lines.append("")
    else:
        lines.extend(_mismatch_table("Only in ledger", rows["only_in_ledger"]))
        lines.extend(_mismatch_table("Only in replay", rows["only_in_replay"]))
    _append_step_summary(lines)


def dataset_ledger_diff(
    dataset_db: Session,
    live_db: Session,
    cfg: BacktestConfig,
    *,
    portfolio_id: int | None = 1,
) -> dict[str, Any]:
    """Replay dataset scores from the reconstructed live book. Never raises."""
    portfolio, book = _opening_book(live_db, cfg, portfolio_id)
    if portfolio is None:
        payload = {"skipped": True, "reason": "no live portfolio", "parity": True}
        write_dataset_ledger_summary(payload)
        return payload
    params = params_from_config(cfg)
    eval_dates = scored_eval_dates(dataset_db, cfg.start, cfg.end, cfg.universe_scope)
    result = replay(
        dataset_db,
        params,
        cfg.start,
        cfg.end,
        initial_book=book,
        eval_dates=eval_dates,
    )
    diff = result.diff_against_ledger(live_db, portfolio.id)
    payload = {
        "skipped": False,
        "portfolio_id": portfolio.id,
        "n_evaluations": len(result.evaluations),
        **diff,
    }
    if not diff.get("parity"):
        log.warning("dataset vs live ledger diagnostic: %s", _format_mismatches(diff))
    write_dataset_ledger_summary(payload)
    return payload


def live_parity(
    dataset_db: Session,
    live_db: Session,
    cfg: BacktestConfig,
    *,
    portfolio_id: int | None = 1,
) -> dict[str, Any]:
    """Back-compat alias for the dataset-vs-live diagnostic."""
    return dataset_ledger_diff(
        dataset_db, live_db, cfg, portfolio_id=portfolio_id
    )


def engine_drift_check(
    live_db: Session,
    cfg: BacktestConfig,
    *,
    portfolio_id: int | None = 1,
) -> dict[str, Any]:
    """Replay live scores with live params. Raises on a ledger mismatch."""
    portfolio, book = _opening_book(live_db, cfg, portfolio_id)
    if portfolio is None:
        return {"skipped": True, "reason": "no live portfolio", "parity": True}
    params = params_from_portfolio(portfolio)
    eval_dates = scored_eval_dates(live_db, cfg.start, cfg.end, "all")
    result = replay(
        live_db,
        params,
        cfg.start,
        cfg.end,
        initial_book=book,
        eval_dates=eval_dates,
    )
    diff = result.diff_against_ledger(live_db, portfolio.id)
    payload = {
        "skipped": False,
        "portfolio_id": portfolio.id,
        "n_evaluations": len(result.evaluations),
        **diff,
    }
    if not diff.get("parity"):
        detail = _format_mismatches(diff)
        _append_step_summary(
            [
                "## Engine drift",
                "",
                "Live-score replay with `params_from_portfolio` disagrees with the ledger.",
                "",
                *(_mismatch_table("Only in ledger", mismatch_rows(diff)["only_in_ledger"])),
                *(_mismatch_table("Only in replay", mismatch_rows(diff)["only_in_replay"])),
            ]
        )
        raise LedgerParityError(f"engine drift: {detail}")
    return payload


def walk_forward(
    dataset_db: Session,
    live_db: Session,
    cfg: BacktestConfig,
    *,
    today: date | None = None,
    fmp: FMPClient | None = None,
    skip_ingest: bool = False,
    skip_score: bool = False,
    require_parity: bool = True,
    portfolio_id: int | None = 1,
    dataset_path: Path | None = None,
    manifest_path: Path | None = None,
    upload: bool = False,
    write_baseline_path: Path | None = None,
) -> dict[str, Any]:
    """Export new vintages, ingest delta bars, score new Fridays.

    Snapshot holes still fail. Dataset-vs-live trade diffs are written to the
    step summary and do not fail. Live-score replay with live params does.
    """
    today = today or date.today()
    end_before = cfg.end
    require_no_snapshot_gaps(live_db, today)
    complete = latest_complete_evaluation_friday(today)
    if complete is None:
        raise WalkForwardError(f"no complete evaluation Friday before {today}")

    old_hash = sha256_file(dataset_path) if dataset_path and dataset_path.exists() else None
    exported = export_live_vintages(live_db, dataset_db)

    ingest_info: dict[str, Any] = {"skipped": True}
    if skip_ingest:
        ingest_info = {"skipped": True, "reason": "skip_ingest"}
    elif fmp is None:
        last_scored = last_scored_friday(dataset_db)
        if last_scored is None or complete > last_scored:
            raise WalkForwardError(
                "FMP_API_KEY required to ingest bars for a new evaluation Friday "
                f"({complete.isoformat()})"
            )
        ingest_info = {"skipped": True, "reason": "no FMP client; no new Friday"}
    else:
        ingest_info = ingest_delta(
            dataset_db, fmp, history_start=cfg.start, end=today
        )
        if ingest_info.get("stopped_on_access_error"):
            raise WalkForwardError("FMP access error during delta ingest")

    last_scored = last_scored_friday(dataset_db)
    member_start = (last_scored + timedelta(days=1)) if last_scored else cfg.start
    if member_start > complete:
        membership_rows = 0
        scored = {"n_fridays": 0, "fridays": []}
    else:
        membership_rows = write_universe_membership(dataset_db, member_start, complete)
        if skip_score:
            scored = {"skipped": True, "n_fridays": 0, "fridays": []}
        else:
            scored = score_dataset(dataset_db, member_start, complete)

    new_end = complete
    if dataset_path is not None:
        extra = {"walk_forward_as_of": today.isoformat()}
        if manifest_path is not None:
            written = write_manifest(dataset_path, manifest_path, extra=extra)
            new_hash = written["sha256"]
        else:
            new_hash = sha256_file(dataset_path)
            written = {"sha256": new_hash}
        if new_end != cfg.end or new_hash != cfg.dataset_sha256:
            update_config_pin(cfg.source, end=new_end, dataset_sha256=new_hash)
    else:
        new_hash = old_hash
        written = {"sha256": new_hash}

    cfg = load_config(cfg.source, dataset_override=str(dataset_path) if dataset_path else None)

    skipped = {"skipped": True, "reason": "require_parity=false", "parity": True}
    if require_parity:
        parity = dataset_ledger_diff(
            dataset_db, live_db, cfg, portfolio_id=portfolio_id
        )
        engine_drift = engine_drift_check(
            live_db, cfg, portfolio_id=portfolio_id
        )
    else:
        parity = skipped
        engine_drift = dict(skipped)

    payload = None
    if write_baseline_path is not None:
        payload = run_backtest(
            dataset_db,
            cfg,
            sensitivity=True,
            skip_hash=dataset_path is None,
        )
        write_result(payload, write_baseline_path)

    uploaded = None
    changed = (new_hash != old_hash) or (new_end != end_before)
    if upload:
        if dataset_path is None:
            raise WalkForwardError("upload requested but dataset_path is missing")
        uploaded = upload_dataset(dataset_path)

    result = {
        "skipped": False,
        "changed": changed,
        "today": today.isoformat(),
        "complete_friday": complete.isoformat(),
        "exported": exported,
        "ingest": ingest_info,
        "membership_rows": membership_rows,
        "scored": {"n_fridays": scored.get("n_fridays"), "fridays": scored.get("fridays")},
        "parity": parity,
        "engine_drift": engine_drift,
        "old_sha256": old_hash,
        "new_sha256": new_hash,
        "new_end": new_end.isoformat(),
        "manifest": written,
        "uploaded": uploaded,
        "n_evaluations": (payload or {}).get("diagnostics", {}).get("n_evaluations")
        if payload
        else None,
    }
    return result


def emit_github_output(result: dict[str, Any]) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    changed = "true" if result.get("changed") else "false"
    with open(path, "a") as fh:
        fh.write(f"changed={changed}\n")
        fh.write(f"new_sha256={result.get('new_sha256') or ''}\n")
        fh.write(f"new_end={result.get('new_end') or ''}\n")
        parity = (result.get("parity") or {}).get("parity")
        fh.write(f"parity={'true' if parity else 'false'}\n")
        engine = (result.get("engine_drift") or {}).get("parity")
        fh.write(f"engine_drift={'true' if engine else 'false'}\n")
