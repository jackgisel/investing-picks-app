"""Sample-size gate: no return numbers until n_evaluations >= 24."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from outpick_strategy import RUN118_PARAMS, ScoreSnapshot

from app.services.backtest_metrics import (
    MIN_EVALUATIONS_FOR_RETURNS,
    RETURN_METRIC_KEYS,
    assert_no_return_metrics,
    decision_diagnostics,
    risk_return_metrics,
)
from app.services.replay import (
    FillModel,
    ReplayBook,
    ReplayEvaluation,
    ReplayResult,
    ReplayTrade,
)


def _curve(n_days: int, start: date = date(2026, 1, 2), start_eq: float = 50_000.0):
    out = []
    eq = start_eq
    for i in range(n_days):
        d = start + timedelta(days=i)
        if d.weekday() >= 5:
            continue
        eq *= 1.001
        out.append(
            {
                "date": d.isoformat(),
                "cash": round(eq, 2),
                "invested": 0.0,
                "equity": round(eq, 2),
                "position_count": 0,
            }
        )
    return out


def test_at_gate_metrics_include_risk_return():
    assert MIN_EVALUATIONS_FOR_RETURNS == 24


def test_below_gate_metrics_have_no_return_keys():
    metrics = risk_return_metrics(
        n_evaluations=3,
        equity_curve=_curve(40),
        trades=[],
    )
    assert metrics["status"] == "insufficient_sample"
    assert metrics["n_evaluations"] == 3
    assert metrics["min_evaluations"] == 24
    leaked = RETURN_METRIC_KEYS & metrics.keys()
    assert leaked == set()
    assert_no_return_metrics(metrics)


def test_assert_no_return_metrics_raises_on_leak():
    with pytest.raises(ValueError, match="leaked"):
        assert_no_return_metrics(
            {"status": "insufficient_sample", "n_evaluations": 3, "cagr_pct": 12.0}
        )


def test_at_gate_metrics_include_risk_return():
    metrics = risk_return_metrics(
        n_evaluations=24,
        equity_curve=_curve(300),
        trades=[],
    )
    assert metrics["status"] == "ok"
    assert metrics["cagr_pct"] is not None
    assert metrics["sharpe"] is not None
    assert metrics["max_drawdown_pct"] is not None
    assert "bands" in metrics
    assert "cagr_pct" in metrics["bands"]


def test_diagnostics_uses_strategy_buy_gate_not_a_copy():
    as_of = date(2026, 8, 7)
    scores = {
        "PASS": ScoreSnapshot(
            ticker="PASS",
            quant_rating=4.5,
            valuation_grade="B",
            growth_grade="A",
            profitability_grade="B",
            momentum_grade="F",
            revisions_grade="A",
        ),
        "FAIL": ScoreSnapshot(
            ticker="FAIL",
            quant_rating=4.5,
            valuation_grade="B",
            growth_grade="A",
            profitability_grade="B",
            momentum_grade="A",
            revisions_grade="F",
        ),
    }
    ev = ReplayEvaluation(
        as_of=as_of,
        fill_date=as_of,
        signals=[],
        trades=[
            ReplayTrade(
                as_of, as_of, "PASS", "buy", "buy", 10, 50, 500, "Top pick"
            )
        ],
        skipped=[],
        before={"cash": 50_000, "positions": {}},
        after={"cash": 49_500, "positions": {"PASS": {"shares": 10}}},
    )
    result = ReplayResult(
        params_version="test",
        params={},
        fill=FillModel(),
        start=as_of,
        end=as_of,
        evaluations=[ev],
        equity_curve=[],
        final=ReplayBook(cash=49_500.0),
    )
    diag = decision_diagnostics(
        result,
        params=RUN118_PARAMS,
        scores_by_date={as_of: scores},
        universe_scope_by_date={as_of: "top400_live"},
    )
    assert diag["n_evaluations"] == 1
    assert diag["fridays"][0]["gate_pass"] == ["PASS"]
    assert diag["fridays"][0]["top_pick"] == "PASS"
    assert diag["fridays"][0]["universe_scope"] == "top400_live"
    assert diag["mixed_scopes"] is False
