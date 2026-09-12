"""Characterisation snapshot of `evaluate()` under RUN118_PARAMS.

This is not a rule test. It freezes the *entire* signal list the engine emits
for two fixed synthetic books and compares it against a checked-in JSON file.
Any change to strategy behaviour, intended or not, fails here and forces the
golden file to be regenerated in the same change, so "did this PR alter what
Run 118 does?" becomes a reviewable diff instead of a guess.

Regenerate deliberately with:

    UPDATE_GOLDEN=1 python -m pytest packages/strategy/tests/test_golden_evaluate.py

and review the resulting diff in `golden/<version_label>_evaluate.json` line by line.
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

from outpick_strategy import (
    PortfolioState,
    PositionState,
    RUN118_PARAMS,
    ScoreSnapshot,
    evaluate,
    evaluate_sells_only,
)

GOLDEN_PATH = (
    Path(__file__).parent / "golden" / f"{RUN118_PARAMS.version_label}_evaluate.json"
)
AS_OF = date(2026, 7, 17)  # a 3rd Friday

SECTORS = [
    "Technology",
    "Healthcare",
    "Financial Services",
    "Industrials",
    "Consumer Cyclical",
    "Energy",
]


def _universe(n: int = 40) -> dict[str, ScoreSnapshot]:
    """Deterministic scored universe spanning the QR range.

    Grades are chosen so that, among names that clear the QR buy floor, some
    fail each of the revisions / growth / valuation gates and some clear all
    of them.
    """
    scores: dict[str, ScoreSnapshot] = {}
    for i in range(n):
        ticker = f"U{i:02d}"
        # QR walks from 4.95 down to ~1.05 so buy gates, hold removal and
        # strong sell all have candidates on both sides of their thresholds.
        qr = round(4.95 - i * 0.10, 3)
        scores[ticker] = ScoreSnapshot(
            ticker=ticker,
            quant_rating=qr,
            valuation_grade="D" if i % 5 == 3 else "B-",
            growth_grade="C+" if i % 4 == 2 else "B+",
            profitability_grade="B",
            momentum_grade="A-" if i % 2 == 0 else "C",
            revisions_grade="C" if i % 3 == 1 else "A",
            sector=SECTORS[i % len(SECTORS)],
            prior_quant_rating=round(qr + ((i % 5) - 2) * 0.3, 3),
        )
    return scores


def _pos(
    ticker: str,
    shares: float,
    avg_cost: float,
    price: float,
    days_held: int,
    initial_investment: float | None,
    sector: str | None,
) -> PositionState:
    return PositionState(
        ticker=ticker,
        shares=shares,
        avg_cost=avg_cost,
        current_price=price,
        entry_date=AS_OF - timedelta(days=days_held),
        initial_investment=initial_investment,
        sector=sector,
    )


def _mixed_book() -> tuple[PortfolioState, dict[str, ScoreSnapshot]]:
    """Cash-rich book that exercises every exit rule and a funded buy."""
    scores = _universe()
    # Override a handful of scores so specific rules fire on specific names.
    scores["WIN"] = ScoreSnapshot("WIN", 2.2, "B", "B", "B", "B", "B+", "Technology")
    scores["HOUSE"] = ScoreSnapshot("HOUSE", 3.1, "B", "B", "B", "B", "B+", "Energy")
    scores["BIG"] = ScoreSnapshot("BIG", 4.4, "A", "A", "A", "A", "A", "Healthcare")
    scores["DEAD"] = ScoreSnapshot("DEAD", 1.2, "F", "F", "F", "F", "F", "Industrials")
    scores["SINK"] = ScoreSnapshot("SINK", 2.8, "C", "C", "C", "D", "C", "Energy")
    scores["WEAK"] = ScoreSnapshot("WEAK", 3.6, "B", "B", "B", "B", "B", "Technology")
    scores["MEH"] = ScoreSnapshot("MEH", 2.3, "C", "C", "C", "C", "C", "Financial Services")
    # "GHOST" is held but has no score row: must be skipped by every sell rule.

    positions = {
        # Winners Circle: +150%, QR below hold, still holds original stake.
        "WIN": _pos("WIN", 100, 20, 50, 400, 2_000, "Technology"),
        # House money riding: engine sees avg_cost=0 / initial_investment=0.
        "HOUSE": _pos("HOUSE", 40, 0, 90, 600, 0, "Energy"),
        # Over the 15% weight cap, good rating: TRIM only.
        "BIG": _pos("BIG", 200, 100, 150, 200, 20_000, "Healthcare"),
        # Strong sell.
        "DEAD": _pos("DEAD", 300, 30, 12, 120, 9_000, "Industrials"),
        # Underwater > 270d with QR < 3.0.
        "SINK": _pos("SINK", 150, 60, 42, 300, 9_000, "Energy"),
        # Weak (QR < 4) recycle candidate, healthy P&L.
        "WEAK": _pos("WEAK", 50, 80, 88, 90, 4_000, "Technology"),
        # Plain hold removal, small loss, not a winner.
        "MEH": _pos("MEH", 100, 40, 36, 150, 4_000, "Financial Services"),
        # Unscored holding.
        "GHOST": _pos("GHOST", 10, 500, 480, 30, 5_000, "Utilities"),
    }
    portfolio = PortfolioState(
        cash=60_000.0,
        positions=positions,
        peak_equity=200_000.0,
        as_of=AS_OF,
    )
    return portfolio, scores


def _deployed_book() -> tuple[PortfolioState, dict[str, ScoreSnapshot]]:
    """Fully invested book with almost no cash: buys must be funded by recycling.

    The top-ranked name (U00) is already held and up more than 30%, so the one
    add this evaluation is a conviction DOUBLE_BUY, paid for by trimming the
    weakest QR < 4.0 holding.
    """
    scores = _universe()
    positions: dict[str, PositionState] = {}
    for i in range(16):
        ticker = f"U{i:02d}"  # QR 4.95 .. 3.45, mixed sectors, nothing below hold
        s = scores[ticker]
        price = 100.0 + i * 3
        avg_cost = 70.0 if i == 0 else 95.0 + i * 2
        positions[ticker] = _pos(
            ticker,
            shares=35.0,
            avg_cost=avg_cost,
            price=price,
            days_held=30 + i * 15,
            initial_investment=35.0 * avg_cost,
            sector=s.sector,
        )
    portfolio = PortfolioState(
        cash=1_200.0,
        positions=positions,
        peak_equity=110_000.0,
        as_of=AS_OF,
    )
    return portfolio, scores


def _ranked(scores: dict[str, ScoreSnapshot]) -> list[str]:
    # Same ordering the live caller uses (portfolio.ranked_candidates), with a
    # ticker tie-break so the fixture is stable regardless of dict order.
    return sorted(scores, key=lambda t: (-scores[t].quant_rating, t))


def _round(obj):
    if isinstance(obj, float):
        return round(obj, 6)
    if isinstance(obj, dict):
        return {k: _round(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_round(v) for v in obj]
    return obj


def current_snapshot() -> dict:
    mixed_pf, mixed_scores = _mixed_book()
    deployed_pf, deployed_scores = _deployed_book()
    daily_params = RUN118_PARAMS.with_overrides(enable_daily_sell_pass=True)
    return _round(
        {
            "params_version": RUN118_PARAMS.version_hash(),
            "mixed_book": [
                s.to_dict()
                for s in evaluate(mixed_pf, mixed_scores, _ranked(mixed_scores), RUN118_PARAMS)
            ],
            "deployed_book": [
                s.to_dict()
                for s in evaluate(
                    deployed_pf, deployed_scores, _ranked(deployed_scores), RUN118_PARAMS
                )
            ],
            "mixed_book_daily_sells": [
                s.to_dict()
                for s in evaluate_sells_only(mixed_pf, mixed_scores, daily_params)
            ],
        }
    )


def test_evaluate_matches_golden_snapshot():
    snapshot = current_snapshot()
    if os.environ.get("UPDATE_GOLDEN"):
        GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        GOLDEN_PATH.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n")
    assert GOLDEN_PATH.exists(), (
        "golden file missing; run with UPDATE_GOLDEN=1 to create it"
    )
    expected = json.loads(GOLDEN_PATH.read_text())

    if expected["params_version"] != snapshot["params_version"]:
        # A params change is allowed, but it must be deliberate: the golden
        # must be regenerated in the same change.
        assert expected == snapshot, (
            "RUN118_PARAMS changed (version hash differs). Regenerate the golden "
            "with UPDATE_GOLDEN=1 and review the signal diff."
        )

    for scenario in ("mixed_book", "deployed_book", "mixed_book_daily_sells"):
        got = snapshot[scenario]
        want = expected[scenario]
        got_keys = [(s["action"], s["ticker"]) for s in got]
        want_keys = [(s["action"], s["ticker"]) for s in want]
        assert got_keys == want_keys, (
            f"{scenario}: signal set changed.\n  was:  {want_keys}\n  now:  {got_keys}"
        )
        for g, w in zip(got, want):
            assert g == w, f"{scenario}: {g['action']} {g['ticker']} changed:\n  was: {w}\n  now: {g}"


def test_golden_scenarios_cover_every_rule():
    """The fixture must keep exercising each rule, or the snapshot stops meaning much."""
    snapshot = current_snapshot()
    fired = {
        r["rule_id"]
        for scenario in ("mixed_book", "deployed_book")
        for s in snapshot[scenario]
        for r in s["rules"]
    }
    for rule in (
        "position_weight_cap",
        "underwater_stop",
        "strong_sell",
        "hold_removal",
        "winners_circle",
        "active_recycling",
        "max_adds_per_evaluation",
        "double_buy",
        "min_quant_rating",
        "min_revisions_grade",
    ):
        assert rule in fired, f"fixture no longer exercises {rule}"
    actions = {
        s["action"] for scenario in ("mixed_book", "deployed_book") for s in snapshot[scenario]
    }
    assert {
        "buy",
        "double_buy",
        "full_sell",
        "partial_sell",
        "trim",
        "recycle_trim",
    } <= actions, actions
    # The unscored holding must appear nowhere.
    assert not any(
        s["ticker"] == "GHOST" for scenario in snapshot.values() if isinstance(scenario, list) for s in scenario
    )
