"""Company fundamentals published beside open holdings."""

from __future__ import annotations

from datetime import date

from app.db.models import Fundamentals
from app.routes.public_v1 import get_strategy
from conftest import make_position


def _facts(db, ticker: str, as_of: date, **data):
    db.add(Fundamentals(ticker=ticker, as_of=as_of, data=data))
    db.commit()


def test_holding_publishes_latest_company_fundamentals(db, portfolio):
    make_position(db, portfolio, "AAA", 10, 10.0, 12.0)
    _facts(
        db,
        "AAA",
        date(2026, 6, 1),
        revenueGrowthTTM=0.1,
        epsGrowthTTM=0.2,
    )
    _facts(
        db,
        "AAA",
        date(2026, 7, 1),
        growthBasisPeriod="2026-06-30",
        estimatePeriod="2026-12-31",
        revenueGrowthTTM=0.3456,
        epsGrowthTTM=-0.0789,
        revenueEstimateAvg=1_234_567_890,
        epsEstimateAvg=2.345,
        revenueRevisionPct=0.01234,
        epsRevisionPct=-0.04567,
        earningsReportDate="2026-07-24",
        revenueActual=1_300_000_000,
        revenueEstimated=1_250_000_000,
        epsActual=2.5,
        epsEstimated=2.0,
        priceTargetLow=90.0,
        priceTargetMean=120.0,
        priceTargetHigh=150.0,
        priceTargetAnalystCount=18,
    )

    facts = get_strategy(db)["holdings"][0]["fundamentals"]
    assert facts == {
        "as_of": "2026-07-01",
        "growth_basis_period": "2026-06-30",
        "estimate_period": "2026-12-31",
        "revenue_growth_ttm_pct": 34.56,
        "eps_growth_ttm_pct": -7.89,
        "revenue_estimate": 1_234_567_890.0,
        "eps_estimate": 2.345,
        "revenue_revision_pct": 1.23,
        "eps_revision_pct": -4.57,
        "earnings_report_date": "2026-07-24",
        "revenue_actual": 1_300_000_000.0,
        "revenue_report_estimate": 1_250_000_000.0,
        "revenue_surprise_pct": 4.0,
        "eps_actual": 2.5,
        "eps_report_estimate": 2.0,
        "eps_surprise_pct": 25.0,
        "mark": 12.0,
        "price_target_low": 90.0,
        "price_target_mean": 120.0,
        "price_target_high": 150.0,
        "price_target_analyst_count": 18.0,
    }


def test_holding_without_snapshot_publishes_null(db, portfolio):
    make_position(db, portfolio, "AAA", 10, 10.0, 12.0)
    assert get_strategy(db)["holdings"][0]["fundamentals"] is None


def test_non_finite_provider_values_publish_as_null(db, portfolio):
    make_position(db, portfolio, "AAA", 10, 10.0, 12.0)
    _facts(
        db,
        "AAA",
        date(2026, 7, 1),
        revenueGrowthTTM=float("nan"),
        epsEstimateAvg=float("inf"),
    )
    facts = get_strategy(db)["holdings"][0]["fundamentals"]
    assert facts["revenue_growth_ttm_pct"] is None
    assert facts["eps_estimate"] is None
    assert facts["eps_surprise_pct"] is None
