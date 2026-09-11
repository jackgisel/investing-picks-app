"""Backtest dataset CLI: ingest | export | membership | hash | upload.

    python -m worker.backtest ingest --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest export --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest membership --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest hash --dataset datasets/dataset-v1.sqlite
    python -m worker.backtest upload --dataset datasets/dataset-v1.sqlite
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db.session import make_engine
from worker.backtest.export import export_live_vintages
from worker.backtest.ingest import ingest_dataset
from worker.backtest.manifest import write_manifest
from worker.backtest.membership import write_universe_membership
from worker.backtest.store import open_dataset
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

    ns = parser.parse_args(argv)
    fn = {
        "ingest": cmd_ingest,
        "export": cmd_export,
        "membership": cmd_membership,
        "hash": cmd_hash,
        "upload": cmd_upload,
    }[ns.cmd]
    result = fn(ns)
    print(json.dumps(result, default=str, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
