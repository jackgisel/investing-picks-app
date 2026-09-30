"""An open position with no score is a production incident, not a Hold.

The dashboard renders that as "unrated" and `_removal_signals` skips the name,
so the book cannot exit it. These tests pin the diagnosis and the JobRun that
makes the existing admin-mail sweep fire.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import CompositeScore, Fundamentals, JobRun, Stock
from app.services.portfolio import load_latest_scores
from app.db.session import Base
from conftest import make_position
from worker.jobs import runner
from worker.jobs.runner import (
    UNRATED_HOLDINGS_JOB,
    _unrated_alert_fields,
    alert_failed_job_runs,
    format_unrated_detail,
    record_unrated_holdings,
)
from worker.backtest.score import persist_scores
from worker.services.scoring import (
    MIN_SECTOR_POPULATION,
    UnscoredHolding,
    diagnose_unscored_holdings,
    score_universe,
)
from test_worker_pipeline_audit import (
    TODAY,
    _full_fundamentals,
    _momentum_bars,
    _pad_sector,
    _stock,
)


@pytest.fixture()
def sessions(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(runner, "SessionLocal", factory)
    yield factory
    engine.dispose()


def _score_row(ticker: str, as_of: date | None = None) -> CompositeScore:
    return CompositeScore(
        ticker=ticker,
        as_of=as_of or TODAY,
        quant_rating=4.0,
        composite=70.0,
        valuation_grade="B",
        growth_grade="B",
        profitability_grade="B",
        momentum_grade="B",
        revisions_grade="B",
        sector="Technology",
    )


def test_never_scored_universe_flags_every_holding(db, portfolio):
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)

    rows = diagnose_unscored_holdings(db)

    assert [r.ticker for r in rows] == ["WDC"]
    assert "never been scored" in rows[0].reason


def test_scored_holding_is_not_flagged(db, portfolio):
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(_score_row("WDC"))
    db.commit()

    assert diagnose_unscored_holdings(db) == []


def test_stale_score_from_an_earlier_day_still_counts_as_unrated(db, portfolio):
    """The dashboard keys on max(as_of). Yesterday's row is not today's rating."""
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(_score_row("WDC", as_of=TODAY - timedelta(days=1)))
    db.add(_score_row("AAA"))  # today's run exists; WDC is missing from it
    db.commit()

    rows = diagnose_unscored_holdings(db)

    assert [r.ticker for r in rows] == ["WDC"]
    assert rows[0].as_of == TODAY


def test_missing_stock_row_is_named(db, portfolio):
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(_score_row("AAA"))
    db.commit()

    reason = diagnose_unscored_holdings(db)[0].reason
    assert "no stock row" in reason


def test_market_cap_below_the_floor_is_named(db, portfolio):
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(
        Stock(
            ticker="WDC",
            sector="Technology",
            market_cap=100_000_000,
            is_active=True,
            is_etf=False,
        )
    )
    db.add(_score_row("AAA"))
    db.commit()

    reason = diagnose_unscored_holdings(db)[0].reason
    assert "100,000,000" in reason
    assert "universe floor" in reason


def test_missing_revisions_on_a_held_name_is_named(db, portfolio):
    """min_factor_coverage = 1.0 turns a missing revisions factor into unrated.

    A real next-year period with no same-FY pair still returns {}, and the
    coverage floor then refuses to write a CompositeScore row.
    """
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    _stock(db, "WDC")
    db.add(
        Fundamentals(
            ticker="WDC",
            as_of=TODAY,
            data=_full_fundamentals(epsRevisionPct=None, revenueRevisionPct=None),
        )
    )
    _momentum_bars(db, "WDC", 150.0)
    _pad_sector(db)
    db.commit()

    score_universe(db)
    rows = diagnose_unscored_holdings(db)

    assert [r.ticker for r in rows] == ["WDC"]
    assert "revisions" in rows[0].reason


def test_failed_z_floor_on_a_held_name_is_named(db, portfolio):
    """A Z below the floor is a filter result, not a missing factor."""
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    _stock(db, "WDC")
    db.add(
        Fundamentals(
            ticker="WDC",
            as_of=TODAY,
            data=_full_fundamentals(altmanZ=0.42),
        )
    )
    _momentum_bars(db, "WDC", 150.0)
    _pad_sector(db)
    db.commit()

    score_universe(db)
    rows = diagnose_unscored_holdings(db)

    assert [r.ticker for r in rows] == ["WDC"]
    assert rows[0].reason == "Altman Z 0.42 is below the 1.80 bankruptcy floor"
    assert db.query(CompositeScore).filter(CompositeScore.ticker == "WDC").count() == 0


def _prior_rating(ticker: str, *, as_of: date | None = None) -> CompositeScore:
    """A distinctive stored rating. A recomputed composite would not match it."""
    return CompositeScore(
        ticker=ticker,
        as_of=as_of or (TODAY - timedelta(days=1)),
        quant_rating=3.456,
        composite=61.4,
        valuation_grade="C",
        growth_grade="A",
        profitability_grade="B-",
        momentum_grade="D",
        revisions_grade="A-",
        sector="Financial Services",
    )


def _z_floor_name(db, ticker: str, z: float, **overrides) -> None:
    _stock(db, ticker)
    db.add(
        Fundamentals(
            ticker=ticker,
            as_of=TODAY,
            data=_full_fundamentals(altmanZ=z, **overrides),
        )
    )
    _momentum_bars(db, ticker, 150.0)


def test_held_name_below_z_floor_keeps_prior_composite(db, portfolio):
    """An open holding under the 1.80 floor keeps its last real rating.

    ATLC was 0.68 on 2026-09-29. The new as_of gets the previous composite,
    grades, and quant rating. Nothing is recomputed, diagnose stays quiet,
    and the ops mail does not fire.
    """
    make_position(db, portfolio, "ATLC", shares=10, avg_cost=10.0, current_price=12.0)
    _z_floor_name(db, "ATLC", 0.68)
    db.add(_prior_rating("ATLC"))
    _pad_sector(db)
    db.commit()

    score_universe(db)

    row = (
        db.query(CompositeScore)
        .filter(CompositeScore.ticker == "ATLC", CompositeScore.as_of == TODAY)
        .one()
    )
    assert row.quant_rating == pytest.approx(3.456)
    assert row.composite == pytest.approx(61.4)
    assert row.valuation_grade == "C"
    assert row.growth_grade == "A"
    assert row.profitability_grade == "B-"
    assert row.momentum_grade == "D"
    assert row.revisions_grade == "A-"
    assert row.sector == "Financial Services"
    assert db.query(CompositeScore).filter(CompositeScore.ticker == "ATLC").count() == 2
    assert diagnose_unscored_holdings(db) == []
    assert record_unrated_holdings(db) == {"unrated": 0}

    snap = load_latest_scores(db)["ATLC"]
    assert snap.quant_rating == pytest.approx(3.456)
    assert snap.valuation_grade == "C"
    assert snap.growth_grade == "A"
    assert snap.profitability_grade == "B-"
    assert snap.momentum_grade == "D"
    assert snap.revisions_grade == "A-"


def test_held_name_below_z_floor_with_no_prior_stays_unrated(db, portfolio):
    """SOFI at -0.39 with no earlier row is still a blank, not a made-up score."""
    make_position(db, portfolio, "SOFI", shares=10, avg_cost=10.0, current_price=12.0)
    _z_floor_name(db, "SOFI", -0.39)
    _pad_sector(db)
    db.commit()

    score_universe(db)

    assert db.query(CompositeScore).filter(CompositeScore.ticker == "SOFI").count() == 0
    rows = diagnose_unscored_holdings(db)
    assert [r.ticker for r in rows] == ["SOFI"]
    assert rows[0].reason == "Altman Z -0.39 is below the 1.80 bankruptcy floor"
    assert record_unrated_holdings(db)["unrated"] == 1


def test_non_held_name_below_z_floor_is_not_scored(db, portfolio):
    """SKWD at 1.29 is not held, so its old rating is not copied and it cannot be bought."""
    make_position(db, portfolio, "HELD", shares=1, avg_cost=10.0, current_price=10.0)
    _z_floor_name(db, "SKWD", 1.29)
    db.add(_prior_rating("SKWD"))
    _pad_sector(db)
    db.commit()

    score_universe(db)

    assert (
        db.query(CompositeScore)
        .filter(CompositeScore.ticker == "SKWD", CompositeScore.as_of == TODAY)
        .count()
        == 0
    )
    prior = (
        db.query(CompositeScore)
        .filter(
            CompositeScore.ticker == "SKWD",
            CompositeScore.as_of == TODAY - timedelta(days=1),
        )
        .one()
    )
    assert prior.composite == pytest.approx(61.4)
    assert (
        db.query(CompositeScore).filter(CompositeScore.as_of == TODAY).count()
        == MIN_SECTOR_POPULATION
    )


def test_missing_factors_on_a_held_name_are_not_carried_forward(db, portfolio):
    """A low Z does not keep the last rating when a factor is also missing."""
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    _z_floor_name(db, "WDC", 0.68, epsRevisionPct=None, revenueRevisionPct=None)
    db.add(_prior_rating("WDC"))
    _pad_sector(db)
    db.commit()

    score_universe(db)

    assert (
        db.query(CompositeScore)
        .filter(CompositeScore.ticker == "WDC", CompositeScore.as_of == TODAY)
        .count()
        == 0
    )
    rows = diagnose_unscored_holdings(db)
    assert [r.ticker for r in rows] == ["WDC"]
    assert "revisions" in rows[0].reason


def test_persist_scores_carries_forward_held_z_floor_only(db, portfolio):
    """The backtest writer copies the same prior rating live scoring does."""
    make_position(db, portfolio, "ATLC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(_prior_rating("ATLC"))
    db.add(_prior_rating("SKWD"))
    db.commit()

    result = persist_scores(db, [], TODAY, z_floor_rejected={"ATLC", "SKWD"})

    assert result["carried"] == 1
    kept = (
        db.query(CompositeScore)
        .filter(CompositeScore.ticker == "ATLC", CompositeScore.as_of == TODAY)
        .one()
    )
    assert kept.quant_rating == pytest.approx(3.456)
    assert kept.composite == pytest.approx(61.4)
    assert kept.valuation_grade == "C"
    assert kept.growth_grade == "A"
    assert kept.profitability_grade == "B-"
    assert kept.momentum_grade == "D"
    assert kept.revisions_grade == "A-"
    assert (
        db.query(CompositeScore)
        .filter(CompositeScore.ticker == "SKWD", CompositeScore.as_of == TODAY)
        .count()
        == 0
    )


def test_record_unrated_holdings_writes_an_error_job_run(db, portfolio):
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(_score_row("AAA"))
    db.commit()

    result = record_unrated_holdings(db)

    assert result == {"unrated": 1, "recorded": True}
    run = db.query(JobRun).one()
    assert run.job_name == UNRATED_HOLDINGS_JOB
    assert run.status == "error"
    assert run.alerted_at is None
    assert "WDC:" in run.detail
    assert "Sell rules skip" in run.detail


def test_record_unrated_holdings_does_not_duplicate_the_same_incident(db, portfolio):
    make_position(db, portfolio, "WDC", shares=10, avg_cost=10.0, current_price=12.0)
    db.add(_score_row("AAA"))
    db.commit()

    assert record_unrated_holdings(db)["recorded"] is True
    assert record_unrated_holdings(db) == {"unrated": 1, "recorded": False}
    assert db.query(JobRun).count() == 1


def test_unrated_alert_subject_names_the_ticker():
    detail = format_unrated_detail(
        [
            UnscoredHolding(
                ticker="WDC",
                reason="missing factors: revisions",
                as_of=TODAY,
            )
        ]
    )
    fields = _unrated_alert_fields(detail)
    assert fields["headline"] == "WDC has no rating"
    assert fields["eyebrow"] == "Unrated holding"


def test_alert_sweep_passes_unrated_headline(sessions, monkeypatch):
    posted: list[dict] = []

    def capture(path, label, timeout, json=None):
        posted.append(json or {})
        return {"ok": True}

    monkeypatch.setattr("worker.jobs.runner._post_to_web_app", capture)

    db = sessions()
    try:
        db.add(
            JobRun(
                job_name=UNRATED_HOLDINGS_JOB,
                status="error",
                detail=(
                    f"Unrated holdings as of {TODAY.isoformat()}.\n"
                    "Sell rules skip any name with no score.\n\n"
                    "WDC: missing factors: revisions"
                ),
                finished_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    finally:
        db.close()

    result = alert_failed_job_runs()
    assert result["alerted"] == 1
    assert posted[0]["headline"] == "WDC has no rating"
    assert posted[0]["eyebrow"] == "Unrated holding"
    assert posted[0]["job_name"] == UNRATED_HOLDINGS_JOB
