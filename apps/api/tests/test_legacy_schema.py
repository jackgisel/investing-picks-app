"""Startup must survive a database that predates newer columns.

`Base.metadata.create_all` only creates missing TABLES — it never alters an
existing one. A database created before a column was added therefore keeps the
old shape, while the ORM SELECTs every mapped column. The mismatch takes the
whole app down at startup, before a single request is served.

This is not hypothetical: the first production deploy crashed on boot with
`column portfolios.inception_date does not exist`, because the column was only
added lazily on the first ops request while startup queries Portfolio.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.services.portfolio import ensure_default_portfolio, ensure_schema
import app.services.portfolio as portfolio_service


@pytest.fixture()
def legacy_db(tmp_path):
    """A portfolios table as it existed before `inception_date`."""
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE portfolios (
                    id INTEGER NOT NULL PRIMARY KEY,
                    name VARCHAR(120),
                    cash FLOAT,
                    peak_equity FLOAT,
                    is_drawdown_halted BOOLEAN,
                    params_json JSON,
                    created_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO portfolios (id, name, cash, peak_equity, "
                "is_drawdown_halted, params_json) "
                "VALUES (1, 'AP Strategy', 100000.0, 100000.0, 0, '{}')"
            )
        )
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    # ensure_schema memoises success across tests; force a fresh run.
    portfolio_service._SCHEMA_READY = False
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        portfolio_service._SCHEMA_READY = False


def test_ensure_schema_adds_inception_date(legacy_db):
    engine = legacy_db.get_bind()
    assert "inception_date" not in {
        c["name"] for c in inspect(engine).get_columns("portfolios")
    }

    ensure_schema(legacy_db)

    assert "inception_date" in {
        c["name"] for c in inspect(engine).get_columns("portfolios")
    }


def test_startup_path_survives_a_legacy_database(legacy_db):
    """The exact production failure: loading the portfolio at boot."""
    portfolio = ensure_default_portfolio(legacy_db, 100_000.0)
    assert portfolio.id == 1
    assert portfolio.inception_date is None
    assert portfolio.cash == 100_000.0


def test_ensure_schema_is_idempotent(legacy_db):
    ensure_schema(legacy_db)
    portfolio_service._SCHEMA_READY = False
    ensure_schema(legacy_db)  # must not raise on the second pass

    portfolio = ensure_default_portfolio(legacy_db, 100_000.0)
    assert portfolio.id == 1
