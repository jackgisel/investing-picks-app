"""Run the equity-curve backfill on demand.

Two ways in, both hitting the same code path:

    # dry run — logs every row it would write, commits nothing
    python -m worker.backfill_snapshots --dry-run

    # for real
    python -m worker.backfill_snapshots --commit

    # from the deployed worker, without redeploying a new entrypoint
    RUN_JOB_ONCE=backfill_snapshots python -m worker.main          # dry run
    RUN_JOB_ONCE=backfill_snapshots BACKFILL_COMMIT=1 python -m worker.main

`--dry-run` is the default. This script writes the numbers behind a public
performance claim, so persisting has to be asked for explicitly.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import date

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_API = os.path.join(_ROOT, "apps", "api")
if _API not in sys.path:
    sys.path.insert(0, _API)

from app.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.portfolio import ensure_default_portfolio  # noqa: E402
from worker.services.backfill import backfill_snapshots  # noqa: E402
from worker.services.fmp import FMPClient  # noqa: E402

log = logging.getLogger("worker.backfill")


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def run(
    start: date | None = None,
    end: date | None = None,
    dry_run: bool = True,
    allow_missing_prices: bool = False,
    write_price_bars: bool = True,
):
    settings = get_settings()
    fmp = FMPClient(settings.fmp_api_key, settings.fmp_base_url)
    db = SessionLocal()
    try:
        portfolio = ensure_default_portfolio(db, settings.initial_cash)
        plan = backfill_snapshots(
            db,
            fmp,
            portfolio,
            start=start,
            end=end,
            dry_run=dry_run,
            allow_missing_prices=allow_missing_prices,
            write_price_bars=write_price_bars,
        )
        return {
            "snapshots": len(plan.rows),
            "start": plan.start.isoformat(),
            "end": plan.end.isoformat(),
            "lots": len(plan.lots),
            "dry_run": dry_run,
            "warnings": plan.warnings,
        }
    finally:
        db.close()
        fmp.close()


def run_from_env():
    """Entry point for `RUN_JOB_ONCE=backfill_snapshots`.

    Dry run unless BACKFILL_COMMIT is set, matching the CLI default.
    """
    return run(
        start=_parse_date(os.environ.get("BACKFILL_START")),
        end=_parse_date(os.environ.get("BACKFILL_END")),
        dry_run=not os.environ.get("BACKFILL_COMMIT"),
        allow_missing_prices=bool(os.environ.get("BACKFILL_ALLOW_MISSING_PRICES")),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        default=True,
        help="log the reconstructed rows and write nothing (default)",
    )
    mode.add_argument(
        "--commit",
        dest="dry_run",
        action="store_false",
        help="persist the reconstructed snapshots",
    )
    parser.add_argument("--start", help="ISO date; defaults to portfolio inception")
    parser.add_argument("--end", help="ISO date; defaults to today")
    parser.add_argument(
        "--allow-missing-prices",
        action="store_true",
        help=(
            "hold tickers with no FMP history flat at cost instead of aborting. "
            "Produces a zero-volatility segment in the curve — use knowingly."
        ),
    )
    parser.add_argument(
        "--no-price-bars",
        action="store_true",
        help="skip upserting the fetched closes into price_bars",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    result = run(
        start=_parse_date(args.start),
        end=_parse_date(args.end),
        dry_run=args.dry_run,
        allow_missing_prices=args.allow_missing_prices,
        write_price_bars=not args.no_price_bars,
    )
    log.info("Result: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
