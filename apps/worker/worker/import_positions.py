"""One-time import of positions from a JSON snapshot (from jdpicks/Alpaca export).

Example input:
{
  "cash": 25000,
  "positions": [
    {"ticker": "AAPL", "shares": 10, "avg_cost": 180, "current_price": 190,
     "entry_date": "2025-01-15", "initial_investment": 1800, "sector": "Technology"}
  ]
}
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_API = os.path.join(_ROOT, "apps", "api")
sys.path.insert(0, _API)

from app.config import get_settings
from app.db.models import Position
from app.db.session import Base, SessionLocal, engine
from app.services.portfolio import ensure_default_portfolio
from outpick_strategy import RUN118_PARAMS


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", help="Path to JSON snapshot")
    parser.add_argument("--reset-cash", action="store_true")
    args = parser.parse_args()

    with open(args.snapshot) as f:
        data = json.load(f)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        portfolio = ensure_default_portfolio(db, get_settings().initial_cash)
        portfolio.params_json = RUN118_PARAMS.to_dict()
        if args.reset_cash or "cash" in data:
            portfolio.cash = float(data.get("cash", portfolio.cash))

        # Clear existing positions for clean import
        db.query(Position).filter(Position.portfolio_id == portfolio.id).delete()
        for row in data.get("positions", []):
            entry = row.get("entry_date")
            entry_date = None
            if entry:
                entry_date = date.fromisoformat(entry[:10])
            db.add(
                Position(
                    portfolio_id=portfolio.id,
                    ticker=row["ticker"].upper(),
                    shares=float(row["shares"]),
                    avg_cost=float(row["avg_cost"]),
                    current_price=float(row.get("current_price") or row["avg_cost"]),
                    entry_date=entry_date,
                    initial_investment=float(row["initial_investment"])
                    if row.get("initial_investment") is not None
                    else float(row["shares"]) * float(row["avg_cost"]),
                    sector=row.get("sector"),
                )
            )
        invested = sum(
            float(r["shares"]) * float(r.get("current_price") or r["avg_cost"])
            for r in data.get("positions", [])
        )
        portfolio.peak_equity = max(portfolio.peak_equity or 0, portfolio.cash + invested)
        db.commit()
        print(
            f"Imported {len(data.get('positions', []))} positions; "
            f"cash={portfolio.cash:.2f} equity≈{portfolio.cash + invested:.2f}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
