"""Member-facing weekly $1,000 DCA sample books."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.dca import dca_holdings_payload, dca_performance_payload

router = APIRouter(prefix="/api/v1/dca", tags=["dca"])


@router.get("/performance")
def get_dca_performance(db: Session = Depends(get_db)):
    return dca_performance_payload(db)


@router.get("/holdings")
def get_dca_holdings(db: Session = Depends(get_db)):
    return dca_holdings_payload(db)
