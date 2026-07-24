"""Bug 3: the error handler must be able to record the error."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import CompositeScore, JobRun
from app.db.session import Base
from worker.jobs import runner


@pytest.fixture()
def sessions(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(runner, "SessionLocal", factory)
    yield factory
    engine.dispose()


def _poison(db):
    """Leave the session's transaction in a failed state, as a real
    IntegrityError inside a job would."""
    for _ in range(2):
        db.add(
            CompositeScore(ticker="AAA", as_of=date(2026, 7, 24), quant_rating=4.0)
        )
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        db.commit()


def test_failed_job_records_the_original_error(sessions):
    def boom(db):
        _poison(db)
        raise RuntimeError("marks blew up")

    with pytest.raises(RuntimeError, match="marks blew up"):
        runner._track("daily_marks", boom)

    check = sessions()
    try:
        runs = check.query(JobRun).all()
        assert len(runs) == 1
        assert runs[0].status == "error"
        assert "marks blew up" in runs[0].detail
        assert runs[0].finished_at is not None
    finally:
        check.close()


def test_successful_job_records_ok(sessions):
    assert runner._track("daily_marks", lambda db: {"marks": 3}) == {"marks": 3}

    check = sessions()
    try:
        run = check.query(JobRun).one()
        assert run.status == "ok"
        assert run.detail == "{'marks': 3}"
    finally:
        check.close()
