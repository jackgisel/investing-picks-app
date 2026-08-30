"""Additive schema changes that `create_all` cannot make.

`Base.metadata.create_all` creates missing TABLES and nothing else — it will
never add a column to a table that already exists. So every column added after
a table has shipped needs a statement here, and this module is called from both
entry points that touch the database: the API's lifespan and the worker's boot.
Both, because either process can be the first one up after a deploy.

Everything here must be idempotent and safe to run on every start.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)


def _add_column(engine: Engine, table: str, column: str, ddl: str) -> None:
    """Add a column if it is missing, on Postgres or SQLite.

    Postgres has ADD COLUMN IF NOT EXISTS; SQLite does not, and the tests run
    on SQLite. Rather than branch on the dialect — which puts the untested path
    in production — this asks the database what columns exist and only issues
    the ALTER when it needs to. The try/except is the backstop for two
    processes racing each other on the same deploy.
    """
    with engine.begin() as conn:
        existing = {c["name"] for c in _columns(conn, table)}
        if column in existing:
            return
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            log.info("Added %s.%s", table, column)
        except Exception:
            # Another process won the race, or the table does not exist yet and
            # create_all is about to make it with the column already present.
            log.debug("Could not add %s.%s; assuming it exists", table, column)


def _ensure_portfolio_contributions(engine: Engine) -> None:
    """Create the DCA deposit ledger if this database predates the table.

    The worker boots with `ensure_schema` and never `create_all`, so a new table
    that only lives on the model would be missing until the API process came up.
    """
    from sqlalchemy import inspect

    with engine.begin() as conn:
        inspector = inspect(conn)
        if inspector.has_table("portfolio_contributions"):
            return
        sqlite = engine.dialect.name == "sqlite"
        pk = "INTEGER PRIMARY KEY" if sqlite else "SERIAL PRIMARY KEY"
        amount = "FLOAT" if sqlite else "DOUBLE PRECISION"
        try:
            conn.execute(
                text(
                    f"""
                    CREATE TABLE portfolio_contributions (
                        id {pk},
                        portfolio_id INTEGER NOT NULL REFERENCES portfolios (id),
                        date DATE NOT NULL,
                        amount {amount} NOT NULL,
                        UNIQUE (portfolio_id, date)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_portfolio_contributions_portfolio_id "
                    "ON portfolio_contributions (portfolio_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_portfolio_contributions_date "
                    "ON portfolio_contributions (date)"
                )
            )
            log.info("Created portfolio_contributions")
        except Exception:
            log.debug("Could not create portfolio_contributions; assuming it exists")


def _ensure_stock_news(engine: Engine) -> None:
    """Create the news-ingest table if this database predates it.

    Same reason as `_ensure_portfolio_contributions`: the worker never runs
    `create_all`, and this table is written by the worker's news job before
    the API process necessarily has a chance to create it via the model.
    """
    from sqlalchemy import inspect

    with engine.begin() as conn:
        inspector = inspect(conn)
        if inspector.has_table("stock_news"):
            return
        sqlite = engine.dialect.name == "sqlite"
        pk = "INTEGER PRIMARY KEY" if sqlite else "SERIAL PRIMARY KEY"
        timestamptz = "TIMESTAMP" if sqlite else "TIMESTAMP WITH TIME ZONE"
        try:
            conn.execute(
                text(
                    f"""
                    CREATE TABLE stock_news (
                        id {pk},
                        ticker VARCHAR(16),
                        published_at {timestamptz} NOT NULL,
                        publisher VARCHAR(128),
                        title VARCHAR(512) NOT NULL,
                        url VARCHAR(1024) NOT NULL,
                        fetched_at {timestamptz} NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (url)
                    )
                    """
                )
            )
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_stock_news_ticker ON stock_news (ticker)")
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_stock_news_published_at "
                    "ON stock_news (published_at)"
                )
            )
            log.info("Created stock_news")
        except Exception:
            log.debug("Could not create stock_news; assuming it exists")


def _columns(conn, table: str) -> list[dict]:
    from sqlalchemy import inspect

    inspector = inspect(conn)
    if not inspector.has_table(table):
        return []
    return inspector.get_columns(table)


def ensure_schema(engine: Engine) -> None:
    """Bring an existing database up to the current model definitions."""
    # Job-failure alerting. Without this column the worker's alert sweep has no
    # way to record that a failure was reported, and would mail the admins the
    # same failure every time it ran.
    _add_column(engine, "job_runs", "alerted_at", "TIMESTAMP WITH TIME ZONE")
    _add_column(engine, "portfolios", "kind", "VARCHAR(16) DEFAULT 'live'")
    _ensure_portfolio_contributions(engine)
    _ensure_stock_news(engine)
