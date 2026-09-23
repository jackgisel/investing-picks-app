"""Factor IC tape: statistics, forward returns, and one end-to-end Friday."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.db.models import Fundamentals, PriceBar, Stock, UniverseMembership
from worker.backtest.factor_ic import (
    ForwardReturns,
    _parse_variant,
    render_markdown,
    run_variants,
    spearman,
    summarize,
)
from worker.services.scoring import MIN_SECTOR_POPULATION

FRIDAY = date(2026, 9, 4)


def test_spearman_is_rank_based_and_handles_ties():
    assert spearman([1, 2, 3, 4], [10, 20, 30, 1000]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)
    assert spearman([1, 1, 1], [1, 2, 3]) is None


def test_summarize_reports_mean_t_and_hit_rate():
    s = summarize([0.1, 0.2, None, -0.1])
    assert s.n == 3
    assert s.mean == pytest.approx(0.2 / 3)
    assert s.hit == pytest.approx(2 / 3)
    assert s.t is not None


def test_parse_variant_reads_json_values():
    assert _parse_variant("x:momentum_skip_days=21,revisions_eps_scaling=price") == (
        "x",
        {"momentum_skip_days": 21, "revisions_eps_scaling": "price"},
    )


def test_forward_returns_count_sessions_not_calendar_days(db):
    days = [FRIDAY + timedelta(days=d) for d in (0, 3, 4, 5)]  # Fri, Mon, Tue, Wed
    for d, spy, a in zip(days, (100, 101, 102, 103), (10, 11, 12, 13)):
        db.add(PriceBar(ticker="SPY", date=d, close=spy))
        db.add(PriceBar(ticker="A", date=d, close=a))
    db.commit()
    fwd = ForwardReturns(db, FRIDAY)
    assert fwd.forward("A", FRIDAY, 2) == pytest.approx(12 / 10 - 1)
    assert fwd.forward("A", FRIDAY, 5) is None


def test_a_short_benchmark_history_does_not_truncate_the_calendar(db):
    """The cadence copy carries 30 SPY bars; older Fridays still need sessions."""
    old = FRIDAY - timedelta(days=364)  # a Friday a year back
    for k in range(8):
        db.add(PriceBar(ticker="A", date=old + timedelta(days=k), close=10.0 + k))
    db.add(PriceBar(ticker="SPY", date=FRIDAY, close=100.0))
    db.commit()
    fwd = ForwardReturns(db, old)
    assert fwd.forward("A", old, 5) == pytest.approx(15 / 10 - 1)


def test_run_variants_end_to_end(db):
    """Momentum is the only factor that varies, and it predicts the return."""
    n = MIN_SECTOR_POPULATION + 10
    sessions = [FRIDAY + timedelta(days=d) for d in range(0, 10) if (FRIDAY + timedelta(days=d)).weekday() < 5]
    for d in sessions:
        db.add(PriceBar(ticker="SPY", date=d, close=100.0))
    for i in range(n):
        t = f"T{i:02d}"
        db.add(Stock(ticker=t, sector="Technology", market_cap=5e9, is_active=True, is_etf=False))
        db.add(UniverseMembership(ticker=t, as_of=FRIDAY, universe_scope="full"))
        db.add(
            Fundamentals(
                ticker=t,
                as_of=FRIDAY,
                data={
                    "priceToSalesRatioTTM": 5.0,
                    "revenueGrowthTTM": 0.1,
                    "grossProfitMarginTTM": 0.4,
                    "epsRevisionPct": 0.01,
                },
            )
        )
        db.add(PriceBar(ticker=t, date=FRIDAY - timedelta(days=365), close=100.0))
        for k, d in enumerate(sessions):
            # Past winners keep winning: higher i, higher 12m return and drift.
            db.add(PriceBar(ticker=t, date=d, close=(100.0 + i) * (1 + 0.001 * i * k)))
    db.commit()

    result = run_variants(db, {"run118": {}}, [FRIDAY], horizons=(5,))
    h = result["variants"]["run118"]["horizons"]["5"]
    assert h["ic_momentum"]["mean"] == pytest.approx(1.0)
    assert h["ic_composite"]["mean"] > 0.9
    md = render_markdown(result)
    assert "5-session forward returns" in md
