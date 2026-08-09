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
