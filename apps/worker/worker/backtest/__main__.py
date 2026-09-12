"""Backtest dataset CLI: ingest | export | membership | hash | upload | score | parity | run | report | compare | download | walk-forward.

    python -m worker.backtest ingest --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest export --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest membership --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest score --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest parity --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest run --config backtests/run118.toml --out /tmp/result.json
    python -m worker.backtest report /tmp/result.json
    python -m worker.backtest compare /tmp/result.json backtests/baselines/run118.json
    python -m worker.backtest compare /tmp/result.json backtests/baselines/run118.json --sweep
    python -m worker.backtest walk-forward --config backtests/run118.toml
    python -m worker.backtest hash --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest upload --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest download --dataset datasets/dataset-v1.sqlite
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db.session import make_engine
from worker.backtest.compare import compare_results, load_result as load_compare, summary_markdown
from worker.backtest.config import load_config
from worker.backtest.download import download_dataset, fetch_pinned_dataset
from worker.backtest.export import export_live_vintages
from worker.backtest.ingest import ingest_dataset
from worker.backtest.manifest import write_manifest
from worker.backtest.membership import write_universe_membership
from worker.backtest.parity import parity_report
from worker.backtest.report import load_result as load_report, render_report, write_equity_csv
from worker.backtest.run import result_fingerprint, run_backtest, write_result
from worker.backtest.score import score_dataset
from worker.backtest.store import open_dataset
from worker.backtest.sweep import run_sweep, sweep_markdown
from worker.backtest.upload import upload_dataset
from worker.services.fmp import FMPClient

log = logging.getLogger("worker.backtest")


def _dates(ns) -> tuple[date, date]:
    end = date.fromisoformat(ns.to) if ns.to else date.today()
    start = (
        date.fromisoformat(ns.from_)
        if ns.from_
        else end - timedelta(days=365 * 3 + 30)
    )
    return start, end


def cmd_ingest(ns) -> dict:
    settings = get_settings()
    db = open_dataset(ns.dataset)
    fmp = FMPClient(settings.fmp_api_key, settings.fmp_base_url, settings.fmp_rate_limit)
    try:
        start, end = _dates(ns)
        extra = [t.strip() for t in (ns.tickers or "").split(",") if t.strip()]
        return ingest_dataset(
            db, fmp, start=start, end=end, resume=not ns.no_resume, extra_tickers=extra
        )
    finally:
        fmp.close()
        db.close()


def cmd_export(ns) -> dict:
    dest = open_dataset(ns.dataset)
    url = ns.from_url or get_settings().database_url
    engine = make_engine(url)
    src: Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        result = export_live_vintages(src, dest)
        if ns.rebuild_membership:
            start, end = _dates(ns)
            result["membership_rows"] = write_universe_membership(dest, start, end)
        return result
    finally:
        src.close()
        dest.close()
        engine.dispose()


def cmd_membership(ns) -> dict:
    db = open_dataset(ns.dataset)
    try:
        start, end = _dates(ns)
        n = write_universe_membership(db, start, end)
        return {"membership_rows": n}
    finally:
        db.close()


def cmd_hash(ns) -> dict:
    dataset = Path(ns.dataset)
    manifest = Path(ns.manifest) if ns.manifest else dataset.parent / "manifest.json"
    return write_manifest(dataset, manifest)


def cmd_upload(ns) -> dict:
    path = Path(ns.dataset)
    result = upload_dataset(path, key=ns.key)
    if ns.manifest:
        result["manifest"] = write_manifest(path, Path(ns.manifest))
    return result


def cmd_score(ns) -> dict:
    db = open_dataset(ns.dataset)
    try:
        start, end = _dates(ns)
        return score_dataset(
            db,
            start,
            end,
            allow_degenerate_revisions=ns.allow_degenerate_revisions,
        )
    finally:
        db.close()


def cmd_parity(ns) -> dict:
    dest = open_dataset(ns.dataset)
    url = ns.from_url or get_settings().database_url
    engine = make_engine(url)
    src: Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        start, end = _dates(ns)
        return parity_report(dest, src, start, end)
    finally:
        src.close()
        dest.close()
        engine.dispose()


def cmd_run(ns) -> dict:
    cfg = load_config(ns.config, dataset_override=ns.dataset)
    db = open_dataset(cfg.dataset)
    ledger_db = None
    ledger_engine = None
    try:
        if ns.ledger_url:
            ledger_engine = make_engine(ns.ledger_url)
            ledger_db = sessionmaker(
                bind=ledger_engine, autoflush=False, autocommit=False
            )()
        payload = run_backtest(
            db,
            cfg,
            sensitivity=not ns.no_sensitivity,
            skip_hash=ns.skip_hash,
            ledger_db=ledger_db,
            ledger_portfolio_id=ns.ledger_portfolio_id,
        )
        write_result(payload, Path(ns.out))
        return {
            "out": ns.out,
            "params_version": payload["params_version"],
            "dataset_sha256": payload["dataset_sha256"],
            "n_evaluations": payload["diagnostics"]["n_evaluations"],
            "metrics_status": payload["metrics"]["status"],
            "fingerprint": result_fingerprint(payload),
            "trades": len(payload["trades"]),
        }
    finally:
        db.close()
        if ledger_db is not None:
            ledger_db.close()
        if ledger_engine is not None:
            ledger_engine.dispose()


def cmd_report(ns) -> dict:
    result = load_report(ns.result)
    text = render_report(result)
    if ns.out:
        Path(ns.out).write_text(text + "\n")
    print(text)
    return {"out": ns.out, "n_evaluations": (result.get("diagnostics") or {}).get("n_evaluations")}


def cmd_compare(ns) -> dict:
    current = load_compare(ns.current)
    baseline = load_compare(ns.baseline)
    update = ns.update_baseline or os.environ.get("UPDATE_BASELINE") == "1"
    report = compare_results(current, baseline, update_baseline=update)
    if ns.sweep:
        cfg_path = ns.config or "backtests/run118.toml"
        cfg = load_config(cfg_path, dataset_override=ns.dataset)
        db = open_dataset(cfg.dataset)
        try:
            report["sweep"] = run_sweep(
                db, cfg, current, skip_hash=ns.skip_hash
            )
        finally:
            db.close()
    if ns.summary:
        print(summary_markdown(report))
        if report.get("sweep"):
            print(sweep_markdown(report["sweep"]))
    return report


def cmd_download(ns) -> dict:
    dest = Path(ns.dataset)
    manifest = Path(ns.manifest) if ns.manifest else None
    if manifest or os.environ.get("BACKTEST_DATASET_URL"):
        return fetch_pinned_dataset(
            dest, manifest=manifest, key=ns.key, sha256=ns.sha256
        )
    return download_dataset(dest, key=ns.key, sha256=ns.sha256)


def cmd_equity_csv(ns) -> dict:
    result = load_report(ns.result)
    path = write_equity_csv(result, Path(ns.out))
    return {"out": str(path), "rows": len(result.get("equity_curve") or [])}


def cmd_walk_forward(ns) -> dict:
    from worker.backtest.walk_forward import (
        WalkForwardError,
        emit_github_output,
        walk_forward,
    )

    url = ns.from_url or os.environ.get("DATABASE_URL")
    if not url:
        result = {
            "skipped": True,
            "reason": "DATABASE_URL not set",
            "changed": False,
            "exit_code": 0,
        }
        emit_github_output(result)
        return result

    cfg = load_config(ns.config, dataset_override=ns.dataset)
    dest = open_dataset(cfg.dataset)
    engine = make_engine(url)
    src: Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    fmp = None
    settings = get_settings()
    if not ns.skip_ingest and settings.fmp_api_key:
        fmp = FMPClient(
            settings.fmp_api_key, settings.fmp_base_url, settings.fmp_rate_limit
        )
    today = date.fromisoformat(ns.today) if ns.today else date.today()
    baseline = Path(ns.baseline) if ns.baseline else None
    try:
        result = walk_forward(
            dest,
            src,
            cfg,
            today=today,
            fmp=fmp,
            skip_ingest=ns.skip_ingest,
            skip_score=ns.skip_score,
            require_parity=not ns.no_parity,
            portfolio_id=ns.ledger_portfolio_id,
            dataset_path=Path(cfg.dataset),
            manifest_path=Path(ns.manifest) if ns.manifest else None,
            upload=ns.upload,
            write_baseline_path=baseline,
        )
        result["exit_code"] = 0
        emit_github_output(result)
        return result
    except WalkForwardError as exc:
        result = {
            "skipped": False,
            "changed": False,
            "error": str(exc),
            "exit_code": getattr(exc, "exit_code", 1),
        }
        emit_github_output(result)
        return result
    finally:
        if fmp is not None:
            fmp.close()
        src.close()
        dest.close()
        engine.dispose()


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    parser = argparse.ArgumentParser(prog="python -m worker.backtest")
    sub = parser.add_subparsers(dest="cmd", required=True)

    ingest = sub.add_parser("ingest", help="Pull FMP history into a dataset sqlite")
    ingest.add_argument("--dataset", required=True)
    ingest.add_argument("--from", dest="from_", default=None)
    ingest.add_argument("--to", dest="to", default=None)
    ingest.add_argument("--tickers", default="")
    ingest.add_argument("--no-resume", action="store_true")

    export = sub.add_parser("export", help="Copy live snapshots/fundamentals into the dataset")
    export.add_argument("--dataset", required=True)
    export.add_argument("--from-url", default=os.environ.get("DATABASE_URL"))
    export.add_argument("--from", dest="from_", default=None)
    export.add_argument("--to", dest="to", default=None)
    export.add_argument("--rebuild-membership", action="store_true")

    membership = sub.add_parser("membership", help="Rebuild universe_membership")
    membership.add_argument("--dataset", required=True)
    membership.add_argument("--from", dest="from_", default=None)
    membership.add_argument("--to", dest="to", default=None)

    hashed = sub.add_parser("hash", help="Write datasets/manifest.json")
    hashed.add_argument("--dataset", required=True)
    hashed.add_argument("--manifest", default=None)

    upload = sub.add_parser("upload", help="Upload the dataset to the Railway bucket")
    upload.add_argument("--dataset", required=True)
    upload.add_argument("--key", default=None)
    upload.add_argument("--manifest", default=None)

    score = sub.add_parser("score", help="Derive PIT fundamentals and write composite_scores")
    score.add_argument("--dataset", required=True)
    score.add_argument("--from", dest="from_", default=None)
    score.add_argument("--to", dest="to", default=None)
    score.add_argument(
        "--allow-degenerate-revisions",
        action="store_true",
        help="Do not raise when a Friday's modal revisions grade share is ≥ 0.90",
    )

    parity = sub.add_parser("parity", help="Diff derived vs live scores on Segment A Fridays")
    parity.add_argument("--dataset", required=True)
    parity.add_argument("--from-url", default=os.environ.get("DATABASE_URL"))
    parity.add_argument("--from", dest="from_", default=None)
    parity.add_argument("--to", dest="to", default=None)

    run = sub.add_parser("run", help="Replay the shipped engine and write result JSON")
    run.add_argument("--config", required=True)
    run.add_argument("--out", required=True)
    run.add_argument("--dataset", default=None)
    run.add_argument("--skip-hash", action="store_true")
    run.add_argument("--no-sensitivity", action="store_true")
    run.add_argument("--ledger-url", default=None)
    run.add_argument("--ledger-portfolio-id", type=int, default=1)

    report = sub.add_parser("report", help="Render a markdown report (no return numbers under N<24)")
    report.add_argument("result")
    report.add_argument("--out", default=None)

    compare = sub.add_parser("compare", help="Diff a result against the committed baseline")
    compare.add_argument("current")
    compare.add_argument("baseline")
    compare.add_argument("--summary", action="store_true")
    compare.add_argument(
        "--update-baseline",
        action="store_true",
        help="Do not fail when the strategy/dataset changed (UPDATE_BASELINE=1)",
    )
    compare.add_argument(
        "--sweep",
        action="store_true",
        help="Perturb numeric thresholds ±10% and run §5 experiment candidates",
    )
    compare.add_argument("--config", default=None)
    compare.add_argument("--dataset", default=None)
    compare.add_argument("--skip-hash", action="store_true")

    download = sub.add_parser("download", help="Download the dataset from URL or the Railway bucket")
    download.add_argument("--dataset", required=True)
    download.add_argument("--key", default=None)
    download.add_argument("--sha256", default=None)
    download.add_argument("--manifest", default=None)

    equity = sub.add_parser("equity-csv", help="Write the equity curve as CSV")
    equity.add_argument("result")
    equity.add_argument("--out", required=True)

    wf = sub.add_parser(
        "walk-forward",
        help="Extend the dataset from live Postgres, score new Fridays, check engine drift",
    )
    wf.add_argument("--config", default="backtests/run118.toml")
    wf.add_argument("--dataset", default=None)
    wf.add_argument("--from-url", default=os.environ.get("DATABASE_URL"))
    wf.add_argument("--manifest", default="datasets/manifest.json")
    wf.add_argument("--today", default=None)
    wf.add_argument("--skip-ingest", action="store_true")
    wf.add_argument("--skip-score", action="store_true")
    wf.add_argument(
        "--no-parity",
        action="store_true",
        help="Skip the dataset ledger diagnostic and the live-score engine-drift check",
    )
    wf.add_argument("--upload", action="store_true")
    wf.add_argument("--baseline", default=None, help="Write regenerated baseline JSON here")
    wf.add_argument("--ledger-portfolio-id", type=int, default=1)

    ns = parser.parse_args(argv)
    fn = {
        "ingest": cmd_ingest,
        "export": cmd_export,
        "membership": cmd_membership,
        "hash": cmd_hash,
        "upload": cmd_upload,
        "score": cmd_score,
        "parity": cmd_parity,
        "run": cmd_run,
        "report": cmd_report,
        "compare": cmd_compare,
        "download": cmd_download,
        "equity-csv": cmd_equity_csv,
        "walk-forward": cmd_walk_forward,
    }[ns.cmd]
    result = fn(ns)
    if ns.cmd == "report":
        return 0
    if ns.cmd == "compare":
        if not ns.summary:
            print(json.dumps(result, default=str, indent=2))
        return int(result.get("exit_code") or 0)
    if ns.cmd == "walk-forward":
        print(json.dumps(result, default=str, indent=2))
        return int(result.get("exit_code") or 0)
    print(json.dumps(result, default=str, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
