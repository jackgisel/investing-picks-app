"""Backfill current holdings with their latest reported earnings.

Dry-run by default:

    python -m worker.backfill_earnings
    python -m worker.backfill_earnings --commit

This is a one-time repair for fundamentals snapshots created before earnings
actuals were stored. Weekly fundamentals refreshes keep the fields current
afterward.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_API = os.path.join(_ROOT, "apps", "api")
if _API not in sys.path:
    sys.path.insert(0, _API)

from app.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from worker.services.fmp import FMPClient  # noqa: E402
from worker.services.ingest import backfill_holding_earnings  # noqa: E402

log = logging.getLogger("worker.backfill_earnings")


def run(*, commit: bool = False) -> dict[str, int]:
    settings = get_settings()
    db = SessionLocal()
    fmp = FMPClient(
        settings.fmp_api_key,
        settings.fmp_base_url,
        rate_limit=settings.fmp_rate_limit,
    )
    try:
        return backfill_holding_earnings(db, fmp, commit=commit)
    finally:
        db.close()
        fmp.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--commit",
        action="store_true",
        help="persist the backfill; without this flag the transaction is rolled back",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    result = run(commit=args.commit)
    result["committed"] = int(args.commit)
    log.info("Earnings backfill: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
