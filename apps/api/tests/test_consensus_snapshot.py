"""Full-universe consensus snapshots (backtest Phase 1)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.db.models import ConsensusSnapshot, Fundamentals, JobRun, Position, Stock
from app.db.session import Base
from worker.services.fmp import FMPAccessError
from worker.services.ingest import (
    SNAPSHOT_MARKET_CAP_FLOOR,
    SNAPSHOT_SHARE_PRICE_FLOOR,
    bulk_insert_consensus_snapshots,
    compute_estimate_revisions,
    missing_snapshot_weekdays,
    parse_consensus_estimate,
    snapshot_consensus,
    snapshot_universe_tickers,
)


class SnapshotFMP:
    def __init__(self, screener=None, estimates=None, fail=None):
        self.screener = screener or []
        self.estimates = estimates or {}
        self.fail = fail or set()
        self.screener_kwargs = None
        self.estimate_calls: list[str] = []

    def stock_screener(self, min_market_cap, limit):
        self.screener_kwargs = {"min_market_cap": min_market_cap, "limit": limit}
        return self.screener

    def analyst_estimates(self, ticker):
        self.estimate_calls.append(ticker)
        if ticker in self.fail:
            raise FMPAccessError("analyst-estimates 402")
        return list(self.estimates.get(ticker, []))


def _est(period, eps, revenue, **extra):
    row = {"date": period, "epsAvg": eps, "revenueAvg": revenue}
    row.update(extra)
    return row


def _store_fundamentals(db, ticker, as_of, period, eps, revenue):
    db.add(
        Fundamentals(
            ticker=ticker,
            as_of=as_of,
            data={
                "estimatePeriod": period,
                "epsEstimateAvg": eps,
                "revenueEstimateAvg": revenue,
            },
        )
    )
    db.commit()


def _store_snapshot(db, ticker, as_of, period, eps, revenue):
    db.add(
        ConsensusSnapshot(
            ticker=ticker,
            as_of=as_of,
            fiscal_period=date.fromisoformat(period),
            eps_avg=eps,
            revenue_avg=revenue,
            raw={},
        )
    )
    db.commit()


def test_parse_consensus_estimate_reads_stable_and_legacy_names():
    stable = parse_consensus_estimate(
        {
            "date": "2026-12-31",
            "epsAvg": 2.1,
            "epsHigh": 2.4,
            "epsLow": 1.8,
            "revenueAvg": 1000,
            "revenueHigh": 1100,
            "revenueLow": 900,
            "numAnalystsEps": 12,
        }
    )
    assert stable["fiscal_period"] == date(2026, 12, 31)
    assert stable["eps_avg"] == 2.1
    assert stable["eps_high"] == 2.4
    assert stable["revenue_avg"] == 1000
    assert stable["analyst_count"] == 12

    legacy = parse_consensus_estimate(
        {
            "date": "2026-12-31",
            "estimatedEpsAvg": 3.0,
            "estimatedRevenueAvg": 300,
            "numberAnalystsEstimatedEps": 8,
        }
    )
    assert legacy["eps_avg"] == 3.0
    assert legacy["revenue_avg"] == 300
    assert legacy["analyst_count"] == 8

    assert parse_consensus_estimate({"epsAvg": 1.0}) is None


def test_snapshot_universe_includes_names_just_under_the_live_floors(db, portfolio):
    """A name at $280M / $4.50 must already have a vintage the week it crosses."""
    db.add(Stock(ticker="HELD", is_active=True, is_etf=False, market_cap=1e9))
    db.add(
        Position(
            portfolio_id=portfolio.id,
            ticker="HELD",
            shares=1,
            avg_cost=10,
            current_price=10,
        )
    )
    db.commit()

    fmp = SnapshotFMP(
        screener=[
            {"symbol": "BIG", "price": 50, "marketCap": 5e9},
            {"symbol": "CROSS", "price": 4.50, "marketCap": 280_000_000},
            {"symbol": "TINY", "price": 3.00, "marketCap": 100_000_000},
            {"symbol": "BRK.B", "price": 400, "marketCap": 1e12},
        ]
    )
    tickers = snapshot_universe_tickers(db, fmp)
    assert fmp.screener_kwargs["min_market_cap"] == SNAPSHOT_MARKET_CAP_FLOOR
    assert "BIG" in tickers
    assert "CROSS" in tickers
    assert "HELD" in tickers
    assert "TINY" not in tickers
    assert "BRK.B" not in tickers
    assert SNAPSHOT_SHARE_PRICE_FLOOR < 5.0


def test_snapshot_consensus_is_append_only_and_idempotent(db):
    fmp = SnapshotFMP(
        screener=[{"symbol": "AAA", "price": 20, "marketCap": 1e9}],
        estimates={
            "AAA": [
                _est("2026-12-31", 2.0, 1000, epsHigh=2.2),
                _est("2027-12-31", 2.4, 1100),
            ]
        },
    )
    as_of = date(2026, 9, 11)
    first = snapshot_consensus(db, fmp, as_of=as_of)
    assert first["tickers_with_estimates"] == 1
    assert first["rows_attempted"] == 2
    assert db.query(ConsensusSnapshot).count() == 2

    # Same-day retry must not overwrite the observed vintage.
    fmp.estimates["AAA"] = [_est("2026-12-31", 9.99, 1)]
    second = snapshot_consensus(db, fmp, as_of=as_of)
    assert second["rows_attempted"] == 1
    row = (
        db.query(ConsensusSnapshot)
        .filter(
            ConsensusSnapshot.ticker == "AAA",
            ConsensusSnapshot.as_of == as_of,
            ConsensusSnapshot.fiscal_period == date(2026, 12, 31),
        )
        .one()
    )
    assert row.eps_avg == 2.0
    assert db.query(ConsensusSnapshot).count() == 2


def test_snapshot_consensus_raises_when_every_ticker_is_empty(db):
    fmp = SnapshotFMP(screener=[{"symbol": "AAA", "price": 20, "marketCap": 1e9}])
    with pytest.raises(RuntimeError, match="stored 0 estimates"):
        snapshot_consensus(db, fmp, as_of=date(2026, 9, 11))


def test_snapshot_consensus_raises_on_empty_universe(db):
    with pytest.raises(RuntimeError, match="universe is empty"):
        snapshot_consensus(db, SnapshotFMP(), as_of=date(2026, 9, 11))


def test_snapshot_consensus_stops_on_plan_restriction(db):
    fmp = SnapshotFMP(
        screener=[
            {"symbol": "AAA", "price": 20, "marketCap": 1e9},
            {"symbol": "BBB", "price": 20, "marketCap": 1e9},
        ],
        estimates={"AAA": [_est("2026-12-31", 2.0, 1000)]},
        fail={"BBB"},
    )
    with pytest.raises(FMPAccessError):
        snapshot_consensus(db, fmp, as_of=date(2026, 9, 11))
    # Progress for AAA is durable so a retry can resume.
    assert db.query(ConsensusSnapshot).filter(ConsensusSnapshot.ticker == "AAA").count() == 1


def test_revision_prefers_a_21_day_snapshot_over_fundamentals(db):
    today = date(2026, 9, 11)
    _store_fundamentals(db, "AAA", today - timedelta(days=21), "2026-12-31", 1.00, 1000)
    _store_snapshot(db, "AAA", today - timedelta(days=21), "2026-12-31", 2.00, 1000)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.20,
        "revenueEstimateAvg": 1100.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.10)
    assert out["revisionBasisDate"] == (today - timedelta(days=21)).isoformat()


def test_revision_keeps_21_day_fundamentals_over_a_short_snapshot(db):
    """First weeks after Phase 1: daily vintages exist but are younger than 21d."""
    today = date(2026, 9, 11)
    _store_fundamentals(db, "AAA", today - timedelta(days=21), "2026-12-31", 2.00, 1000)
    _store_snapshot(db, "AAA", today - timedelta(days=6), "2026-12-31", 2.05, 1000)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.20,
        "revenueEstimateAvg": 1100.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.10)
    assert out["revisionLookbackDays"] == 21


def test_revision_falls_back_to_fundamentals_when_no_snapshots(db):
    today = date(2026, 9, 11)
    _store_fundamentals(db, "AAA", today - timedelta(days=14), "2026-12-31", 2.00, 1000)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.20,
        "revenueEstimateAvg": 1100.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.10)
    assert out["revisionLookbackDays"] == 14


def test_missing_snapshot_weekdays_ignores_empty_table_and_weekends(db):
    today = date(2026, 9, 11)  # Friday
    assert missing_snapshot_weekdays(db, today) == []

    _store_snapshot(db, "AAA", date(2026, 9, 7), "2026-12-31", 2.0, 1000)  # Monday
    missing = missing_snapshot_weekdays(db, today)
    assert missing == [date(2026, 9, 8), date(2026, 9, 9), date(2026, 9, 10)]


def test_bulk_insert_skips_existing_vintages(db):
    as_of = date(2026, 9, 11)
    rows = [
        {
            "ticker": "AAA",
            "as_of": as_of,
            "fiscal_period": date(2026, 12, 31),
            "eps_avg": 2.0,
            "revenue_avg": 1000.0,
            "raw": {"date": "2026-12-31"},
        }
    ]
    assert bulk_insert_consensus_snapshots(db, rows) == 1
    rows[0]["eps_avg"] = 9.0
    assert bulk_insert_consensus_snapshots(db, rows) == 1
    assert db.query(ConsensusSnapshot).one().eps_avg == 2.0


def test_migrations_ensure_schema_creates_consensus_snapshots(tmp_path):
    from app.db.migrations import ensure_schema

    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    assert not inspect(engine).has_table("consensus_snapshots")
    ensure_schema(engine)
    assert inspect(engine).has_table("consensus_snapshots")
    cols = {c["name"] for c in inspect(engine).get_columns("consensus_snapshots")}
    assert {
        "ticker",
        "as_of",
        "fiscal_period",
        "eps_avg",
        "revenue_avg",
        "raw",
    } <= cols
    ensure_schema(engine)


def test_create_all_includes_consensus_snapshots(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    Base.metadata.create_all(bind=engine)
    assert inspect(engine).has_table("consensus_snapshots")
    engine.dispose()


def test_probe_backtest_endpoints_reports_access_errors():
    from worker.services.fmp import FMPClient

    class ProbeFMP(FMPClient):
        def __init__(self):
            pass

        def analyst_estimates(self, ticker):
            return [{"date": "2026-12-31"}]

        def balance_sheet_quarterly(self, ticker, limit=12):
            raise FMPAccessError("FMP balance-sheet-statement returned 402")

        def historical_market_cap(self, ticker, from_date=None, to_date=None):
            return [{"date": "2026-01-02", "marketCap": 1}]

        def delisted_companies(self, page=0, limit=100):
            return []

    probes = ProbeFMP().probe_backtest_endpoints()
    assert probes["analyst-estimates"]["ok"] is True
    assert probes["balance-sheet-statement"]["ok"] is False
    assert "402" in probes["balance-sheet-statement"]["error"]
    assert probes["historical-market-capitalization"]["ok"] is True
    assert probes["delisted-companies"]["ok"] is False
    assert probes["delisted-companies"]["error"] == "empty"


def test_audit_segment_a_counts_pairs_and_evaluation_fridays(db):
    from worker.services.backtest_audit import audit_segment_a, format_segment_a_markdown

    # Saturday 18 Jul 2026 is the first estimate; 1 Aug / 7 Aug / 21 Aug / 4 Sep
    # are the evaluation Fridays in the window through 11 Sep.
    _store_fundamentals(db, "AAA", date(2026, 7, 18), "2026-12-31", 2.00, 1000)
    _store_fundamentals(db, "AAA", date(2026, 7, 25), "2026-12-31", 2.05, 1020)
    _store_fundamentals(db, "AAA", date(2026, 8, 1), "2026-12-31", 2.10, 1040)
    audit = audit_segment_a(db, today=date(2026, 8, 7))
    assert audit["first_eps_estimate_as_of"] == "2026-07-18"
    assert audit["tickers_ever_with_estimate"] == 1
    assert audit["universe_scope"] == "top400_live"
    by_as_of = {row["as_of"]: row for row in audit["weekly_fundamentals"]}
    assert by_as_of["2026-07-18"]["tickers_with_revision_pair"] == 0
    assert by_as_of["2026-07-25"]["tickers_with_revision_pair"] == 1
    fridays = {row["friday"]: row for row in audit["evaluation_fridays"]}
    assert "2026-07-17" not in fridays  # before first vintage
    assert fridays["2026-08-07"]["tickers_with_revision_pair"] == 1
    markdown = format_segment_a_markdown(audit)
    assert "2026-07-18" in markdown
    assert "top400_live" in markdown


def test_job_consensus_snapshot_records_gaps(tmp_path, monkeypatch):
    from types import SimpleNamespace

    from worker.jobs import runner
    from worker.services.ingest import CONSENSUS_SNAPSHOT_GAP_JOB, CONSENSUS_SNAPSHOT_JOB

    engine = create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(runner, "SessionLocal", factory)

    as_of = date(2026, 9, 11)
    db = factory()
    try:
        db.add(
            ConsensusSnapshot(
                ticker="AAA",
                as_of=date(2026, 9, 7),
                fiscal_period=date(2026, 12, 31),
                eps_avg=2.0,
                revenue_avg=1000.0,
                raw={},
            )
        )
        db.commit()
    finally:
        db.close()

    class JobFMP:
        def probe_backtest_endpoints(self, ticker="AAPL"):
            return {
                "analyst-estimates": {"ok": True, "n": 1, "error": None},
                "balance-sheet-statement": {"ok": True, "n": 4, "error": None},
                "historical-market-capitalization": {"ok": True, "n": 2, "error": None},
                "delisted-companies": {"ok": True, "n": 10, "error": None},
            }

        def stock_screener(self, min_market_cap, limit):
            return [{"symbol": "AAA", "price": 20, "marketCap": 1e9}]

        def analyst_estimates(self, ticker):
            return [_est("2026-12-31", 2.1, 1010)]

        def close(self):
            pass

    monkeypatch.setattr(runner, "_fmp", lambda deadline=None: JobFMP())
    monkeypatch.setattr(runner, "today_et", lambda: as_of)
    monkeypatch.setattr(
        runner,
        "get_settings",
        lambda: SimpleNamespace(fmp_api_key="x", fmp_base_url="", fmp_rate_limit=280),
    )

    result = runner.job_consensus_snapshot()
    assert result["as_of"] == "2026-09-11"
    assert result["gap_alert"]["missing"] == 3
    assert result["gap_alert"]["recorded"] is True
    assert result["fmp_probes"]["analyst-estimates"]["ok"] is True

    check = factory()
    try:
        gaps = (
            check.query(JobRun)
            .filter(JobRun.job_name == CONSENSUS_SNAPSHOT_GAP_JOB)
            .one()
        )
        assert gaps.status == "error"
        assert "2026-09-08" in gaps.detail
        snap = (
            check.query(JobRun)
            .filter(JobRun.job_name == CONSENSUS_SNAPSHOT_JOB)
            .one()
        )
        assert snap.status == "ok"
    finally:
        check.close()
        engine.dispose()
