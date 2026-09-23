"""Scoring research switches and the live parity fixes that feed them."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from outpick_strategy import RUN118_PARAMS

from app.db.models import (
    ConsensusSnapshot,
    EarningsHistory,
    Fundamentals,
    PriceBar,
    Stock,
)
from app.services.portfolio import load_return_series, next_earnings_dates
from worker.services.ingest import (
    _forward_estimate,
    compute_fy2_revisions,
    upsert_earnings_history,
)
from worker.services.scoring import (
    MIN_SECTOR_POPULATION,
    _momentum_12m,
    compute_scores,
    latest_reported_surprises,
)

TODAY = date.today()


def _funds(**overrides) -> dict:
    data = {
        "priceToEarningsRatioTTM": 20.0,
        "priceToEarningsGrowthRatioTTM": 2.0,
        "evToEBITDATTM": 15.0,
        "priceToBookRatioTTM": 4.0,
        "priceToSalesRatioTTM": 5.0,
        "revenueGrowthTTM": 0.10,
        "epsGrowthTTM": 0.10,
        "netIncomeGrowthTTM": 0.10,
        "grossProfitMarginTTM": 0.40,
        "operatingProfitMarginTTM": 0.20,
        "netProfitMarginTTM": 0.15,
        "returnOnEquityTTM": 0.20,
        "returnOnAssetsTTM": 0.10,
        "returnOnCapitalEmployedTTM": 0.18,
        "epsRevisionPct": 0.05,
        "revenueRevisionPct": 0.05,
        "epsEstimatePrior": 2.0,
        "epsEstimateAvg": 2.1,
        "revisionLookbackDays": 21,
    }
    data.update(overrides)
    return {k: v for k, v in data.items() if v is not None}


def _name(db, ticker, close=100.0, **overrides):
    db.add(Stock(ticker=ticker, sector="Technology", market_cap=5e9, is_active=True, is_etf=False))
    db.add(Fundamentals(ticker=ticker, as_of=TODAY, data=_funds(**overrides)))
    db.add(PriceBar(ticker=ticker, date=TODAY, close=close))
    db.add(PriceBar(ticker=ticker, date=TODAY - timedelta(days=365), close=80.0))


def _sector(db, n=MIN_SECTOR_POPULATION):
    for i in range(n):
        _name(db, f"PAD{i:02d}")


def _scored(db, params=RUN118_PARAMS):
    db.commit()
    scored, missing, _ = compute_scores(db, params, TODAY)
    return {s.ticker: s for s in scored}, missing


# ── valuation ───────────────────────────────────────────────────────────────


def test_penalize_losses_ranks_missing_pe_worst_for_a_loss_maker(db):
    _sector(db)
    _name(
        db,
        "LOSS",
        priceToEarningsRatioTTM=None,
        priceToEarningsGrowthRatioTTM=None,
        netProfitMarginTTM=-0.10,
    )
    params = RUN118_PARAMS.with_overrides(valuation_penalize_losses=True)
    by, _ = _scored(db, params)
    # P/E and PEG at the 0th percentile, the three tied multiples at 50.
    assert by["LOSS"].factor_pcts["valuation"] == pytest.approx(30.0)


# ── growth ──────────────────────────────────────────────────────────────────


def test_growth_drop_net_income_stops_counting_earnings_twice(db):
    _sector(db)
    _name(db, "NI", netIncomeGrowthTTM=5.0)
    by, _ = _scored(db)
    assert by["NI"].factor_pcts["growth"] > 50.0
    by, _ = _scored(db, RUN118_PARAMS.with_overrides(growth_drop_net_income=True))
    assert by["NI"].factor_pcts["growth"] == pytest.approx(50.0)


# ── momentum ────────────────────────────────────────────────────────────────


def test_momentum_skip_days_measures_12_1():
    as_of = date(2026, 9, 18)
    history = {
        "X": [
            (as_of, 200.0),
            (as_of - timedelta(days=21), 150.0),
            (as_of - timedelta(days=365), 120.0),
            (as_of - timedelta(days=386), 100.0),
        ]
    }
    assert _momentum_12m(history, "X", as_of) == pytest.approx(200 / 120 - 1)
    assert _momentum_12m(history, "X", as_of, skip_days=21) == pytest.approx(150 / 100 - 1)


def test_momentum_blend_requires_both_windows(db):
    _sector(db)
    by, _ = _scored(db, RUN118_PARAMS.with_overrides(momentum_blend_6m=True))
    # Pads carry no six-month bar, so a blend cannot be measured.
    assert by == {}


# ── revisions ───────────────────────────────────────────────────────────────


def test_price_scaled_revisions_stop_rewarding_a_tiny_base(db):
    _sector(db)
    # +100% on a two-cent estimate versus +10% on a five-dollar one.
    _name(db, "TINY", epsRevisionPct=1.0, epsEstimatePrior=0.02, epsEstimateAvg=0.04)
    _name(db, "REAL", epsRevisionPct=0.10, epsEstimatePrior=5.0, epsEstimateAvg=5.5)
    by, _ = _scored(db)
    assert by["TINY"].factor_pcts["revisions"] > by["REAL"].factor_pcts["revisions"]
    by, _ = _scored(db, RUN118_PARAMS.with_overrides(revisions_eps_scaling="price"))
    assert by["REAL"].factor_pcts["revisions"] > by["TINY"].factor_pcts["revisions"]


def test_unknown_revisions_scaling_raises(db):
    _sector(db)
    with pytest.raises(ValueError):
        _scored(db, RUN118_PARAMS.with_overrides(revisions_eps_scaling="pc"))


def test_short_revision_pairs_are_missing_under_a_lookback_floor(db):
    _sector(db)
    _name(db, "SHORT", revisionLookbackDays=5)
    by, missing = _scored(db, RUN118_PARAMS.with_overrides(revision_min_lookback_days=14))
    assert "SHORT" not in by
    assert missing.get("revisions") == 1


def test_forward_estimate_fy2_has_no_fallback():
    as_of = date(2026, 9, 18)
    rows = [
        {"date": "2026-12-31", "epsAvg": 2.0, "revenueAvg": 10.0},
        {"date": "2027-12-31", "epsAvg": 2.5, "revenueAvg": 12.0},
    ]
    assert _forward_estimate(rows, as_of, nth=1)["estimatePeriod"] == "2027-12-31"
    assert _forward_estimate(rows[:1], as_of, nth=1) is None


def test_fy2_revisions_pair_on_the_fy2_period(db):
    as_of = date(2026, 9, 18)
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=as_of - timedelta(days=21),
            fiscal_period=date(2027, 12, 31),
            eps_avg=2.0,
            revenue_avg=100.0,
        )
    )
    db.commit()
    fy2 = {"estimatePeriod": "2027-12-31", "epsEstimateAvg": 2.2, "revenueEstimateAvg": 110.0}
    out = compute_fy2_revisions(db, "AAA", fy2, as_of)
    assert out["epsRevisionPctFy2"] == pytest.approx(0.10)
    assert out["revenueRevisionPctFy2"] == pytest.approx(0.10)
    assert out["epsEstimatePriorFy2"] == 2.0
    assert "epsRevisionPct" not in out


# ── earnings ────────────────────────────────────────────────────────────────


def test_surprise_factor_ranks_the_bigger_beat_higher(db):
    _sector(db)
    for i in range(MIN_SECTOR_POPULATION):
        db.add(
            EarningsHistory(
                ticker=f"PAD{i:02d}",
                date=TODAY - timedelta(days=30),
                data={"epsActual": 1.0, "epsEstimated": 1.0},
            )
        )
    _name(db, "BEAT")
    db.add(
        EarningsHistory(
            ticker="BEAT",
            date=TODAY - timedelta(days=30),
            data={"epsActual": 1.5, "epsEstimated": 1.0},
        )
    )
    _name(db, "NONE")
    by, missing = _scored(db, RUN118_PARAMS.with_overrides(weight_surprise=0.10))
    assert by["BEAT"].factor_pcts["surprise"] == pytest.approx(100.0)
    # Weighted factor, no report, full coverage floor: not scoreable.
    assert "NONE" not in by
    assert missing.get("surprise") == 1


def test_surprises_never_read_a_report_dated_on_or_after_as_of(db):
    db.add(EarningsHistory(ticker="A", date=TODAY, data={"epsActual": 2, "epsEstimated": 1}))
    db.add(
        EarningsHistory(
            ticker="A",
            date=TODAY - timedelta(days=90),
            data={"epsActual": 1, "epsEstimated": 1},
        )
    )
    db.add(
        EarningsHistory(
            ticker="B",
            date=TODAY + timedelta(days=10),
            data={"epsActual": None, "epsEstimated": 1},
        )
    )
    db.commit()
    out = latest_reported_surprises(db, TODAY)
    assert out["A"]["epsActual"] == 1
    assert "B" not in out


def test_upsert_earnings_history_fills_in_the_actual_after_the_print(db):
    upsert_earnings_history(db, "A", [{"date": "2026-10-20", "epsActual": None, "epsEstimated": 1.0}])
    upsert_earnings_history(db, "A", [{"date": "2026-10-20", "epsActual": 1.2, "epsEstimated": 1.0}])
    db.commit()
    rows = db.query(EarningsHistory).filter(EarningsHistory.ticker == "A").all()
    assert len(rows) == 1
    assert rows[0].data["epsActual"] == 1.2


def test_next_earnings_dates_returns_the_nearest_upcoming_report(db):
    as_of = date(2026, 9, 18)
    for d in (as_of - timedelta(days=5), as_of + timedelta(days=4), as_of + timedelta(days=90)):
        db.add(EarningsHistory(ticker="A", date=d, data={}))
    db.commit()
    assert next_earnings_dates(db, as_of) == {"A": as_of + timedelta(days=4)}


def test_load_return_series_is_close_to_close(db):
    as_of = date(2026, 9, 18)
    for i, close in enumerate([100.0, 110.0, 99.0]):
        db.add(PriceBar(ticker="A", date=as_of - timedelta(days=2 - i), close=close))
    db.commit()
    series = load_return_series(db, {"A"}, as_of, 30)
    assert series["A"][as_of - timedelta(days=1)] == pytest.approx(0.10)
    assert series["A"][as_of] == pytest.approx(-0.10)
