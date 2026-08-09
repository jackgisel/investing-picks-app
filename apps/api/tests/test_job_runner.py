"""Bug 3: the error handler must be able to record the error."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import CompositeScore, JobRun
from app.db.session import Base
from worker.jobs import runner
from app.services.job_runs import reap_stale_job_runs
from worker.jobs.deadline import JobDeadlineExceeded


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


def test_weekly_refresh_timeout_is_recorded_as_error(sessions, monkeypatch):
    settings = SimpleNamespace(
        initial_cash=100_000,
        weekly_refresh_timeout_minutes=0,
    )
    monkeypatch.setattr(runner, "get_settings", lambda: settings)

    with pytest.raises(JobDeadlineExceeded, match="weekly_refresh timed out"):
        runner.job_weekly_refresh()

    check = sessions()
    try:
        run = check.query(JobRun).one()
        assert run.status == "error"
        assert "timed out" in run.detail
        assert run.finished_at is not None
    finally:
        check.close()


def test_stale_run_reaper_closes_only_expired_runs(sessions):
    now = datetime(2026, 7, 31, 12, tzinfo=timezone.utc)
    db = sessions()
    try:
        db.add_all(
            [
                JobRun(
                    job_name="weekly_refresh",
                    status="running",
                    started_at=now - timedelta(minutes=61),
                ),
                JobRun(
                    job_name="weekly_refresh",
                    status="running",
                    started_at=now - timedelta(minutes=59),
                ),
                JobRun(
                    job_name="daily_marks",
                    status="running",
                    started_at=now - timedelta(days=1),
                ),
            ]
        )
        db.commit()

        assert reap_stale_job_runs(
            db,
            job_name="weekly_refresh",
            stale_after=timedelta(minutes=60),
            now=now,
        ) == 1

        weekly = (
            db.query(JobRun)
            .filter(JobRun.job_name == "weekly_refresh")
            .order_by(JobRun.started_at)
            .all()
        )
        assert weekly[0].status == "error"
        assert "Stale run reaped" in weekly[0].detail
        assert weekly[0].finished_at is not None
        assert weekly[1].status == "running"
        daily = db.query(JobRun).filter(JobRun.job_name == "daily_marks").one()
        assert daily.status == "running"
    finally:
        db.close()


def test_reaped_run_cannot_later_overwrite_error_with_ok(sessions):
    def finish_after_reaper(_db):
        reaper_db = sessions()
        try:
            assert reap_stale_job_runs(
                reaper_db,
                job_name="weekly_refresh",
                stale_after=timedelta(0),
                now=datetime.now(timezone.utc) + timedelta(seconds=1),
            ) == 1
        finally:
            reaper_db.close()
        return {"too_late": True}

    with pytest.raises(JobDeadlineExceeded, match="runtime limit"):
        runner._track("weekly_refresh", finish_after_reaper)

    check = sessions()
    try:
        run = check.query(JobRun).one()
        assert run.status == "error"
        assert "Stale run reaped" in run.detail
        assert "too_late" not in run.detail
    finally:
        check.close()
