"""Phase 3: PIT derivation, universe hook, Z-score, Segment A parity."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from outpick_strategy import RUN118_PARAMS

from app.db.models import (
    CompositeScore,
    ConsensusSnapshot,
    Filing,
    Fundamentals,
    MarketCapHistory,
    PriceBar,
    Stock,
    UniverseMembership,
)
from worker.backtest.ingest import ingest_dataset
from worker.backtest.parity import parity_report
from worker.backtest.score import persist_scores, score_dataset
from worker.backtest.store import open_dataset
from worker.services.backtest_derive import derive_ticker
from worker.services.fmp import FMPAccessError
from worker.services.scoring import (
    MIN_SECTOR_POPULATION,
    ScoredTicker,
    _load_scoring_universe,
    compute_scores,
)

from test_backtest_ingest import DatasetFMP
from test_worker_pipeline_audit import _full_fundamentals, _pad_sector


AS_OF = date(2026, 8, 7)


def _stock(db, ticker, sector="Technology", cap=5e9):
    db.add(
        Stock(
            ticker=ticker,
            sector=sector,
            market_cap=cap,
            is_active=True,
            is_etf=False,
        )
    )


def _bar(db, ticker, day, close):
    db.add(PriceBar(ticker=ticker, date=day, close=close))


def _mcap(db, ticker, day, cap):
    db.add(MarketCapHistory(ticker=ticker, date=day, market_cap=cap))


def _income_quarter(db, ticker, period, available, revenue, net_income, shares=1000, **extra):
    data = {
        "date": period.isoformat(),
        "revenue": revenue,
        "netIncome": net_income,
        "grossProfit": revenue * 0.4,
        "operatingIncome": net_income * 1.2,
        "ebit": net_income * 1.2,
        "ebitda": net_income * 1.5,
        "weightedAverageShsOutDil": shares,
        **extra,
    }
    db.add(
        Filing(
            ticker=ticker,
            statement_type="income",
            period=period,
            available_from=available,
            data=data,
        )
    )


def _balance(db, ticker, period, available, **fields):
    data = {"date": period.isoformat(), **fields}
    db.add(
        Filing(
            ticker=ticker,
            statement_type="balance",
            period=period,
            available_from=available,
            data=data,
        )
    )


def _eight_quarters(db, ticker, as_of=AS_OF, revenue=100.0):
    """Eight income quarters visible on `as_of`."""
    period = date(2024, 9, 30)
    for i in range(8):
        _income_quarter(
            db,
            ticker,
            period,
            period + timedelta(days=30) if period + timedelta(days=30) <= as_of else as_of,
            revenue=revenue * (1.05**i),
            net_income=10.0 * (1.05**i),
        )
        month = period.month + 3
        year = period.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        period = date(year, month, 28 if month == 2 else 30)
    _balance(
        db,
        ticker,
        date(2026, 6, 30),
        date(2026, 8, 1),
        totalAssets=500.0,
        totalCurrentAssets=200.0,
        totalCurrentLiabilities=80.0,
        totalLiabilities=200.0,
        retainedEarnings=150.0,
        totalStockholdersEquity=300.0,
        cashAndCashEquivalents=50.0,
        totalDebt=100.0,
    )
    _bar(db, ticker, as_of, 20.0)
    _mcap(db, ticker, as_of, 2_000_000_000)


def test_later_filing_does_not_move_derived_growth(db):
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    db.commit()
    before = derive_ticker(db, "AAA", AS_OF)
    assert "revenueGrowthTTM" in before
    _income_quarter(
        db,
        "AAA",
        date(2026, 9, 30),
        date(2026, 8, 8),
        revenue=10_000.0,
        net_income=5_000.0,
    )
    db.commit()
    after = derive_ticker(db, "AAA", AS_OF)
    assert after["revenueGrowthTTM"] == before["revenueGrowthTTM"]
    assert after["epsGrowthTTM"] == before["epsGrowthTTM"]
    assert after["source"] == "pit"


def test_later_snapshot_does_not_move_revisions(db):
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=date(2026, 7, 10),
            fiscal_period=date(2026, 12, 31),
            eps_avg=1.0,
            revenue_avg=100.0,
            raw={},
        )
    )
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=AS_OF,
            fiscal_period=date(2026, 12, 31),
            eps_avg=1.10,
            revenue_avg=110.0,
            raw={},
        )
    )
    db.commit()
    before = derive_ticker(db, "AAA", AS_OF)
    assert before.get("epsRevisionPct") is not None
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=date(2026, 8, 10),
            fiscal_period=date(2026, 12, 31),
            eps_avg=9.0,
            revenue_avg=900.0,
            raw={},
        )
    )
    db.commit()
    after = derive_ticker(db, "AAA", AS_OF)
    assert after["epsRevisionPct"] == before["epsRevisionPct"]
    assert after["revenueRevisionPct"] == before["revenueRevisionPct"]


def test_later_close_does_not_move_valuation(db):
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    db.commit()
    before = derive_ticker(db, "AAA", AS_OF)
    pe = before["priceToEarningsRatioTTM"]
    _bar(db, "AAA", date(2026, 8, 10), 80.0)
    _mcap(db, "AAA", date(2026, 8, 10), 8_000_000_000)
    db.commit()
    after = derive_ticker(db, "AAA", AS_OF)
    assert after["priceToEarningsRatioTTM"] == pe
    assert after["priceToSalesRatioTTM"] == before["priceToSalesRatioTTM"]


def test_universe_hook_ignores_todays_market_cap_floor(db):
    _stock(db, "TINY", cap=1)
    db.add(Fundamentals(ticker="TINY", as_of=AS_OF, data=_full_fundamentals()))
    db.commit()
    _funds, by_sector = _load_scoring_universe(db, RUN118_PARAMS, AS_OF)
    assert "TINY" not in by_sector.get("Technology", [])
    _funds2, by_sector2 = _load_scoring_universe(
        db, RUN118_PARAMS, AS_OF, universe=["TINY"]
    )
    assert "TINY" in by_sector2.get("Technology", [])


def test_z_score_below_floor_is_not_scored(db):
    _pad_sector(db, "Utilities", n=MIN_SECTOR_POPULATION)
    db.flush()
    distressed = db.query(Stock).filter(Stock.sector == "Utilities").first()
    row = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == distressed.ticker)
        .one()
    )
    data = dict(row.data)
    data["altmanZ"] = 0.5  # below Run 118 floor 1.8
    row.data = data
    db.commit()
    scored, missing, considered = compute_scores(db, RUN118_PARAMS, date.today())
    assert considered == MIN_SECTOR_POPULATION
    assert distressed.ticker not in {s.ticker for s in scored}
    assert missing.get("z_score") == 1


def test_parity_exact_match_on_shared_friday(db, tmp_path):
    derived = db
    live = open_dataset(tmp_path / "live.sqlite")
    friday = date(2026, 8, 7)
    for session in (derived, live):
        session.add(
            UniverseMembership(
                as_of=friday,
                ticker="AAA",
                universe_scope="top400_live",
                market_cap=2e9,
                close=20.0,
            )
        )
        session.add(
            CompositeScore(
                ticker="AAA",
                as_of=friday,
                quant_rating=4.2,
                composite=80.0,
                valuation_grade="B",
                growth_grade="A",
                profitability_grade="B",
                momentum_grade="B",
                revisions_grade="A",
                sector="Technology",
            )
        )
        session.commit()
    report = parity_report(derived, live, date(2026, 8, 1), date(2026, 8, 21))
    assert report["overlap"] == 1
    assert report["exact_qr"] == 1
    assert report["exact_qr_pct"] == 1.0
    assert report["mean_abs_qr_diff"] == 0.0
    assert report["revisions_grade_exact"] == 1
    assert report["revisions_grade_exact_pct"] == 1.0
    assert report["fridays"][0]["revisions_grade_exact_pct"] == 1.0
    live.close()


def test_delisted_endpoint_402_does_not_abort_ingest(tmp_path):
    class NoDelist(DatasetFMP):
        def delisted_companies(self, page=0, limit=100):
            raise FMPAccessError("FMP delisted-companies returned 402")

    db = open_dataset(tmp_path / "dataset.sqlite")
    result = ingest_dataset(
        db, NoDelist(), start=date(2026, 8, 1), end=date(2026, 9, 11), resume=False
    )
    assert result["delistings"] == 0
    assert result["stopped_on_access_error"] is False
    db.close()


def test_score_dataset_writes_composite_rows(db):
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    db.add(
        UniverseMembership(
            as_of=AS_OF,
            ticker="AAA",
            universe_scope="top400_live",
            market_cap=2e9,
            close=20.0,
        )
    )
    db.commit()
    # One name is below MIN_SECTOR_POPULATION, so considered=1 and written=0.
    result = score_dataset(db, AS_OF, AS_OF)
    assert result["n_fridays"] == 1
    assert result["fridays"][0]["considered"] == 1
    assert result["fridays"][0]["written"] == 0


def test_persist_scores_replaces_same_day_row(db):
    scored = [
        ScoredTicker(
            ticker="AAA",
            sector="Technology",
            composite=80.0,
            quant_rating=4.2,
            grades={
                "valuation": "B",
                "growth": "A",
                "profitability": "B",
                "momentum": "B",
                "revisions": "A",
            },
            factor_pcts={"revisions": 60.0},
            momentum_12m=0.1,
        )
    ]
    persist_scores(db, scored, AS_OF)
    persist_scores(db, scored, AS_OF)
    assert db.query(CompositeScore).filter(CompositeScore.as_of == AS_OF).count() == 1


def _live_vintage(db, ticker, as_of, eps, revenue=1000.0, period="2026-12-31"):
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


def test_single_saturday_vintage_does_not_self_pair(db):
    """Weekly Saturday vintage, Friday d, one vintage before d → revisions absent."""
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    _live_vintage(db, "AAA", date(2026, 8, 1), 2.0)
    db.commit()
    out = derive_ticker(db, "AAA", AS_OF)
    assert out["deriveVersion"] == 2
    assert out["estimateVintageAsOf"] == "2026-08-01"
    assert out.get("epsEstimateAvg") == 2.0
    assert "epsRevisionPct" not in out
    assert "revenueRevisionPct" not in out


def test_two_saturday_vintages_pair_week_over_week(db):
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    _live_vintage(db, "AAA", date(2026, 7, 25), 1.90)
    _live_vintage(db, "AAA", date(2026, 8, 1), 2.09)
    db.commit()
    out = derive_ticker(db, "AAA", AS_OF)
    assert out["estimateVintageAsOf"] == "2026-08-01"
    assert out["revisionBasisDate"] == "2026-07-25"
    assert out["revisionBasisDate"] != out["estimateVintageAsOf"]
    assert out["revisionLookbackDays"] == 7
    assert out["epsRevisionPct"] == pytest.approx(0.10)


def test_prior_pit_row_is_ignored_as_vintage(db):
    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    db.add(
        Fundamentals(
            ticker="AAA",
            as_of=date(2026, 7, 17),
            data={
                "source": "pit",
                "deriveVersion": 1,
                "estimatePeriod": "2026-12-31",
                "epsEstimateAvg": 1.0,
                "revenueEstimateAvg": 500.0,
                "estimateVintageAsOf": "2026-07-17",
            },
        )
    )
    _live_vintage(db, "AAA", date(2026, 8, 1), 2.0)
    db.commit()
    out = derive_ticker(db, "AAA", AS_OF)
    assert "epsRevisionPct" not in out
    assert out["estimateVintageAsOf"] == "2026-08-01"


def test_rederive_same_friday_is_idempotent(db):
    from worker.services.backtest_derive import upsert_derived_fundamentals

    _stock(db, "AAA")
    _eight_quarters(db, "AAA")
    _live_vintage(db, "AAA", date(2026, 7, 25), 1.90)
    _live_vintage(db, "AAA", date(2026, 8, 1), 2.09)
    db.commit()
    first = derive_ticker(db, "AAA", AS_OF)
    upsert_derived_fundamentals(db, "AAA", AS_OF, first)
    db.commit()
    second = derive_ticker(db, "AAA", AS_OF)
    assert second["epsRevisionPct"] == first["epsRevisionPct"]
    assert second["revisionLookbackDays"] == first["revisionLookbackDays"]
    assert second["revisionBasisDate"] == first["revisionBasisDate"]
    assert second["estimateVintageAsOf"] == first["estimateVintageAsOf"]
    assert second["revisionBasisDate"] != second["estimateVintageAsOf"]
    assert second["deriveVersion"] == 2


def test_compute_estimate_revisions_vintage_equals_as_of_matches_live(db):
    from worker.services.ingest import compute_estimate_revisions

    today = date(2026, 7, 24)
    _live_vintage(db, "AAA", today - timedelta(days=7), 2.00)
    db.commit()
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.10,
        "revenueEstimateAvg": 1000.0,
    }
    live = compute_estimate_revisions(db, "AAA", current, today)
    locked = compute_estimate_revisions(
        db, "AAA", current, today, vintage_as_of=today
    )
    assert live == locked
    assert live["revisionLookbackDays"] == 7


def test_degeneracy_guard_raises_on_constant_grade():
    from worker.backtest.score import (
        DegenerateRevisionsError,
        assert_revisions_not_degenerate,
    )

    with pytest.raises(DegenerateRevisionsError, match="degenerate revisions"):
        assert_revisions_not_degenerate(["B-"] * 245, as_of=date(2026, 8, 7))
    mode, share = assert_revisions_not_degenerate(
        ["B-"] * 10, as_of=date(2026, 8, 7), allow=True
    )
    assert mode == "B-"
    assert share == 1.0
    assert_revisions_not_degenerate([], as_of=date(2026, 8, 7))


def test_degeneracy_guard_passes_sep4_shaped_distribution():
    from worker.backtest.score import assert_revisions_not_degenerate

    grades = (
        ["C"] * 40
        + ["B-"] * 34
        + ["C+"] * 32
        + ["A-"] * 29
        + ["A"] * 27
        + ["C-"] * 26
        + ["B"] * 24
        + ["B+"] * 11
        + ["A+"] * 10
        + ["D+"] * 8
        + ["D"] * 6
        + ["F"] * 3
        + ["D-"] * 2
    )
    mode, share = assert_revisions_not_degenerate(grades, as_of=date(2026, 9, 4))
    assert share < 0.90
    assert mode == "C"

