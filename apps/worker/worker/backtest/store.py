"""Open a self-contained SQLite dataset with the app schema."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import (  # noqa: F401 — register metadata
    ConsensusSnapshot,
    Delisting,
    EarningsHistory,
    Filing,
    MarketCapHistory,
    UniverseMembership,
)
from app.db.session import Base


def open_dataset(path: str | Path) -> Session:
    """Create-or-open `path` and return a session. Idempotent."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{path}", future=True)
    Base.metadata.create_all(bind=engine)
    # Production adds this at runtime; create_all will not. Export's ON CONFLICT
    # on (ticker, as_of) needs it.
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_fundamentals_ticker_as_of "
                "ON fundamentals (ticker, as_of)"
            )
        )
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def bulk_insert(db: Session, table, rows: list[dict], conflict: list[str], chunk_size: int = 500) -> int:
    """Insert rows, skipping conflicts. Returns rows attempted."""
    if not rows:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:  # pragma: no cover
        raise RuntimeError(f"unsupported dialect {dialect}")

    written = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        stmt = _insert(table).values(chunk)
        db.execute(stmt.on_conflict_do_nothing(index_elements=conflict))
        db.commit()
        written += len(chunk)
    return written
