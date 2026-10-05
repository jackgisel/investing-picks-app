"""Stored income statements for the Sankey visuals.

Ops-keyed like the rest of the web app's server-to-server reads. The web app
decides who may see what: a held name's visual is member content, a recent
reporter's is public. This router only reports `held` so it can.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import EarningsHistory, IncomeStatement, Position, Stock
from app.services import workforce
from app.db.session import get_db
from app.routes.ops import require_ops_key

router = APIRouter(
    prefix="/api/ops/income-statements",
    tags=["ops"],
    dependencies=[Depends(require_ops_key)],
)

_TICKER = re.compile(r"^[A-Z0-9.\-]{1,10}$")


def _ticker(raw: str) -> str:
    ticker = raw.strip().upper()
    if not _TICKER.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker")
    return ticker


def _held(db: Session) -> set[str]:
    return {row[0] for row in db.query(Position.ticker).distinct().all()}


def _fiscal_label(row: IncomeStatement) -> str:
    fy = (row.fiscal_year or str(row.period.year))[-2:]
    if row.period_type == "annual" or row.fiscal_period == "FY":
        return f"FY{fy}"
    return f"{row.fiscal_period or 'Q?'} FY{fy}"


def _num(data: dict, *keys: str) -> float | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, (int, float)) and value == value:
            return float(value)
    return None


def _earnings(db: Session, ticker: str) -> list[dict]:
    rows = (
        db.query(EarningsHistory)
        .filter(EarningsHistory.ticker == ticker)
        .order_by(EarningsHistory.date.desc())
        .limit(12)
        .all()
    )
    out = []
    for row in rows:
        data = row.data or {}
        out.append(
            {
                "date": row.date.isoformat(),
                "eps_actual": _num(data, "epsActual"),
                "eps_estimated": _num(data, "epsEstimated", "epsEstimate"),
                "revenue_actual": _num(data, "revenueActual"),
                "revenue_estimated": _num(data, "revenueEstimated", "revenueEstimate"),
            }
        )
    return out


def _statement(row: IncomeStatement) -> dict:
    return {
        "period_type": row.period_type,
        "period": row.period.isoformat(),
        "fiscal_year": row.fiscal_year,
        "fiscal_period": row.fiscal_period,
        "fiscal_label": _fiscal_label(row),
        "accepted_date": row.accepted_date.isoformat() if row.accepted_date else None,
        "data": row.data or {},
        "segments": row.segments,
    }


@router.get("")
def list_income_visuals(
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=60),
):
    """Every ticker with a stored latest quarter, newest filing first.

    `recent` is the social feed's candidate list: filed within `days` and not
    held. Held names are listed separately because they are never posted.
    """
    latest = (
        db.query(
            IncomeStatement.ticker,
            func.max(IncomeStatement.period).label("period"),
        )
        .filter(IncomeStatement.period_type == "quarter")
        .group_by(IncomeStatement.ticker)
        .subquery()
    )
    rows = (
        db.query(IncomeStatement, Stock)
        .join(
            latest,
            (latest.c.ticker == IncomeStatement.ticker)
            & (latest.c.period == IncomeStatement.period),
        )
        .outerjoin(Stock, Stock.ticker == IncomeStatement.ticker)
        .filter(IncomeStatement.period_type == "quarter")
        .all()
    )
    held = _held(db)
    since = date.today() - timedelta(days=days)

    def item(st: IncomeStatement, stock: Stock | None) -> dict:
        return {
            "ticker": st.ticker,
            "name": stock.name if stock else None,
            "sector": stock.sector if stock else None,
            "market_cap": stock.market_cap if stock else None,
            "period": st.period.isoformat(),
            "fiscal_label": _fiscal_label(st),
            "accepted_date": st.accepted_date.isoformat() if st.accepted_date else None,
            "revenue": (st.data or {}).get("revenue"),
            "held": st.ticker in held,
        }

    items = [item(st, stock) for st, stock in rows]
    recent = sorted(
        (
            i
            for i in items
            if not i["held"]
            and i["accepted_date"]
            and date.fromisoformat(i["accepted_date"]) >= since
        ),
        key=lambda i: -(i["market_cap"] or 0),
    )
    held_items = sorted((i for i in items if i["held"]), key=lambda i: i["ticker"])
    annual = _recent_filers(db, "annual", held, since)
    return {"recent": recent, "annual": annual, "held": held_items, "days": days}


def _recent_filers(db: Session, period_type: str, held: set[str], since: date) -> list[dict]:
    """Non-held names whose latest statement of this type was filed since `since`."""
    latest = (
        db.query(
            IncomeStatement.ticker,
            func.max(IncomeStatement.period).label("period"),
        )
        .filter(IncomeStatement.period_type == period_type)
        .group_by(IncomeStatement.ticker)
        .subquery()
    )
    rows = (
        db.query(IncomeStatement, Stock)
        .join(
            latest,
            (latest.c.ticker == IncomeStatement.ticker)
            & (latest.c.period == IncomeStatement.period),
        )
        .outerjoin(Stock, Stock.ticker == IncomeStatement.ticker)
        .filter(IncomeStatement.period_type == period_type)
        .all()
    )
    items = []
    for st, stock in rows:
        if st.ticker in held or not st.accepted_date or st.accepted_date < since:
            continue
        items.append(
            {
                "ticker": st.ticker,
                "name": stock.name if stock else None,
                "sector": stock.sector if stock else None,
                "market_cap": stock.market_cap if stock else None,
                "period": st.period.isoformat(),
                "fiscal_label": _fiscal_label(st),
                "accepted_date": st.accepted_date.isoformat(),
                "revenue": (st.data or {}).get("revenue"),
                "held": False,
            }
        )
    items.sort(key=lambda i: -(i["market_cap"] or 0))
    return items


@router.get("/x-workforce")
def x_workforce(
    tickers: str = "",
    db: Session = Depends(get_db),
):
    """Workforce rows for an explicit ticker list. The web app passes the theme list."""
    wanted = []
    for raw in tickers.split(","):
        ticker = raw.strip().upper()
        if ticker and _TICKER.match(ticker):
            wanted.append(ticker)
    if not wanted:
        return {"rows": []}
    board = workforce.leaderboard(db, limit=len(wanted), only=wanted, exclude_sectors=())
    keep = (
        "ticker",
        "name",
        "rev_per_employee",
        "leverage",
        "openings_per_1000",
        "openings_change_90d",
        "employees_yoy",
        "revenue_yoy",
    )
    return {"rows": [{key: row.get(key) for key in keep} for row in board["rows"]]}


@router.get("/{ticker}")
def get_income_statements(
    ticker: str,
    db: Session = Depends(get_db),
    period_type: Literal["quarter", "annual"] = "quarter",
):
    """Latest statements for one ticker, newest first."""
    ticker = _ticker(ticker)
    rows = (
        db.query(IncomeStatement)
        .filter(
            IncomeStatement.ticker == ticker,
            IncomeStatement.period_type == period_type,
        )
        .order_by(IncomeStatement.period.desc())
        .limit(8)
        .all()
    )
    stock = db.get(Stock, ticker)
    return {
        "ticker": ticker,
        "name": stock.name if stock else None,
        "sector": stock.sector if stock else None,
        "held": ticker in _held(db),
        "period_type": period_type,
        "statements": [_statement(r) for r in rows],
        "earnings": _earnings(db, ticker),
    }


@router.post("/{ticker}/refresh")
def refresh_income_statement(ticker: str, db: Session = Depends(get_db)):
    """Pull one ticker from FMP now, for the ops preview's "load" box.

    A handful of requests, so synchronous — the operator is waiting on the
    image, not on a job.
    """
    from worker.jobs.runner import _fmp
    from worker.services.fmp import FMPAccessError
    from worker.services.income_statements import refresh_ticker_income

    ticker = _ticker(ticker)
    fmp = _fmp()
    try:
        stored = refresh_ticker_income(db, fmp, ticker)
    except FMPAccessError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        fmp.close()
    if stored == 0:
        raise HTTPException(
            status_code=404, detail=f"FMP returned no income statements for {ticker}"
        )
    return {"ticker": ticker, "rows": stored}
