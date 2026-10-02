"""Income statements for the Sankey visuals (in-app and on X).

Two audiences, one table. `watch_reporters` runs through the trading day and
stores each company's new quarter as soon as FMP has it, so a print can be on
X within hours of the release. `refresh_income_statements` is the slower
safety net that keeps every held name current for the in-app pick visuals.
The visual itself is drawn in the web app — this module only stores what FMP
reported, untouched, so every number on an image traces back to a stored
vendor row.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import IncomeStatement, Stock
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.ingest import held_tickers

log = logging.getLogger(__name__)

#: Five quarters: the latest plus the same quarter a year earlier for Y/Y.
QUARTERS = 5
#: Two fiscal years: the latest plus the one before it.
YEARS = 2
#: How long after a print to keep looking for its statement. Most land the
#: same day; a company that waits for its 10-Q can take weeks, and by then
#: the print is not news.
WATCH_DAYS = 7
#: The same floor the web app applies before drafting for X. Held names are
#: watched whatever their size, for the in-app visual.
WATCH_MIN_MARKET_CAP = 5_000_000_000
#: Statement checks per tick, newest print first. One request each, and
#: earnings season puts hundreds of names on a week's calendar.
WATCH_LIMIT = 60
#: A filing this many days before the calendar date still belongs to that
#: print — an after-close release is often dated the next session. The
#: previous quarter's filing is two months older, so this cannot mistake it.
FILED_SLACK_DAYS = 3


def _parse_date(raw) -> date | None:
    try:
        return date.fromisoformat(str(raw)[:10]) if raw else None
    except ValueError:
        return None


def _segment_key(row: dict) -> tuple[str, str] | None:
    fy, fp = row.get("fiscalYear"), row.get("period")
    if fy is None or not fp:
        return None
    return str(fy), str(fp)


def _segments_by_period(rows: list[dict]) -> dict:
    """Index segmentation rows by (fiscal year, period) and by period end."""
    out: dict = {}
    for row in rows or []:
        data = row.get("data")
        if not isinstance(data, dict) or not data:
            continue
        clean = {
            str(k): float(v)
            for k, v in data.items()
            if isinstance(v, (int, float)) and v > 0
        }
        if not clean:
            continue
        key = _segment_key(row)
        if key:
            out[key] = clean
        end = _parse_date(row.get("date"))
        if end:
            out[end] = clean
    return out


def _upsert(db: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    else:
        from sqlalchemy.dialects.sqlite import insert as _insert
    stmt = _insert(IncomeStatement.__table__).values(rows)
    db.execute(
        stmt.on_conflict_do_update(
            index_elements=["ticker", "period_type", "period"],
            set_={
                "fiscal_year": stmt.excluded.fiscal_year,
                "fiscal_period": stmt.excluded.fiscal_period,
                "accepted_date": stmt.excluded.accepted_date,
                "data": stmt.excluded.data,
                "segments": stmt.excluded.segments,
                "fetched_at": stmt.excluded.fetched_at,
            },
        )
    )
    return len(rows)


def _rows_for(
    ticker: str, period_type: str, statements: list[dict], segments: dict
) -> list[dict]:
    now = datetime.now(timezone.utc)
    rows: dict[date, dict] = {}
    for st in statements or []:
        period = _parse_date(st.get("date"))
        if period is None or not st.get("revenue"):
            continue
        fy = str(st["fiscalYear"]) if st.get("fiscalYear") is not None else None
        fp = str(st["period"]) if st.get("period") else None
        seg = segments.get((fy, fp)) if fy and fp else None
        rows[period] = {
            "ticker": ticker,
            "period_type": period_type,
            "period": period,
            "fiscal_year": fy,
            "fiscal_period": fp,
            "accepted_date": _parse_date(st.get("acceptedDate") or st.get("filingDate")),
            "data": dict(st),
            "segments": seg if seg is not None else segments.get(period),
            "fetched_at": now,
        }
    return list(rows.values())


class _Breakers:
    """Plan-restriction breakers shared across one run.

    A 402 on quarterly segmentation is the expected state on our plan, so it
    is tripped once and never retried for the rest of the run — not logged as
    an error per ticker.
    """

    def __init__(self) -> None:
        self.quarter_segments = True
        self.annual_segments = True


def refresh_ticker_income(
    db: Session,
    fmp: FMPClient,
    ticker: str,
    breakers: _Breakers | None = None,
    quarterly: list[dict] | None = None,
) -> int:
    """Fetch and store one ticker's recent quarters and fiscal years."""
    breakers = breakers or _Breakers()
    ticker = ticker.upper()

    if quarterly is None:
        quarterly = fmp.income_statement_quarterly(ticker, limit=QUARTERS)
    annual = fmp.income_statement_annual(ticker, limit=YEARS)

    q_segments: dict = {}
    if breakers.quarter_segments:
        try:
            q_segments = _segments_by_period(
                fmp.revenue_product_segmentation(ticker, period="quarter")
            )
        except FMPAccessError:
            log.info("Quarterly segmentation is not on this FMP plan; skipping")
            breakers.quarter_segments = False

    a_segments: dict = {}
    if breakers.annual_segments:
        try:
            a_segments = _segments_by_period(
                fmp.revenue_product_segmentation(ticker, period="annual")
            )
        except FMPAccessError:
            log.warning("Annual segmentation is not on this FMP plan; skipping")
            breakers.annual_segments = False

    n = _upsert(db, _rows_for(ticker, "quarter", quarterly, q_segments))
    n += _upsert(db, _rows_for(ticker, "annual", annual, a_segments))
    db.commit()
    return n


def _filed(st: dict) -> date | None:
    return _parse_date(st.get("acceptedDate") or st.get("filingDate"))


def _covers(filed: date | None, reported: date) -> bool:
    return filed is not None and filed >= reported - timedelta(days=FILED_SLACK_DAYS)


def reported_since(fmp: FMPClient, start: date, today: date) -> dict[str, date]:
    """Ticker -> report date for every company that has reported in the range.

    A calendar row with null actuals is a scheduled print that has not
    happened yet, so it is not a reason to go looking for a statement.
    """
    out: dict[str, date] = {}
    for row in fmp.earnings_calendar(start, today):
        ticker = str(row.get("symbol") or "").upper()
        day = _parse_date(row.get("date"))
        if not ticker or day is None or day > today:
            continue
        if row.get("epsActual") is None and row.get("revenueActual") is None:
            continue
        out[ticker] = max(day, out.get(ticker, day))
    return out


def watch_reporters(db: Session, fmp: FMPClient, today: date | None = None) -> dict:
    """Store the new quarter of every company that just reported, once FMP has it.

    One calendar request, then one statement request per name still waiting
    on its filing. A name drops out of the loop the moment its statement is
    stored — the stored accepted date is the "already have it" check — and
    after `WATCH_DAYS` if the statement never arrives.
    """
    today = today or date.today()
    reported = reported_since(fmp, today - timedelta(days=WATCH_DAYS), today)
    result: dict = {
        "reported": len(reported),
        "fresh": [],
        "fresh_held": [],
        "waiting": 0,
        "failed": [],
    }
    if not reported:
        return result

    held = held_tickers(db)
    stocks = (
        db.query(Stock.ticker, Stock.market_cap, Stock.name)
        .filter(
            Stock.ticker.in_(list(reported)),
            Stock.is_active == True,  # noqa: E712
            Stock.is_etf == False,  # noqa: E712
        )
        .all()
    )
    caps = {ticker: cap or 0 for ticker, cap, _ in stocks}
    def rank(ticker: str) -> tuple:
        return (ticker in held, "-" not in ticker, caps[ticker])

    # One ticker per company: share classes (MKC / MKC-V, GOOGL / GOOG) file
    # one statement, and two drafts of it would be the same post twice.
    by_company: dict[str, str] = {}
    for ticker, _, name in stocks:
        if not (ticker in held or caps[ticker] >= WATCH_MIN_MARKET_CAP):
            continue
        key = (name or ticker).strip().lower()
        if key not in by_company or rank(ticker) > rank(by_company[key]):
            by_company[key] = ticker
    watched = list(by_company.values())
    if not watched:
        return result
    stored = dict(
        db.query(IncomeStatement.ticker, func.max(IncomeStatement.accepted_date))
        .filter(
            IncomeStatement.period_type == "quarter",
            IncomeStatement.ticker.in_(watched),
        )
        .group_by(IncomeStatement.ticker)
        .all()
    )
    pending = sorted(
        (t for t in watched if not _covers(stored.get(t), reported[t])),
        key=lambda t: (-reported[t].toordinal(), -caps[t]),
    )
    result["waiting"] = max(len(pending) - WATCH_LIMIT, 0)

    breakers = _Breakers()
    for ticker in pending[:WATCH_LIMIT]:
        try:
            quarterly = fmp.income_statement_quarterly(ticker, limit=QUARTERS)
            newest = max((d for d in map(_filed, quarterly) if d), default=None)
            if not _covers(newest, reported[ticker]):
                result["waiting"] += 1
                continue
            refresh_ticker_income(db, fmp, ticker, breakers, quarterly=quarterly)
            result["fresh_held" if ticker in held else "fresh"].append(ticker)
        except FMPAccessError:
            raise
        except Exception:
            db.rollback()
            log.exception("Income statement watch failed for %s", ticker)
            result["failed"].append(ticker)
    return result


def refresh_income_statements(
    db: Session,
    fmp: FMPClient,
    extra: list[str] | None = None,
) -> dict:
    """Every held name, plus any explicitly requested.

    The pick visuals cannot depend on the calendar alone: a held name whose
    print the calendar missed, or a restated quarter, would otherwise stay
    stale in the app indefinitely.
    """
    held = held_tickers(db)
    tickers = sorted(held | {t.upper() for t in (extra or [])})

    breakers = _Breakers()
    stored = 0
    failed: list[str] = []
    for ticker in tickers:
        try:
            stored += refresh_ticker_income(db, fmp, ticker, breakers)
        except FMPAccessError:
            # Income statements themselves being off-plan is not per-ticker;
            # every remaining call would fail the same way.
            raise
        except Exception:
            db.rollback()
            log.exception("Income statement refresh failed for %s", ticker)
            failed.append(ticker)

    return {
        "tickers": len(tickers),
        "held": len(held),
        "rows": stored,
        "failed": failed,
        "quarter_segments": breakers.quarter_segments,
    }
