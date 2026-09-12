"""Sample-size gate: no return numbers until n_evaluations >= 24."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from outpick_strategy import RUN118_PARAMS, ScoreSnapshot

from app.services.backtest_metrics import (
    MIN_EVALUATIONS_FOR_HOLDOUT,
    MIN_EVALUATIONS_FOR_RETURNS,
    RETURN_METRIC_KEYS,
    assert_no_return_metrics,
    decision_diagnostics,
    decision_diff_table,
    holdout_split,
    promotion_gates,
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


def test_returns_gate_constant_is_24():
    assert MIN_EVALUATIONS_FOR_RETURNS == 24
    assert MIN_EVALUATIONS_FOR_HOLDOUT == 48


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
    friday = diag["fridays"][0]
    assert friday["gate_pass"] == ["PASS"]
    assert friday["top_pick"] == "PASS"
    assert friday["universe_scope"] == "top400_live"
    assert diag["mixed_scopes"] is False
    assert friday["top_ranked"] == "PASS"
    assert friday["top_ranked_qr"] == 4.5
    assert friday["max_qr"] == 4.5
    assert friday["n_qr_ge_4_0"] == 2
    assert friday["n_qr_in_3_5_4_0"] == 0
    assert friday["gate_fail_counts"] == {"min_revisions_grade": 1}
    assert friday["gate_fail_counts_top25"] == {"min_revisions_grade": 1}
    assert friday["score_cards"]["PASS"]["revisions_grade"] == "A"
    assert friday["score_cards"]["FAIL"]["revisions_grade"] == "F"


def _friday_rows(n: int, start: date = date(2026, 1, 2)):
    rows = []
    d = start
    while len(rows) < n:
        if d.weekday() == 4:
            rows.append(
                {
                    "as_of": d.isoformat(),
                    "top_pick": f"T{len(rows)}",
                    "gate_pass": [f"T{len(rows)}"],
                    "n_gate_pass": 1,
                }
            )
        d += timedelta(days=1)
    return rows


def test_holdout_silent_under_48():
    diag = {"n_evaluations": 47, "fridays": _friday_rows(47)}
    split = holdout_split(diag)
    assert split["status"] == "insufficient_sample"
    assert split["min_evaluations"] == 48
    assert split["in_sample"] is None
    assert split["out_of_sample"] is None
    gates = promotion_gates(47)
    assert gates["decision_diff"]["status"] == "ok"
    assert gates["returns"]["status"] == "ok"
    assert gates["holdout"]["status"] == "insufficient_sample"


def test_holdout_splits_chronologically_at_48():
    diag = {"n_evaluations": 48, "fridays": _friday_rows(48)}
    split = holdout_split(diag)
    assert split["status"] == "ok"
    assert split["in_sample"]["n_evaluations"] == 24
    assert split["out_of_sample"]["n_evaluations"] == 24
    assert split["in_sample"]["end"] < split["out_of_sample"]["start"]
    assert split["in_sample"]["metrics"]["status"] == "insufficient_sample"
    assert "cagr_pct" not in split["in_sample"]["metrics"]
    gates = promotion_gates(48)
    assert gates["holdout"]["status"] == "ok"
    assert gates["returns"]["status"] == "ok"


def test_decision_diff_table_jaccard_and_top_picks():
    left = {
        "fridays": [
            {"as_of": "2026-08-07", "top_pick": "AAA", "gate_pass": ["AAA", "BBB"]},
            {"as_of": "2026-08-21", "top_pick": "AAA", "gate_pass": ["AAA"]},
        ],
        "end_holdings": ["AAA"],
        "trades_by_action": {"buy": 2},
        "rule_counts": {},
    }
    right = {
        "fridays": [
            {"as_of": "2026-08-07", "top_pick": "BBB", "gate_pass": ["AAA", "BBB"]},
            {"as_of": "2026-08-21", "top_pick": "AAA", "gate_pass": ["AAA", "CCC"]},
        ],
        "end_holdings": ["AAA", "CCC"],
        "trades_by_action": {"buy": 2},
        "rule_counts": {},
    }
    table = decision_diff_table(left, right)
    assert table["top_pick_fridays_differ"] == 1
    assert table["n_fridays"] == 2
    assert table["mean_gate_pass_jaccard"] == 0.75
    assert table["end_holdings_current"] == ["AAA"]
    assert table["mean_spearman_qr"] is None
    assert table["fridays"][0]["newly_admitted"] == []
    assert table["fridays"][1]["newly_admitted"] == []
    assert [r["ticker"] for r in table["fridays"][1]["newly_excluded"]] == ["CCC"]


def _snap(ticker: str, qr: float, **grades) -> ScoreSnapshot:
    defaults = {
        "valuation_grade": "B",
        "growth_grade": "A",
        "profitability_grade": "B",
        "momentum_grade": "B",
        "revisions_grade": "A",
    }
    defaults.update(grades)
    return ScoreSnapshot(ticker=ticker, quant_rating=qr, **defaults)


def _empty_replay(as_of: date) -> ReplayResult:
    ev = ReplayEvaluation(
        as_of=as_of,
        fill_date=as_of,
        signals=[],
        trades=[],
        skipped=[],
        before={"cash": 50_000, "positions": {}},
        after={"cash": 50_000, "positions": {}},
    )
    return ReplayResult(
        params_version="test",
        params={},
        fill=FillModel(),
        start=as_of,
        end=as_of,
        evaluations=[ev],
        equity_curve=[],
        final=ReplayBook(cash=50_000.0),
    )


def test_qr_band_and_per_gate_fail_counts_split_universe_and_top25():
    as_of = date(2026, 8, 7)
    scores = {
        "HIGH": _snap("HIGH", 4.2),
        "MID": _snap("MID", 3.7),
        "LOW": _snap("LOW", 3.2),
        "REVFAIL": _snap("REVFAIL", 4.1, revisions_grade="F"),
    }
    for i in range(26):
        ticker = f"Z{i:02d}"
        scores[ticker] = _snap(ticker, 2.0 - i * 0.01, revisions_grade="F")
    diag = decision_diagnostics(
        _empty_replay(as_of),
        params=RUN118_PARAMS,
        scores_by_date={as_of: scores},
        universe_scope_by_date={as_of: "top400_live"},
    )
    friday = diag["fridays"][0]
    assert friday["top_ranked"] == "HIGH"
    assert friday["top_ranked_qr"] == 4.2
    assert friday["max_qr"] == 4.2
    assert friday["n_qr_ge_4_0"] == 2
    assert friday["n_qr_in_3_5_4_0"] == 1
    assert friday["gate_pass"] == ["HIGH", "MID"]
    assert friday["gate_fail_counts"]["min_quant_rating"] == 27
    assert friday["gate_fail_counts"]["min_revisions_grade"] == 27
    # HIGH, REVFAIL, MID, LOW, Z00..Z20 occupy the top 25; Z21.. are out.
    assert friday["gate_fail_counts_top25"]["min_quant_rating"] == 22
    assert friday["gate_fail_counts_top25"]["min_revisions_grade"] == 22


def test_decision_diff_spearman_and_newly_admitted_grades():
    cards = {
        "AAA": {
            "quant_rating": 4.8,
            "revisions_grade": "A",
            "growth_grade": "A-",
            "profitability_grade": "B",
            "valuation_grade": "C",
            "momentum_grade": "B",
        },
        "BBB": {
            "quant_rating": 3.7,
            "revisions_grade": "A",
            "growth_grade": "A",
            "profitability_grade": "B",
            "valuation_grade": "B",
            "momentum_grade": "C",
        },
        "CCC": {
            "quant_rating": 3.2,
            "revisions_grade": "B+",
            "growth_grade": "B",
            "profitability_grade": "B",
            "valuation_grade": "B",
            "momentum_grade": "B",
        },
    }
    same_tape = decision_diff_table(
        {
            "fridays": [
                {
                    "as_of": "2026-08-07",
                    "top_pick": "AAA",
                    "gate_pass": ["AAA", "BBB"],
                    "score_cards": cards,
                }
            ]
        },
        {
            "fridays": [
                {
                    "as_of": "2026-08-07",
                    "top_pick": "AAA",
                    "gate_pass": ["AAA"],
                    "score_cards": cards,
                }
            ]
        },
    )
    assert same_tape["mean_spearman_qr"] == 1.0
    assert same_tape["fridays"][0]["spearman_qr"] == 1.0
    admitted = same_tape["fridays"][0]["newly_admitted"]
    assert [row["ticker"] for row in admitted] == ["BBB"]
    assert admitted[0]["quant_rating"] == 3.7
    assert admitted[0]["revisions_grade"] == "A"
    assert admitted[0]["growth_grade"] == "A"
    reversed_cards = {
        "AAA": {**cards["AAA"], "quant_rating": 3.2},
        "BBB": {**cards["BBB"], "quant_rating": 3.7},
        "CCC": {**cards["CCC"], "quant_rating": 4.8},
    }
    flipped = decision_diff_table(
        {
            "fridays": [
                {
                    "as_of": "2026-08-07",
                    "top_pick": "CCC",
                    "gate_pass": ["CCC"],
                    "score_cards": reversed_cards,
                }
            ]
        },
        {
            "fridays": [
                {
                    "as_of": "2026-08-07",
                    "top_pick": "AAA",
                    "gate_pass": ["AAA"],
                    "score_cards": cards,
                }
            ]
        },
    )
    assert flipped["fridays"][0]["spearman_qr"] == -1.0
    assert [row["ticker"] for row in flipped["fridays"][0]["newly_admitted"]] == ["CCC"]
    assert [row["ticker"] for row in flipped["fridays"][0]["newly_excluded"]] == ["AAA"]
