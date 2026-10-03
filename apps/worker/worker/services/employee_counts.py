"""Employee headcount — our own dataset, built from FMP's 10-K extracts.

Headcount is annual: a company states it once a year in its 10-K. So the job
is not a daily poll like the consensus snapshot. It walks the universe, asks
only about names that could plausibly have a new filing, and appends what it
finds. Rows are never rewritten (see `EmployeeCount`), and `filing_date` is the
date a number became public.
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import CompanyRevenue, EmployeeCount, EmployeeCountCheck
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.ingest import held_tickers, snapshot_universe_tickers, today_et

log = logging.getLogger(__name__)

EMPLOYEE_COUNTS_JOB = "employee_counts_refresh"
EMPLOYEE_COUNTS_TIMEOUT_MINUTES = 40.0
#: Stop starting new requests this long before the hard deadline, so a big
#: first load ends as a clean partial run (the next one resumes) instead of a
#: timeout error that mails the admins.
EMPLOYEE_COUNTS_BUDGET_MINUTES = 34.0
#: A new 10-K cannot appear sooner than this after the last one we hold.
REFILE_AFTER_DAYS = 330
#: How often to look again at a name whose latest filing is due or overdue.
RECHECK_DUE_DAYS = 14
#: How often to look again at a name FMP had nothing for.
RECHECK_EMPTY_DAYS = 60
HISTORY_LIMIT = 10
#: Consecutive per-request access errors that mean the endpoint is off-plan
#: rather than one symbol being restricted.
ACCESS_ERROR_LIMIT = 3
#: Revenue-only requests per run for names that have a headcount but no revenue.
REVENUE_BACKFILL_LIMIT = 100
#: This many never-asked names with none returning data is a broken source,
#: not thin coverage.
ALL_EMPTY_ALARM = 25


def _parse_date(raw) -> date | None:
    try:
        return date.fromisoformat(str(raw)[:10]) if raw else None
    except ValueError:
        return None


def parse_employee_count(row: dict) -> dict | None:
    """One FMP headcount row, or None if it cannot be stored point-in-time.

    A row with no filing (or SEC acceptance) date is dropped rather than
    guessed: that date is what stops a backtest reading a number before the
    market could. There is no fallback to the period end.
    """
    period = _parse_date(row.get("periodOfReport"))
    filed = _parse_date(row.get("filingDate") or row.get("acceptanceTime"))
    if period is None or filed is None:
        return None
    try:
        count = int(float(row.get("employeeCount")))
    except (TypeError, ValueError):
        return None
    if count < 0:
        return None
    return {
        "period_of_report": period,
        "filing_date": filed,
        "employee_count": count,
        "form_type": (str(row["formType"])[:16] if row.get("formType") else None),
        "source_url": (str(row["source"])[:512] if row.get("source") else None),
        "raw": dict(row),
    }


def bulk_insert_employee_counts(db: Session, rows: list[dict]) -> int:
    """Append rows, skipping any already stored. Returns rows attempted."""
    if not rows:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:  # pragma: no cover - only these two are ever deployed
        raise RuntimeError(f"unsupported dialect {dialect}")
    stmt = _insert(EmployeeCount.__table__).values(rows)
    db.execute(
        stmt.on_conflict_do_nothing(
            index_elements=["ticker", "period_of_report", "filing_date"]
        )
    )
    db.commit()
    return len(rows)


def parse_revenue(row: dict) -> dict | None:
    """One annual income statement as a revenue row, or None if unusable."""
    period = _parse_date(row.get("date"))
    try:
        revenue = float(row.get("revenue"))
    except (TypeError, ValueError):
        return None
    if period is None or revenue <= 0:
        return None
    return {
        "period": period,
        "filing_date": _parse_date(
            row.get("acceptedDate") or row.get("filingDate") or row.get("fillingDate")
        ),
        "revenue": revenue,
        "currency": (str(row["reportedCurrency"])[:8] if row.get("reportedCurrency") else None),
    }


def store_revenue(db: Session, ticker: str, statements: list[dict]) -> int:
    """Append annual revenue, keeping the first value seen for each year."""
    now = datetime.now(timezone.utc)
    parsed: dict[date, dict] = {}
    for st in statements or []:
        item = parse_revenue(st)
        if item is None:
            continue
        item.update(ticker=ticker, fetched_at=now)
        parsed[item["period"]] = item
    if not parsed:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:  # pragma: no cover - only these two are ever deployed
        raise RuntimeError(f"unsupported dialect {dialect}")
    stmt = _insert(CompanyRevenue.__table__).values(list(parsed.values()))
    db.execute(stmt.on_conflict_do_nothing(index_elements=["ticker", "period"]))
    db.commit()
    return len(parsed)


def _fetch_revenue(db: Session, fmp: FMPClient, ticker: str) -> int:
    """Store a ticker's annual revenue. Never aborts the run: revenue is the
    secondary fetch, and a refusal on one symbol (or an empty statement) only
    leaves that name for `backfill_revenue`."""
    try:
        statements = fmp.income_statement_annual(ticker, limit=HISTORY_LIMIT)
    except FMPAccessError:
        log.warning("income-statement refused for %s; leaving it for the backfill", ticker)
        return 0
    return store_revenue(db, ticker, statements)


def backfill_revenue(
    db: Session, fmp: FMPClient, universe: list[str], limit: int, started: float, budget: float
) -> int:
    """Revenue-only pass for names that have a headcount but no revenue yet.

    One request each and capped per run, so a name whose statements never
    parse costs a handful of requests a week, not a re-pull of its headcount.
    """
    have_headcount = {
        t
        for (t,) in db.query(EmployeeCount.ticker)
        .filter(EmployeeCount.ticker.in_(universe))
        .distinct()
        .all()
    }
    have_revenue = {
        t
        for (t,) in db.query(CompanyRevenue.ticker)
        .filter(CompanyRevenue.ticker.in_(universe))
        .distinct()
        .all()
    }
    done = 0
    for ticker in sorted(have_headcount - have_revenue):
        if done >= limit or time.monotonic() - started > budget:
            break
        _fetch_revenue(db, fmp, ticker)
        done += 1
    return done


def _record_check(db: Session, ticker: str, rows: int, now: datetime) -> None:
    check = db.get(EmployeeCountCheck, ticker)
    if check is None:
        db.add(EmployeeCountCheck(ticker=ticker, checked_at=now, rows=rows))
    else:
        check.checked_at = now
        check.rows = rows
    db.commit()


def tickers_to_check(
    db: Session, universe: list[str], today: date, now: datetime | None = None
) -> list[str]:
    """Names worth a request now, never-asked first.

    - never asked: always
    - asked, FMP had nothing: again after `RECHECK_EMPTY_DAYS`
    - have a filing: only once it is `REFILE_AFTER_DAYS` old (a new 10-K could
      exist), then at most every `RECHECK_DUE_DAYS`
    """
    now = now or datetime.now(timezone.utc)
    latest_filing = dict(
        db.query(EmployeeCount.ticker, func.max(EmployeeCount.filing_date))
        .filter(EmployeeCount.ticker.in_(universe))
        .group_by(EmployeeCount.ticker)
        .all()
    )
    checked = {
        c.ticker: c
        for c in db.query(EmployeeCountCheck)
        .filter(EmployeeCountCheck.ticker.in_(universe))
        .all()
    }

    def _age_days(check: EmployeeCountCheck) -> float:
        at = check.checked_at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        return (now - at).total_seconds() / 86400

    never, due = [], []
    for ticker in universe:
        check = checked.get(ticker)
        if check is None:
            never.append(ticker)
            continue
        filed = latest_filing.get(ticker)
        if filed is None:
            if _age_days(check) >= RECHECK_EMPTY_DAYS:
                due.append(ticker)
        elif (today - filed).days >= REFILE_AFTER_DAYS and (
            _age_days(check) >= RECHECK_DUE_DAYS
        ):
            due.append(ticker)
    return never + due


def refresh_employee_counts(
    db: Session,
    fmp: FMPClient,
    today: date | None = None,
    budget_seconds: float | None = None,
) -> dict:
    """Append new headcount filings for every name that could have one.

    Resumable: each ticker commits as it goes and records a check, so a run
    that stops on its time budget picks up where it left off next time.
    Raises if the endpoint is off-plan, or if a whole run of requests came
    back empty — either way a green run of zeros would hide the problem.
    """
    today = today or today_et()
    budget = (
        EMPLOYEE_COUNTS_BUDGET_MINUTES * 60 if budget_seconds is None else budget_seconds
    )
    started = time.monotonic()

    universe = sorted(snapshot_universe_tickers(db, fmp))
    if not universe:
        raise RuntimeError("employee count universe is empty")
    held = held_tickers(db)
    # Held names first, so a partial first load never leaves the book dark.
    universe.sort(key=lambda t: (t not in held, t))
    queue = tickers_to_check(db, universe, today)

    checked_before = {t for (t,) in db.query(EmployeeCountCheck.ticker).all()}
    asked = with_data = empty = errors = rows_attempted = 0
    first_asked = 0
    access_streak = 0
    for ticker in queue:
        if time.monotonic() - started > budget:
            break
        try:
            history = fmp.employee_count_history(ticker, limit=HISTORY_LIMIT)
        except FMPAccessError:
            access_streak += 1
            if access_streak >= ACCESS_ERROR_LIMIT:
                log.exception(
                    "historical-employee-count is not available; stopping so "
                    "the gap is visible instead of a green run of zeros"
                )
                raise
            # One restricted symbol must not block the rest. No check row, so
            # it is simply asked again next run.
            errors += 1
            continue
        access_streak = 0
        if history is None:
            # The request failed; that says nothing about the name, and
            # recording it as empty would hide it for RECHECK_EMPTY_DAYS.
            errors += 1
            continue
        now = datetime.now(timezone.utc)
        parsed: dict[tuple, dict] = {}
        for row in history or []:
            item = parse_employee_count(row)
            if item is None:
                continue
            item["ticker"] = ticker
            item["fetched_at"] = now
            parsed[(item["period_of_report"], item["filing_date"])] = item
        rows_attempted += bulk_insert_employee_counts(db, list(parsed.values()))
        if parsed:
            # The 10-K that carries the headcount also carries the year's
            # revenue; one more request per name that has a headcount.
            _fetch_revenue(db, fmp, ticker)
        _record_check(db, ticker, len(parsed), now)
        asked += 1
        if ticker not in checked_before:
            first_asked += 1
        if parsed:
            with_data += 1
        else:
            empty += 1
        if asked % 50 == 0:
            log.info("Employee counts progress: %s/%s", asked, len(queue))

    revenue_backfilled = backfill_revenue(
        db, fmp, universe, REVENUE_BACKFILL_LIMIT, started, budget
    )

    # Only never-asked names count toward the alarm: a recheck batch of names
    # FMP never had data for is expected to come back empty.
    if first_asked + errors >= ALL_EMPTY_ALARM and with_data == 0:
        raise RuntimeError(
            f"employee counts: 0 filings from {first_asked} new names "
            f"({errors} failed requests)"
        )
    return {
        "as_of": today.isoformat(),
        "universe": len(universe),
        "queued": len(queue),
        "asked": asked,
        "with_data": with_data,
        "empty": empty,
        "errors": errors,
        "revenue_backfilled": revenue_backfilled,
        "rows_attempted": rows_attempted,
        "remaining": len(queue) - asked,
    }


def coverage(db: Session, today: date | None = None) -> dict:
    """Ops view: how much of the universe has a headcount, and how fresh."""
    today = today or today_et()
    covered = db.query(func.count(func.distinct(EmployeeCount.ticker))).scalar() or 0
    checked = db.query(func.count(EmployeeCountCheck.ticker)).scalar() or 0
    empty = (
        db.query(func.count(EmployeeCountCheck.ticker))
        .filter(EmployeeCountCheck.rows == 0)
        .scalar()
        or 0
    )
    rows = db.query(func.count(EmployeeCount.id)).scalar() or 0
    newest = db.query(func.max(EmployeeCount.filing_date)).scalar()
    cutoff = today - timedelta(days=REFILE_AFTER_DAYS)
    stale = (
        db.query(EmployeeCount.ticker)
        .group_by(EmployeeCount.ticker)
        .having(func.max(EmployeeCount.filing_date) < cutoff)
        .count()
    )
    return {
        "tickers_with_headcount": covered,
        "tickers_checked": checked,
        "tickers_empty": empty,
        "rows": rows,
        "newest_filing": newest.isoformat() if newest else None,
        "tickers_overdue_for_new_filing": stale,
    }
