"""Test bootstrap: make the monorepo's python packages importable.

There is no installed distribution in CI, so put `apps/api`, `apps/worker` and
`packages/strategy/src` on the path the same way the worker entrypoint does.
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", ".."))

for _path in (
    os.path.join(_ROOT, "apps", "api"),
    os.path.join(_ROOT, "apps", "worker"),
    os.path.join(_ROOT, "packages", "strategy", "src"),
):
    if _path not in sys.path:
        sys.path.insert(0, _path)

# Keep app.db.session's module-level engine off the developer's real database
# (and out of the repo as a stray outpick.db file) at import time.
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.db.models import Portfolio, Position  # noqa: E402
from app.db.session import Base  # noqa: E402


@pytest.fixture()
def db(tmp_path):
    """A real file-backed SQLite session with the full schema."""
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def portfolio(db):
    p = Portfolio(id=1, name="AP Strategy", cash=100_000.0, peak_equity=100_000.0)
    db.add(p)
    db.commit()
    return p


def make_position(db, portfolio, ticker, shares, avg_cost, current_price, **kwargs):
    pos = Position(
        portfolio_id=portfolio.id,
        ticker=ticker,
        shares=shares,
        avg_cost=avg_cost,
        current_price=current_price,
        initial_investment=kwargs.pop("initial_investment", shares * avg_cost),
        **kwargs,
    )
    db.add(pos)
    db.commit()
    return pos
