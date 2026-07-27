"""Audit pass over the Run 118 engine: rule boundaries + characterised defects.

Every test here exists to prevent a specific way a paying subscriber could be
shown a wrong trade. Tests marked ``xfail(strict=True)`` assert the behaviour we
believe is *correct*; they fail today and document a defect (BUG-S<n>) without
breaking the suite. Do not "fix" them by weakening the assertion.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from outpick_strategy import (
    Action,
    PortfolioState,
    PositionState,
    RUN118_PARAMS,
    ScoreSnapshot,
    evaluate,
    evaluate_sells_only,
    grade_meets_minimum,
    percentile_to_grade,
    quant_to_signal,
)
from outpick_strategy.cadence import (
    evaluation_fridays_between,
    is_evaluation_friday,
    next_evaluation_friday,
)
from outpick_strategy.params import BuyCriteria
from outpick_strategy.scoring import (
    composite_from_factor_pcts,
    factor_percentile_score,
    quant_rating_from_composite,
)
from outpick_strategy.signals import (
    _drawdown_halted,
    _weight_trim_signals,
    meets_buy_criteria,
)

TODAY = date(2026, 7, 17)

SELL_ACTIONS = (
    Action.FULL_SELL,
    Action.PARTIAL_SELL,
    Action.TRIM,
    Action.RECYCLE_TRIM,
)


def score(ticker: str, qr: float, sector: str | None = "Technology", **grades) -> ScoreSnapshot:
    defaults = {
        "valuation_grade": "B",
        "growth_grade": "B",
        "profitability_grade": "B",
        "momentum_grade": "B",
        "revisions_grade": "B+",
    }
    defaults.update(grades)
    return ScoreSnapshot(ticker=ticker, quant_rating=qr, sector=sector, **defaults)


def position(
    ticker: str,
    *,
    shares: float = 100.0,
    avg_cost: float = 50.0,
    price: float = 50.0,
    days_held: int = 100,
    initial_investment: float | None = 5_000.0,
    sector: str | None = "Technology",
) -> PositionState:
    return PositionState(
        ticker=ticker,
        shares=shares,
        avg_cost=avg_cost,
        current_price=price,
        entry_date=TODAY - timedelta(days=days_held) if days_held is not None else None,
        initial_investment=initial_investment,
        sector=sector,
    )


def solo(pos: PositionState, qr: float, cash: float = 1_000_000.0, **kw):
    """One position in a cash-heavy book, so weight caps never interfere."""
    portfolio = PostionBook = PortfolioState(cash=cash, positions={pos.ticker: pos}, as_of=TODAY)
    return evaluate(portfolio, {pos.ticker: score(pos.ticker, qr, **kw)}, [], RUN118_PARAMS)


def rule_ids(signals) -> set[str]:
    return {r.rule_id for s in signals for r in s.rules}


# ---------------------------------------------------------------------------
# BUG-S1 — one ticker, two selling signals, no reconciliation in evaluate()
# ---------------------------------------------------------------------------


def _overweight_winner_book():
    """A +100% winner at 50% of the book whose rating has fallen below hold.

    Weight cap wants it cut to 12%; Winners Circle wants the original stake
    taken off and the rest left riding as house money. Both fire.
    """
    pos = position("WIN", shares=100, avg_cost=5, price=10, initial_investment=500)
    return PortfolioState(cash=1_000, positions={"WIN": pos}, as_of=TODAY)


@pytest.mark.xfail(
    reason="BUG-S1: _weight_trim_signals and _removal_signals both sell the same "
    "ticker; evaluate() never reconciles them",
    strict=True,
)
def test_trim_and_partial_sell_never_oversell_a_position():
    """A TRIM plus a Winners-Circle PARTIAL_SELL must not exceed shares held.

    Real failure: the engine emits sell instructions for 126 shares of a
    100-share holding. Downstream fills PARTIAL_SELL first (flagging the
    remainder house money) then TRIMs min(remaining, 76) — which wipes out the
    entire house-money stake the Winners Circle rule just created.
    """
    portfolio = _overweight_winner_book()
    signals = evaluate(portfolio, {"WIN": score("WIN", 2.0)}, [], RUN118_PARAMS)

    ordered = sum(s.sell_shares or 0.0 for s in signals if s.ticker == "WIN")
    assert ordered <= portfolio.positions["WIN"].shares, (
        f"engine ordered {ordered} shares sold out of 100 held: "
        f"{[(s.action.value, s.sell_shares) for s in signals]}"
    )


@pytest.mark.xfail(
    reason="BUG-S1: a position marked for FULL_SELL is still weight-trimmed in "
    "the same evaluation",
    strict=True,
)
def test_a_position_being_fully_exited_is_not_also_trimmed():
    """A subscriber must never see 'Trim X to 12%' and 'Sell all X' together.

    Real failure: an overweight holding whose rating drops below hold gets both
    a TRIM and a FULL_SELL in the same published evaluation — contradictory
    instructions for anyone mirroring the book by hand.
    """
    pos = position("X", shares=200, avg_cost=20, price=10, initial_investment=4_000)
    portfolio = PortfolioState(cash=0, positions={"X": pos}, as_of=TODAY)
    signals = evaluate(portfolio, {"X": score("X", 2.0)}, [], RUN118_PARAMS)

    selling = [s.action for s in signals if s.ticker == "X" and s.action in SELL_ACTIONS]
    assert len(selling) == 1, f"two exit instructions for one ticker: {selling}"


@pytest.mark.xfail(
    reason="BUG-S3: _buy_signals' sim_cash adds a ticker's full market value for "
    "its FULL_SELL and again for its TRIM",
    strict=True,
)
def test_buy_is_not_authorised_against_double_counted_sale_proceeds():
    """Cash freed by a sale must be counted once, not once per selling signal.

    Real failure: X is worth $2,000 and is both TRIMmed (176 sh = $1,760) and
    FULL_SELLd. sim_cash reads $3,760 against a $3,000 target notional, so a BUY
    is issued. Only $2,000 ever arrives, and apply_signals silently under-fills
    the new position to two thirds of its intended size.
    """
    pos = position("X", shares=200, avg_cost=20, price=10, initial_investment=4_000)
    portfolio = PortfolioState(cash=0, positions={"X": pos}, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(position_size_usd=3_000.0, cash_reserve_buys=0)
    scores = {"X": score("X", 2.0), "NEW": score("NEW", 4.8, sector="Energy")}

    signals = evaluate(portfolio, scores, ["NEW"], params)

    buys = [s for s in signals if s.action == Action.BUY]
    assert buys == [], "bought $3,000 of NEW with $2,000 of realisable cash"


# ---------------------------------------------------------------------------
# BUG-S2 — trim and add the same name in one evaluation
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S2: _buy_signals only excludes tickers in `exiting` (FULL_SELL); "
    "a weight-capped TRIM does not block a conviction add on the same name",
    strict=True,
)
def test_a_trimmed_name_is_not_conviction_added_in_the_same_evaluation():
    """The weight cap and the conviction add must not fight over one ticker.

    Real failure: BIG is 50% of the book (+100%, QR 4.6). The engine publishes
    'Trim BIG: 50% -> 12%' and 'Conviction add BIG' in the same evaluation.
    Executed in order that is a 76-share sale immediately followed by a
    repurchase — pure churn against the position cap that just fired.
    """
    positions = {
        "BIG": position("BIG", shares=100, avg_cost=50, price=100, sector="Tech"),
        "SM": position("SM", shares=100, avg_cost=50, price=50, sector="Health"),
    }
    portfolio = PortfolioState(cash=5_000, positions=positions, as_of=TODAY)
    scores = {"BIG": score("BIG", 4.6, sector="Tech"), "SM": score("SM", 4.2, sector="Health")}

    signals = evaluate(portfolio, scores, ["BIG"], RUN118_PARAMS)

    actions = {s.action for s in signals if s.ticker == "BIG"}
    assert not (Action.TRIM in actions and Action.DOUBLE_BUY in actions), actions


# ---------------------------------------------------------------------------
# BUG-S4 — DOUBLE_BUY has no minimum-funding floor
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S4: the BUY path gates on sim_cash >= 0.5 * target_notional; the "
    "DOUBLE_BUY path has no such check",
    strict=True,
)
def test_conviction_add_needs_the_same_cash_floor_as_a_first_buy():
    """A conviction add must not be published when there is no cash to fund it.

    Real failure: $10 cash plus a $10 recycle trim = $20 available against a
    $3,000 target notional, and the engine still emits DOUBLE_BUY with
    target_notional=$3,000. The identical situation on a *new* name is correctly
    rejected by the 0.5x floor.
    """
    positions = {
        "CONV": position("CONV", shares=10, avg_cost=50, price=100, initial_investment=500),
        "TINY": position("TINY", shares=1, avg_cost=10, price=10, initial_investment=10,
                         sector="Health"),
    }
    portfolio = PortfolioState(cash=10, positions=positions, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(
        position_size_usd=3_000.0, cash_reserve_buys=0, position_cap_normal=1.0
    )
    scores = {"CONV": score("CONV", 4.6), "TINY": score("TINY", 3.0, sector="Health")}

    signals = evaluate(portfolio, scores, ["CONV"], params)

    assert [s for s in signals if s.action == Action.DOUBLE_BUY] == []


def test_a_first_buy_does_enforce_the_half_notional_floor():
    """Pins the asymmetry BUG-S4 is measured against, so a fix cannot delete it."""
    portfolio = PortfolioState(cash=1_400, positions={}, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(position_size_usd=3_000.0, cash_reserve_buys=0)
    signals = evaluate(portfolio, {"NEW": score("NEW", 4.8)}, ["NEW"], params)
    assert [s for s in signals if s.action == Action.BUY] == []


# ---------------------------------------------------------------------------
# BUG-S5 (characterisation, not xfail) — sector cap fails open on missing data
# ---------------------------------------------------------------------------


def test_sector_cap_is_bypassed_entirely_when_the_candidate_has_no_sector():
    """CHARACTERISES BUG-S5: unknown sector == exempt from the concentration cap.

    `Position.sector` and `Stock.sector` are both nullable, so this is reachable
    whenever FMP does not return a sector. The cap fails OPEN here while the
    scoring coverage floor next door deliberately fails CLOSED. Locked in so the
    inconsistency is a decision rather than an accident.
    """
    positions, scores = {}, {}
    for i in range(15):
        t = f"TECH{i}"
        positions[t] = position(t, shares=10, avg_cost=100, price=100,
                                initial_investment=1_000, sector="Technology")
        scores[t] = score(t, 4.0)
    scores["MYSTERY"] = score("MYSTERY", 4.8, sector=None)
    portfolio = PortfolioState(cash=500_000, positions=positions, as_of=TODAY)

    signals = evaluate(portfolio, scores, ["MYSTERY"], RUN118_PARAMS)
    assert [s.ticker for s in signals if s.action == Action.BUY] == ["MYSTERY"]


def test_holdings_with_no_sector_do_not_count_toward_the_cap():
    """CHARACTERISES BUG-S5: sectorless holdings are invisible to the cap.

    15 holdings with no sector on either the score or the position do not block
    a 16th name in any sector — the cap counts only names it can classify.
    """
    positions, scores = {}, {}
    for i in range(15):
        t = f"U{i}"
        positions[t] = position(t, shares=10, avg_cost=100, price=100,
                                initial_investment=1_000, sector=None)
        scores[t] = score(t, 4.0, sector=None)
    scores["NEWT"] = score("NEWT", 4.8, sector="Technology")
    portfolio = PortfolioState(cash=500_000, positions=positions, as_of=TODAY)

    signals = evaluate(portfolio, scores, ["NEWT"], RUN118_PARAMS)
    assert [s.ticker for s in signals if s.action == Action.BUY] == ["NEWT"]


# ---------------------------------------------------------------------------
# BUG-S6 — grade_meets_minimum fails open on an unrecognised minimum
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S6: GRADE_ORDER.get(min_grade, 0) makes any unrecognised minimum "
    "grade equivalent to 'F', i.e. no gate at all",
    strict=True,
)
def test_unrecognised_minimum_grade_does_not_silently_disable_the_gate():
    """A typo'd or lower-cased threshold must not open the gate to everything.

    Real failure: BuyCriteria(min_revisions_grade="a+") — a case slip on the
    strictest possible threshold — resolves to rank 0, so a stock with an F in
    revisions passes the revisions gate. Revisions carries weight 0.30 and gates
    every buy; the strategy would silently stop filtering on it.
    """
    assert grade_meets_minimum("F", "b+") is False


@pytest.mark.xfail(
    reason="BUG-S6: an unrecognised min grade reaches meets_buy_criteria unvalidated",
    strict=True,
)
def test_case_slipped_buy_criteria_still_rejects_an_f_grade():
    """The end-to-end consequence of BUG-S6 inside meets_buy_criteria."""
    params = RUN118_PARAMS.with_overrides(buy_criteria=BuyCriteria(min_revisions_grade="a+"))
    ok, _ = meets_buy_criteria(score("X", 4.0, revisions_grade="F"), params)
    assert ok is False


def test_a_missing_grade_on_the_stock_side_correctly_fails_closed():
    """The stock-side default is right — only the threshold side fails open."""
    assert grade_meets_minimum(None, "B+") is False
    assert grade_meets_minimum("F", "B+") is False


# ---------------------------------------------------------------------------
# BUG-S7 — sector cap truncates to zero on a small book
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S7: int(max_positions * sector_concentration) floors to 0 for "
    "max_positions <= 3, and the cap then blocks every classified buy",
    strict=True,
)
def test_small_max_positions_does_not_forbid_every_buy():
    """A 3-name book must still be able to buy its first name.

    Real failure: max_positions=3 gives int(3 * 0.30) == 0, and the cap fires on
    `count >= 0`, which is true for an empty book. Every candidate with a known
    sector is rejected forever; only sectorless tickers can ever be bought.
    """
    portfolio = PortfolioState(cash=100_000, positions={}, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(max_positions=3)
    signals = evaluate(portfolio, {"NEW": score("NEW", 4.8)}, ["NEW"], params)
    assert [s.ticker for s in signals if s.action == Action.BUY] == ["NEW"]


def test_sector_cap_boundary_at_the_default_fifty_slot_book():
    """int(50 * 0.30) == 15: the 15th tech name is allowed, the 16th is not."""

    def book(n_tech: int):
        positions, scores = {}, {}
        for i in range(n_tech):
            t = f"TECH{i}"
            positions[t] = position(t, shares=10, avg_cost=100, price=100,
                                    initial_investment=1_000, sector="Technology")
            scores[t] = score(t, 4.0)
        scores["NEWT"] = score("NEWT", 4.8, sector="Technology")
        return PortfolioState(cash=500_000, positions=positions, as_of=TODAY), scores

    pf14, sc14 = book(14)
    assert [s.ticker for s in evaluate(pf14, sc14, ["NEWT"], RUN118_PARAMS)
            if s.action == Action.BUY] == ["NEWT"]

    pf15, sc15 = book(15)
    assert [s for s in evaluate(pf15, sc15, ["NEWT"], RUN118_PARAMS)
            if s.action == Action.BUY] == []


# ---------------------------------------------------------------------------
# BUG-S8 — Winners Circle collapses to a full exit on a null initial_investment
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S8: `pos.initial_investment` is truthiness-tested, so a NULL "
    "initial_investment skips the Winners Circle and full-sells the winner",
    strict=True,
)
def test_winners_circle_survives_a_null_initial_investment():
    """A +100% winner must not be liquidated just because its cost basis is NULL.

    Real failure: Position.initial_investment is nullable and
    worker/import_positions.py leaves it None for hand-entered rows. Such a
    holding at +100% with QR 2.0 gets a FULL_SELL instead of the partial sell
    that keeps the house-money stake. shares * avg_cost is available and is
    exactly the number the rule needs.
    """
    pos = position("W", shares=100, avg_cost=50, price=100, initial_investment=None)
    signals = solo(pos, 2.0)
    actions = {s.action for s in signals if s.ticker == "W"}
    assert Action.FULL_SELL not in actions, actions


def test_winners_circle_recovers_exactly_the_initial_dollars():
    """sell_shares * price must equal the original stake — not the entry shares.

    Guards the units of `initial_shares = initial_investment / current_price`:
    it is a dollar recovery, and reading it as 'the shares first bought' would
    leave real capital on the table at a 2x.
    """
    pos = position("W", shares=100, avg_cost=50, price=100, initial_investment=5_000)
    signals = solo(pos, 2.0)
    partial = next(s for s in signals if s.action == Action.PARTIAL_SELL)
    assert partial.sell_shares * pos.current_price == pytest.approx(5_000.0)
    assert partial.keep_shares == pytest.approx(50.0)


# ---------------------------------------------------------------------------
# BUG-S9 — the drawdown circuit breaker leaves no trace
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S9: evaluate() builds the drawdown placeholder then strips it via "
    "the skip_execution filter on the return statement",
    strict=True,
)
def test_a_drawdown_halt_is_recorded_in_the_returned_signals():
    """A halted evaluation must say so, not return an empty list.

    Real failure: with the breaker on and equity 50% below peak, evaluate()
    returns []. That is indistinguishable from 'nothing qualified today', so the
    ledger and the subscriber-facing evaluation show no reason at all for the
    absence of picks. The code comment three lines above says 'Record that buys
    were blocked'.
    """
    params = RUN118_PARAMS.with_overrides(enable_drawdown_circuit_breaker=True)
    portfolio = PortfolioState(cash=100_000, positions={}, peak_equity=200_000, as_of=TODAY)
    signals = evaluate(portfolio, {"NEW": score("NEW", 4.8)}, ["NEW"], params)
    assert "drawdown_circuit_breaker" in rule_ids(signals)


def test_drawdown_halt_and_resume_boundaries():
    """-15% halts, -10% resumes; both comparisons are strict.

    Pins hysteresis: a book sitting at exactly -15% must not halt, and a halted
    book at exactly -10% must not resume, or the breaker chatters on the edge.
    """
    params = RUN118_PARAMS.with_overrides(enable_drawdown_circuit_breaker=True)

    def halted(equity, peak, currently):
        pf = PortfolioState(cash=equity, positions={}, peak_equity=peak,
                            is_drawdown_halted=currently, as_of=TODAY)
        return _drawdown_halted(pf, params)[0]

    assert halted(85_000, 100_000, False) is False   # exactly -15%
    assert halted(84_900, 100_000, False) is True    # past -15%
    assert halted(90_000, 100_000, True) is True     # exactly -10%, stays halted
    assert halted(90_100, 100_000, True) is False    # above -10%, resumes


def test_drawdown_breaker_is_off_by_default_and_never_blocks_buys():
    params = RUN118_PARAMS
    assert params.enable_drawdown_circuit_breaker is False
    portfolio = PortfolioState(cash=100_000, positions={}, peak_equity=1_000_000, as_of=TODAY)
    signals = evaluate(portfolio, {"NEW": score("NEW", 4.8)}, ["NEW"], params)
    assert [s.action for s in signals] == [Action.BUY]


# ---------------------------------------------------------------------------
# BUG-S10 — which name gets recycled is not reproducible
# ---------------------------------------------------------------------------


def _recycle_book(order: tuple[str, str]) -> tuple[PortfolioState, dict]:
    positions: dict[str, PositionState] = {}
    for t in order:
        positions[t] = position(t, sector="Healthcare")
    for i in range(8):
        t = f"F{i}"
        positions[t] = position(t, sector="Utilities")
    portfolio = PortfolioState(cash=500, positions=positions, as_of=TODAY)
    scores = {t: score(t, 4.2, sector=positions[t].sector) for t in positions}
    for t in order:
        scores[t] = score(t, 3.0, sector="Healthcare")
    scores["NEW"] = score("NEW", 4.8, sector="Energy")
    return portfolio, scores


@pytest.mark.xfail(
    reason="BUG-S10: _plan_recycle_trims sorts on quant_rating alone, so ties are "
    "broken by portfolio.positions insertion order",
    strict=True,
)
def test_recycle_choice_is_reproducible_when_ratings_tie():
    """Two identically-weak holdings must not resolve by dict insertion order.

    Real failure: AAA and ZZZ both at QR 3.0 with identical size. Whichever the
    caller's positions dict happens to list first is the one sold. The same book
    loaded by a different query ordering produces a different trade, so a
    backtest and the live book can diverge on identical inputs.
    """
    pf_a, sc_a = _recycle_book(("AAA", "ZZZ"))
    pf_b, sc_b = _recycle_book(("ZZZ", "AAA"))

    picked_a = [s.ticker for s in evaluate(pf_a, sc_a, ["NEW"], RUN118_PARAMS)
                if s.action == Action.RECYCLE_TRIM]
    picked_b = [s.ticker for s in evaluate(pf_b, sc_b, ["NEW"], RUN118_PARAMS)
                if s.action == Action.RECYCLE_TRIM]

    assert picked_a == picked_b == ["AAA"], (picked_a, picked_b)


def test_recycle_prefers_the_strictly_weakest_name():
    """Untied ratings must always pick the lowest — the part that does work."""
    positions = {
        "MID": position("MID", sector="Healthcare"),
        "WEAKEST": position("WEAKEST", sector="Healthcare"),
    }
    for i in range(8):
        positions[f"F{i}"] = position(f"F{i}", sector="Utilities")
    portfolio = PortfolioState(cash=500, positions=positions, as_of=TODAY)
    scores = {t: score(t, 4.2, sector=positions[t].sector) for t in positions}
    scores["MID"] = score("MID", 3.9, sector="Healthcare")
    scores["WEAKEST"] = score("WEAKEST", 2.6, sector="Healthcare")
    scores["NEW"] = score("NEW", 4.8, sector="Energy")

    picked = [s.ticker for s in evaluate(portfolio, scores, ["NEW"], RUN118_PARAMS)
              if s.action == Action.RECYCLE_TRIM]
    assert picked == ["WEAKEST"]


def test_recycle_boundary_at_weak_signal_threshold():
    """QR exactly 4.0 is not weak; 3.99 is. The recycle bar equals the buy bar."""

    def picked(weak_qr: float):
        positions = {"CAND": position("CAND", sector="Healthcare")}
        for i in range(8):
            positions[f"F{i}"] = position(f"F{i}", sector="Utilities")
        portfolio = PortfolioState(cash=500, positions=positions, as_of=TODAY)
        scores = {t: score(t, 4.2, sector=positions[t].sector) for t in positions}
        scores["CAND"] = score("CAND", weak_qr, sector="Healthcare")
        scores["NEW"] = score("NEW", 4.8, sector="Energy")
        return [s.ticker for s in evaluate(portfolio, scores, ["NEW"], RUN118_PARAMS)
                if s.action == Action.RECYCLE_TRIM]

    assert picked(4.0) == []
    assert picked(3.99) == ["CAND"]


def test_recycle_never_sells_more_shares_than_are_held():
    """min(pos.shares, ...) is the only thing between a trim and a naked short."""
    positions = {"TINY": position("TINY", shares=1, avg_cost=10, price=10,
                                  initial_investment=10, sector="Healthcare")}
    for i in range(3):
        positions[f"F{i}"] = position(f"F{i}", shares=100, avg_cost=10, price=10,
                                      initial_investment=1_000, sector=f"S{i}")
    portfolio = PortfolioState(cash=1_800, positions=positions, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(position_size_usd=3_000.0, cash_reserve_buys=0,
                                          position_cap_normal=1.0)
    scores = {t: score(t, 4.2, sector=positions[t].sector) for t in positions}
    scores["TINY"] = score("TINY", 3.0, sector="Healthcare")
    scores["NEW"] = score("NEW", 4.8, sector="Energy")

    for s in evaluate(portfolio, scores, ["NEW"], params):
        if s.action == Action.RECYCLE_TRIM:
            assert s.sell_shares <= portfolio.positions[s.ticker].shares


# ---------------------------------------------------------------------------
# BUG-S11 — a full book blocks conviction adds too
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S11: _buy_signals returns early on open_slots <= 0, which also "
    "kills DOUBLE_BUY even though an add consumes no slot",
    strict=True,
)
def test_a_full_book_can_still_add_to_an_existing_winner():
    """Adding to a name already held does not need a free position slot.

    Real failure: at max_positions the engine can never take a conviction add,
    so the double-buy rule silently stops existing exactly when the book is
    fully deployed — the steady state the strategy is designed to run in.
    """
    positions, scores = {}, {}
    for i in range(3):
        t = f"P{i}"
        positions[t] = position(t, shares=100, avg_cost=50, price=100, sector=f"Sec{i}")
        scores[t] = score(t, 4.5, sector=f"Sec{i}")
    portfolio = PortfolioState(cash=50_000, positions=positions, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(max_positions=3)

    signals = evaluate(portfolio, scores, ["P0"], params)
    assert [s.ticker for s in signals if s.action == Action.DOUBLE_BUY] == ["P0"]


def test_max_positions_boundary_and_slot_freed_by_an_exit():
    """49 held buys, 50 held does not, and a pending FULL_SELL frees the slot."""

    def book(n: int, sell_one: bool):
        positions, scores = {}, {}
        for i in range(n):
            t = f"N{i}"
            positions[t] = position(t, shares=1, avg_cost=100, price=100,
                                    initial_investment=100, sector=f"S{i % 9}")
            scores[t] = score(t, 4.2, sector=f"S{i % 9}")
        if sell_one:
            scores["N0"] = score("N0", 1.0, sector="S0")
        scores["NEW"] = score("NEW", 4.9, sector="Energy")
        return PortfolioState(cash=500_000, positions=positions, as_of=TODAY), scores

    pf, sc = book(49, False)
    assert [s.ticker for s in evaluate(pf, sc, ["NEW"], RUN118_PARAMS)
            if s.action == Action.BUY] == ["NEW"]

    pf, sc = book(50, False)
    assert [s for s in evaluate(pf, sc, ["NEW"], RUN118_PARAMS)
            if s.action == Action.BUY] == []

    pf, sc = book(50, True)
    assert [s.ticker for s in evaluate(pf, sc, ["NEW"], RUN118_PARAMS)
            if s.action == Action.BUY] == ["NEW"]


def test_double_buy_gain_boundary():
    """+30.0% exactly qualifies for a conviction add; +29% does not."""

    def added(price: float):
        positions = {"C": position("C", shares=10, avg_cost=100, price=price,
                                   initial_investment=1_000)}
        portfolio = PortfolioState(cash=1_000_000, positions=positions, as_of=TODAY)
        return [s.action for s in evaluate(portfolio, {"C": score("C", 4.6)}, ["C"],
                                           RUN118_PARAMS)]

    assert Action.DOUBLE_BUY in added(130.0)
    assert Action.DOUBLE_BUY not in added(129.0)


# ---------------------------------------------------------------------------
# BUG-S12 — the Z-score filter is opt-in and nothing opts in
# ---------------------------------------------------------------------------


def test_missing_z_score_silently_skips_the_z_filter():
    """CHARACTERISES BUG-S12: z_score defaults to None, which means 'pass'.

    The only production caller (worker/services/scoring.py) never passes
    z_score, so z_score_floor=1.8 has never rejected anything. Meanwhile a
    missing *factor* refuses to score the ticker at all. Same file, opposite
    treatment of missing data. Pinned so the deadness is visible.
    """
    full = {k: 60.0 for k in
            ("valuation", "growth", "profitability", "momentum", "revisions")}
    assert composite_from_factor_pcts(full, RUN118_PARAMS)[0] == pytest.approx(60.0)
    assert composite_from_factor_pcts(full, RUN118_PARAMS, z_score=None)[0] == pytest.approx(60.0)
    # A ticker that would be rejected outright if the score were supplied:
    assert composite_from_factor_pcts(full, RUN118_PARAMS, z_score=0.0)[0] is None


def test_z_filter_boundary_when_it_is_supplied():
    """z exactly at the floor passes; a hair below is unscoreable."""
    full = {k: 60.0 for k in
            ("valuation", "growth", "profitability", "momentum", "revisions")}
    floor = RUN118_PARAMS.z_score_floor
    assert composite_from_factor_pcts(full, RUN118_PARAMS, z_score=floor)[0] is not None
    assert composite_from_factor_pcts(full, RUN118_PARAMS, z_score=floor - 1e-9)[0] is None


# ---------------------------------------------------------------------------
# BUG-S13 / BUG-S14 — low severity
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason="BUG-S13: factor_percentile_score only filters None, so a NaN is "
    "ranked as a real value",
    strict=True,
)
def test_nan_factor_values_are_treated_as_missing():
    """A NaN must be unscoreable, not handed a middling percentile.

    Real failure: the worker does float(raw) on FMP payloads, so a NaN survives
    as a float. factor_percentile_score gives it 50.0 — a 'C+'-ish reading — and
    it then satisfies the coverage floor, so the ticker is scored and can be
    bought on data that does not exist.
    """
    out = factor_percentile_score([float("nan"), 1.0, 2.0], higher_is_better=True)
    assert out[0] is None


@pytest.mark.xfail(
    reason="BUG-S14: the DOUBLE_BUY path reuses the module-level `limit_rule` "
    "built with attempted=0 instead of building its own",
    strict=True,
)
def test_double_buy_audit_row_reports_a_real_attempt_count():
    """The audit trail must not claim zero buys were attempted on a buy signal."""
    positions = {"C": position("C", shares=10, avg_cost=50, price=100,
                               initial_investment=500)}
    portfolio = PortfolioState(cash=1_000_000, positions=positions, as_of=TODAY)
    signals = evaluate(portfolio, {"C": score("C", 4.6)}, ["C"], RUN118_PARAMS)
    add = next(s for s in signals if s.action == Action.DOUBLE_BUY)
    rule = next(r for r in add.rules if r.rule_id == "max_adds_per_evaluation")
    assert rule.inputs["attempted"] == 1


# ---------------------------------------------------------------------------
# Exit-rule boundaries (all currently correct — pinned)
# ---------------------------------------------------------------------------


def test_strong_sell_boundary_is_strict():
    """QR 1.5 is not a strong sell; 1.49 is. The threshold is exclusive.

    Prevents a one-tick rating wobble at exactly 1.5 flipping between the
    strong_sell and hold_removal rules, which read differently to a subscriber
    and (unlike hold_removal) bypass min_holding_days.
    """
    at = solo(position("A"), 1.5)
    below = solo(position("A"), 1.49)
    assert "strong_sell" not in rule_ids(at)
    assert "hold_removal" in rule_ids(at)
    assert "strong_sell" in rule_ids(below)


def test_hold_removal_boundary_is_strict():
    """QR exactly 2.5 is a hold — no exit. 2.49 exits."""
    assert solo(position("A"), 2.5) == []
    assert "hold_removal" in rule_ids(solo(position("A"), 2.49))


def test_hold_removal_threshold_agrees_with_the_published_signal_label():
    """quant_to_signal and hold_removal_rating must not drift apart.

    If the label says 'hold' while the engine sells, the dashboard contradicts
    the trade it just published.
    """
    assert quant_to_signal(2.5) == "hold" and solo(position("A"), 2.5) == []
    assert quant_to_signal(2.49) == "sell" and solo(position("A"), 2.49) != []
    assert quant_to_signal(1.5) == "sell"
    assert quant_to_signal(1.49) == "strong_sell"


def test_underwater_stop_day_boundary():
    """270 days held does not exit; 271 does. `days_held > max_underwater_days`."""
    at = solo(position("U", avg_cost=50, price=40, days_held=270), 2.8)
    past = solo(position("U", avg_cost=50, price=40, days_held=271), 2.8)
    assert "underwater_stop" not in rule_ids(at)
    assert "underwater_stop" in rule_ids(past)


def test_underwater_stop_rating_boundary():
    """QR exactly 3.0 keeps a long-underwater name; 2.99 exits it."""
    at = solo(position("U", avg_cost=50, price=40, days_held=400), 3.0)
    below = solo(position("U", avg_cost=50, price=40, days_held=400), 2.99)
    assert at == []
    assert "underwater_stop" in rule_ids(below)


def test_underwater_stop_requires_being_underwater_on_the_evaluation_date():
    """At exactly break-even the stop does not fire — price < avg_cost is strict.

    Documents that a position which spent four years underwater but closes the
    evaluation day at its cost basis is not exited by this rule.
    """
    assert solo(position("U", avg_cost=50, price=50, days_held=1_600), 2.8) == []


def test_winner_threshold_boundary():
    """+60.0% exactly is a winner (partial sell); +59.8% is a full exit."""
    win = solo(position("W", shares=100, avg_cost=50, price=80,
                        initial_investment=5_000), 2.0)
    lose = solo(position("W", shares=100, avg_cost=50, price=79.9,
                         initial_investment=5_000), 2.0)
    assert [s.action for s in win] == [Action.PARTIAL_SELL]
    assert [s.action for s in lose] == [Action.FULL_SELL]


def test_house_money_is_never_partial_sold_again():
    """A house-money holding below hold is fully exited, not re-harvested.

    initial_investment <= 0 is the house-money sentinel; re-running the Winners
    Circle on it would divide by a zero stake and sell nothing.
    """
    signals = solo(position("HM", shares=100, avg_cost=10, price=50,
                            initial_investment=0), 2.0)
    assert [s.action for s in signals] == [Action.FULL_SELL]


def test_a_holding_that_trips_several_exit_rules_is_sold_exactly_once():
    """One exit signal per holding, however many rules it satisfies.

    A name 80% underwater for 900 days with a rating of 1.2 trips the
    underwater stop, strong_sell AND hold_removal at once. Emitting three
    FULL_SELLs for one position would sell shares it does not have and write
    three trades for one exit.

    Which rule *wins* is deliberately not asserted. The engine reports
    `underwater_stop` here because that branch is evaluated first, and nothing
    in the strategy defines a severity ordering between the exit rules — an
    earlier revision of this test assumed strong_sell outranked it and failed
    against behaviour that is not wrong, merely unspecified. If a precedence is
    ever intended, define it in signals.py and assert it here.
    """
    signals = solo(position("D", avg_cost=50, price=10, days_held=900), 1.2)
    assert len(signals) == 1
    assert signals[0].action == Action.FULL_SELL
    # Some exit rule owns the signal; exactly one does.
    assert rule_ids(signals) & {"strong_sell", "underwater_stop", "hold_removal"}


def test_min_holding_days_boundary_is_inclusive_of_the_minimum():
    """days_held == min_holding_days exits; one day earlier is suppressed."""
    params = RUN118_PARAMS.with_overrides(min_holding_days=180, enable_daily_sell_pass=True)

    def actions(days: int):
        pos = position("S", avg_cost=10, price=10.08, days_held=days,
                       initial_investment=1_000)
        pf = PortfolioState(cash=1_000_000, positions={"S": pos}, as_of=TODAY)
        return [s.action for s in evaluate_sells_only(pf, {"S": score("S", 1.66)},
                                                      params, as_of=TODAY)]

    assert actions(180) == [Action.FULL_SELL]
    assert actions(179) == [Action.HOLD]


def test_min_holding_days_is_skipped_when_entry_date_is_unknown():
    """CHARACTERISES: a NULL entry_date disables the turnover control silently.

    `if params.min_holding_days and pos.entry_date` — a position with no entry
    date is exited immediately regardless of the configured minimum, with no
    rule row recording that the guard was bypassed.
    """
    params = RUN118_PARAMS.with_overrides(min_holding_days=180, enable_daily_sell_pass=True)
    pos = PositionState(ticker="S", shares=100, avg_cost=10, current_price=10.08,
                        entry_date=None, initial_investment=1_000)
    pf = PortfolioState(cash=1_000_000, positions={"S": pos}, as_of=TODAY)
    assert [s.action for s in evaluate_sells_only(pf, {"S": score("S", 1.66)}, params,
                                                  as_of=TODAY)] == [Action.FULL_SELL]


def test_an_unscoreable_holding_can_never_be_exited():
    """CHARACTERISES the known fail-silent in _removal_signals.

    DARK is down 98%, held six years, and has no score. `if not score: continue`
    means no rule — strong sell, underwater stop, hold removal — can ever reach
    it. The only exit left is the weight cap, and only while it is overweight.
    """
    pos = position("DARK", shares=100, avg_cost=50, price=1, days_held=2_400)
    portfolio = PortfolioState(cash=1_000_000, positions={"DARK": pos}, as_of=TODAY)
    assert evaluate(portfolio, {}, [], RUN118_PARAMS) == []


# ---------------------------------------------------------------------------
# Weight trim boundaries
# ---------------------------------------------------------------------------


def test_weight_cap_boundary_is_strict_and_trims_to_target():
    """Exactly 15% is not trimmed; above it, the trim lands the name on 12%."""
    at = PositionState(ticker="A", shares=15, avg_cost=100, current_price=100,
                       initial_investment=1_500)
    pf_at = PortfolioState(cash=8_500, positions={"A": at}, as_of=TODAY)
    assert _weight_trim_signals(pf_at, RUN118_PARAMS) == []

    over = PositionState(ticker="A", shares=20, avg_cost=100, current_price=100,
                         initial_investment=2_000)
    pf_over = PortfolioState(cash=8_000, positions={"A": over}, as_of=TODAY)
    trims = _weight_trim_signals(pf_over, RUN118_PARAMS)
    assert len(trims) == 1
    remaining = (over.shares - trims[0].sell_shares) * over.current_price
    assert remaining / pf_over.equity == pytest.approx(0.12)


def test_weight_trim_never_orders_more_shares_than_held():
    """Even a book that is one 100%-weight position cannot be over-trimmed."""
    pos = PositionState(ticker="A", shares=100, avg_cost=1, current_price=10,
                        initial_investment=100)
    pf = PortfolioState(cash=0, positions={"A": pos}, as_of=TODAY)
    trims = _weight_trim_signals(pf, RUN118_PARAMS)
    assert trims and trims[0].sell_shares < pos.shares


def test_house_money_position_cap_of_one_makes_the_house_trim_target_dead():
    """CHARACTERISES: position_trim_house_money can never be reached.

    The cap is 1.00 and weight cannot exceed 1.0 without negative cash, so the
    `weight > cap` test is unsatisfiable and position_trim_house_money=0.15 is
    unreachable configuration. Intentional per Run 118 ("Uncapped"), pinned so a
    later cap change is a deliberate one.
    """
    pos = PositionState(ticker="HM", shares=100, avg_cost=10, current_price=50,
                        initial_investment=0)
    pf = PortfolioState(cash=0, positions={"HM": pos}, as_of=TODAY)
    assert pf.equity == pytest.approx(pos.market_value)
    assert _weight_trim_signals(pf, RUN118_PARAMS) == []


def test_zero_and_negative_equity_do_not_divide_by_zero():
    """A fully written-down book must not raise; removals must still work."""
    pos = position("D", shares=10, avg_cost=50, price=0, initial_investment=500)
    pf = PortfolioState(cash=0, positions={"D": pos}, as_of=TODAY)
    assert _weight_trim_signals(pf, RUN118_PARAMS) == []
    assert [s.action for s in evaluate(pf, {"D": score("D", 1.0)}, [], RUN118_PARAMS)] == [
        Action.FULL_SELL
    ]


def test_a_zero_priced_position_is_never_trimmed():
    """`current_price > 0` guards the trim_shares division.

    Only Z is asserted on. O is deliberately over the weight cap (1 share at
    $10 in an $11 book is 91% against a 15% cap) and SHOULD be trimmed — an
    earlier revision asserted no position was trimmed at all and failed on O,
    which was the engine behaving correctly. The bug this guards is a division
    by a zero price, which belongs to Z alone.
    """
    pos = PositionState(ticker="Z", shares=100, avg_cost=10, current_price=0,
                        initial_investment=1_000)
    other = PositionState(ticker="O", shares=1, avg_cost=10, current_price=10,
                          initial_investment=10)
    pf = PortfolioState(cash=1, positions={"Z": pos, "O": other}, as_of=TODAY)
    trimmed = [t.ticker for t in _weight_trim_signals(pf, RUN118_PARAMS)]
    assert "Z" not in trimmed


# ---------------------------------------------------------------------------
# Buy criteria boundaries
# ---------------------------------------------------------------------------


def test_min_quant_rating_boundary():
    """QR exactly 4.0 buys; 3.99 does not."""
    assert meets_buy_criteria(score("X", 4.0), RUN118_PARAMS)[0] is True
    assert meets_buy_criteria(score("X", 3.99), RUN118_PARAMS)[0] is False


@pytest.mark.parametrize(
    "field,at_minimum,one_notch_below",
    [
        ("revisions_grade", "B+", "B"),
        ("growth_grade", "B", "B-"),
        ("profitability_grade", "D", "D-"),
        ("valuation_grade", "C-", "D+"),
    ],
)
def test_each_grade_gate_is_inclusive_of_its_minimum(field, at_minimum, one_notch_below):
    """Each buy gate admits its exact minimum and rejects the next notch down.

    A `>` instead of `>=` here would quietly drop every borderline candidate,
    which for revisions (min B+) is a large share of the qualifying universe.
    """
    assert meets_buy_criteria(score("X", 4.5, **{field: at_minimum}), RUN118_PARAMS)[0] is True
    assert meets_buy_criteria(score("X", 4.5, **{field: one_notch_below}), RUN118_PARAMS)[0] is False


def test_momentum_grade_is_deliberately_not_a_buy_gate():
    """CHARACTERISES: momentum carries 0.15 of the composite but gates nothing.

    An F in momentum is buyable as long as the composite clears QR 4.0. Pinned
    so adding a momentum gate is a conscious model change.
    """
    assert meets_buy_criteria(score("X", 4.5, momentum_grade="F"), RUN118_PARAMS)[0] is True


def test_every_failing_criterion_is_reported_not_just_the_first():
    """The audit rows must explain all failures, or the UI shows a partial reason."""
    ok, checks = meets_buy_criteria(
        score("X", 1.0, revisions_grade="F", growth_grade="F"), RUN118_PARAMS
    )
    assert ok is False
    failed = {c.rule_id for c in checks if not c.passed}
    assert failed == {"min_quant_rating", "min_revisions_grade", "min_growth_grade"}


# ---------------------------------------------------------------------------
# evaluate() contract: purity, determinism, ordering
# ---------------------------------------------------------------------------


def test_evaluate_does_not_mutate_caller_state():
    """The engine is documented as pure; callers reuse these objects.

    A stray positions[...] = or cash mutation here would corrupt the live book
    before apply_signals ever runs.
    """
    positions = {"A": position("A", shares=100, avg_cost=50, price=100)}
    portfolio = PortfolioState(cash=100_000, positions=positions, as_of=TODAY)
    scores = {"A": score("A", 4.6), "B": score("B", 4.8, sector="Energy")}
    ranked = ["B"]

    snapshot = (dict(portfolio.positions), portfolio.cash, list(ranked), dict(scores))
    evaluate(portfolio, scores, ranked, RUN118_PARAMS)

    assert dict(portfolio.positions) == snapshot[0]
    assert portfolio.cash == snapshot[1]
    assert ranked == snapshot[2]
    assert dict(scores) == snapshot[3]
    assert portfolio.positions["A"].shares == 100


def test_evaluate_is_deterministic_across_repeated_calls():
    """Same inputs, same signals — the reproducibility guarantee for backtests."""
    positions = {f"P{i}": position(f"P{i}", sector=f"S{i}") for i in range(5)}
    portfolio = PortfolioState(cash=20_000, positions=positions, as_of=TODAY)
    scores = {t: score(t, 4.2, sector=positions[t].sector) for t in positions}
    scores["NEW"] = score("NEW", 4.8, sector="Energy")

    first = [s.to_dict() for s in evaluate(portfolio, scores, ["NEW"], RUN118_PARAMS)]
    second = [s.to_dict() for s in evaluate(portfolio, scores, ["NEW"], RUN118_PARAMS)]
    assert first == second


def test_exactly_one_buy_even_when_many_candidates_qualify():
    """max_adds_per_evaluation=1 and the loop must respect ranked order."""
    portfolio = PortfolioState(cash=1_000_000, positions={}, as_of=TODAY)
    scores = {f"T{i}": score(f"T{i}", 4.5, sector=f"S{i}") for i in range(10)}
    ranked = [f"T{i}" for i in range(10)]
    buys = [s for s in evaluate(portfolio, scores, ranked, RUN118_PARAMS)
            if s.action in (Action.BUY, Action.DOUBLE_BUY)]
    assert [s.ticker for s in buys] == ["T0"]


def test_ranked_order_decides_which_name_is_bought():
    """Ranking, not dict order, must pick the single daily buy."""
    portfolio = PortfolioState(cash=1_000_000, positions={}, as_of=TODAY)
    scores = {"AAA": score("AAA", 4.5, sector="S1"), "ZZZ": score("ZZZ", 4.5, sector="S2")}
    assert [s.ticker for s in evaluate(portfolio, scores, ["ZZZ", "AAA"], RUN118_PARAMS)
            if s.action == Action.BUY] == ["ZZZ"]


def test_tickers_absent_from_scores_are_skipped_not_bought():
    """A ranked ticker with no score must never produce a signal."""
    portfolio = PortfolioState(cash=1_000_000, positions={}, as_of=TODAY)
    scores = {"REAL": score("REAL", 4.5)}
    assert [s.ticker for s in evaluate(portfolio, scores, ["GHOST", "REAL"], RUN118_PARAMS)
            if s.action == Action.BUY] == ["REAL"]


def test_evaluate_falls_back_to_portfolio_as_of_for_day_counting():
    """as_of=None must use the portfolio date, not today, or backtests drift.

    Real failure: an underwater position dated 300 days before the portfolio's
    as_of would be measured against the wall clock instead.
    """
    pos = position("U", avg_cost=50, price=40, days_held=300)
    portfolio = PortfolioState(cash=1_000_000, positions={"U": pos}, as_of=TODAY)
    assert "underwater_stop" in rule_ids(evaluate(portfolio, {"U": score("U", 2.8)}, []))


def test_daily_sell_pass_is_off_by_default_and_emits_no_buys_when_on():
    """The daily pass is sell-side only — it must never open a position."""
    assert RUN118_PARAMS.enable_daily_sell_pass is False
    params = RUN118_PARAMS.with_overrides(enable_daily_sell_pass=True)
    portfolio = PortfolioState(cash=1_000_000, positions={}, as_of=TODAY)
    assert evaluate_sells_only(portfolio, {"NEW": score("NEW", 4.9)}, params) == []


def test_qr_velocity_is_off_by_default_and_strict_at_its_threshold():
    """A drop of exactly 1.0 does not fire; 1.1 does. Off in Run 118."""
    assert RUN118_PARAMS.enable_qr_velocity is False
    params = RUN118_PARAMS.with_overrides(enable_qr_velocity=True)

    def actions(prior: float, qr: float):
        pos = position("V", shares=10, avg_cost=50, price=60, initial_investment=500)
        pf = PortfolioState(cash=1_000_000, positions={"V": pos}, as_of=TODAY)
        snap = ScoreSnapshot(ticker="V", quant_rating=qr, prior_quant_rating=prior,
                             valuation_grade="B", growth_grade="B", profitability_grade="B",
                             momentum_grade="B", revisions_grade="B+", sector="Technology")
        return rule_ids(evaluate(pf, {"V": snap}, [], params))

    assert "qr_velocity" not in actions(5.0, 4.0)
    assert "qr_velocity" in actions(5.0, 3.9)
    # A null prior rating must not be read as zero and dump the position.
    assert "qr_velocity" not in actions(None, 1.9)


# ---------------------------------------------------------------------------
# Sizing / parameter units
# ---------------------------------------------------------------------------


def test_cash_reserve_is_denominated_in_buys_not_dollars_or_percent():
    """cash_reserve_buys=2 must mean 2 x target_notional held back.

    Reading it as dollars ($2) or a fraction (2%) would change the buy gate by
    orders of magnitude. Pins the unit at its single consumer.
    """
    equity = 100_000.0
    params = RUN118_PARAMS
    target = params.target_notional(equity)
    assert target == pytest.approx(3_500.0)

    # Cash just under target + 2*target: the engine must look for a recycle.
    positions = {"WEAK": position("WEAK", shares=1_000, avg_cost=50, price=50,
                                  initial_investment=50_000, sector="Tech")}
    for i in range(8):
        positions[f"H{i}"] = position(f"H{i}", sector=f"S{i}")
    portfolio = PortfolioState(cash=10_000, positions=positions, as_of=TODAY)
    scores = {t: score(t, 4.2, sector=positions[t].sector) for t in positions}
    scores["WEAK"] = score("WEAK", 3.0, sector="Tech")
    scores["NEW"] = score("NEW", 4.8, sector="Energy")
    p = params.with_overrides(position_cap_normal=1.0)

    recycles = [s for s in evaluate(portfolio, scores, ["NEW"], p)
                if s.action == Action.RECYCLE_TRIM]
    shortfall = p.target_notional(portfolio.equity) * (1 + p.cash_reserve_buys) - portfolio.cash
    assert recycles[0].sell_shares * 50 == pytest.approx(shortfall * 1.1)


def test_sector_concentration_is_a_count_of_names_not_a_share_of_capital():
    """CHARACTERISES the unit of sector_concentration inside the engine.

    0.30 means int(max_positions * 0.30) = 15 *names*, checked against a count
    of held tickers. It is not a 30% weight limit: 15 equal-weight names in one
    sector is 30% of the book only if the book is full. This value is published
    in PUBLIC_FIELDS, so its unit is part of the risk contract.
    """
    positions, scores = {}, {}
    # Two tech names carrying 90% of the capital: no cap fires, because the cap
    # counts names.
    positions["MEGA"] = position("MEGA", shares=900, avg_cost=100, price=100,
                                 initial_investment=90_000, sector="Technology")
    positions["BIG"] = position("BIG", shares=100, avg_cost=100, price=100,
                                initial_investment=10_000, sector="Technology")
    scores["MEGA"] = score("MEGA", 4.2)
    scores["BIG"] = score("BIG", 4.2)
    scores["NEWT"] = score("NEWT", 4.8, sector="Technology")
    portfolio = PortfolioState(cash=1_000_000, positions=positions, as_of=TODAY)
    params = RUN118_PARAMS.with_overrides(position_cap_normal=1.0)

    assert [s.ticker for s in evaluate(portfolio, scores, ["NEWT"], params)
            if s.action == Action.BUY] == ["NEWT"]


def test_fixed_dollar_sizing_ignores_equity_growth():
    """position_size_usd must win over position_size_pct at every equity level."""
    fixed = RUN118_PARAMS.with_overrides(position_size_usd=1_000.0)
    assert fixed.target_notional(10_000.0) == 1_000.0
    assert fixed.target_notional(10_000_000.0) == 1_000.0
    assert RUN118_PARAMS.target_notional(10_000.0) == pytest.approx(350.0)


def test_buy_signal_carries_the_notional_it_was_sized_against():
    """apply_signals reads metadata['target_notional'] to size the fill."""
    portfolio = PortfolioState(cash=1_000_000, positions={}, as_of=TODAY)
    buy = next(s for s in evaluate(portfolio, {"N": score("N", 4.8)}, ["N"], RUN118_PARAMS)
               if s.action == Action.BUY)
    assert buy.metadata["target_notional"] == pytest.approx(portfolio.equity * 0.035)


# ---------------------------------------------------------------------------
# Scoring / grading numerics
# ---------------------------------------------------------------------------


def test_full_coverage_ratio_is_exactly_one_despite_float_addition():
    """total_w / all_w must not fall a float epsilon below min_factor_coverage.

    min_factor_coverage=1.0 is compared with `<`, so a ratio of 0.9999999999 on
    a fully-covered ticker would refuse to score the entire universe. Holds
    because both sums accumulate in the same order — pinned because it is
    fragile, not because it is obvious.
    """
    full = {k: 60.0 for k in
            ("valuation", "growth", "profitability", "momentum", "revisions")}
    assert composite_from_factor_pcts(full, RUN118_PARAMS)[0] is not None

    awkward = RUN118_PARAMS.with_overrides(
        weight_valuation=0.1, weight_growth=0.1, weight_profitability=0.1,
        weight_momentum=0.1, weight_revisions=0.6,
    )
    assert composite_from_factor_pcts(full, awkward)[0] is not None


def test_composite_uses_the_declared_weights_not_a_flat_average():
    """Weight drift is invisible in a flat-percentile fixture — vary one factor."""
    base = {k: 50.0 for k in
            ("valuation", "growth", "profitability", "momentum", "revisions")}
    bumped = dict(base, growth=100.0)
    composite, _ = composite_from_factor_pcts(bumped, RUN118_PARAMS)
    assert composite == pytest.approx(50.0 + 50.0 * RUN118_PARAMS.weight_growth)


def test_momentum_penalty_can_drive_a_rating_to_the_floor_not_below():
    """quant_rating_from_composite clamps a negative composite to 1.0.

    Without the clamp a penalised low scorer would produce a sub-1.0 rating that
    no threshold in the engine expects.
    """
    weak = {k: 5.0 for k in
            ("valuation", "growth", "profitability", "momentum", "revisions")}
    composite, _ = composite_from_factor_pcts(weak, RUN118_PARAMS, momentum_12m=-0.5)
    assert composite < 0
    assert quant_rating_from_composite(composite) == 1.0
    assert quant_rating_from_composite(1_000.0) == 5.0


def test_percentile_to_grade_bucket_boundaries():
    """Each threshold is inclusive; below the lowest bucket is F, not a crash."""
    assert percentile_to_grade(95.0) == "A+"
    assert percentile_to_grade(94.999) == "A"
    assert percentile_to_grade(65.0) == "B+"
    assert percentile_to_grade(64.999) == "B"
    assert percentile_to_grade(2.0) == "D-"
    assert percentile_to_grade(1.999) == "F"
    assert percentile_to_grade(0.0) == "F"
    assert percentile_to_grade(-5.0) == "F"


def test_grade_thresholds_and_buy_minimums_are_mutually_reachable():
    """Every buy minimum must be a grade percentile_to_grade can actually emit.

    A minimum that no percentile maps to would make the gate unsatisfiable.
    """
    emitted = {percentile_to_grade(p) for p in range(0, 101)}
    c = RUN118_PARAMS.buy_criteria
    for minimum in (c.min_revisions_grade, c.min_growth_grade,
                    c.min_profitability_grade, c.min_valuation_grade):
        assert minimum in emitted, minimum


def test_percentile_scoring_is_order_independent_for_the_same_multiset():
    """Shuffling the input list must not change any ticker's percentile."""
    values = [3.0, 1.0, 3.0, 7.0, 5.0]
    forward = factor_percentile_score(values, higher_is_better=True)
    reverse = factor_percentile_score(list(reversed(values)), higher_is_better=True)
    assert forward == list(reversed(reverse))


def test_single_value_universe_gets_a_neutral_percentile():
    """n == 1 must not divide by (n-1) == 0."""
    assert factor_percentile_score([4.0], higher_is_better=True) == [50.0]
    assert factor_percentile_score([None], higher_is_better=True) == [None]
    assert factor_percentile_score([], higher_is_better=True) == []


def test_all_values_tied_collapses_to_the_midpoint():
    """A sector where every name reports 0.0 must not be dealt a fake ranking."""
    out = factor_percentile_score([0.0] * 6, higher_is_better=True)
    assert out == [50.0] * 6


# ---------------------------------------------------------------------------
# Cadence
# ---------------------------------------------------------------------------


def test_only_the_first_and_third_fridays_of_a_month_evaluate():
    """Day bands 1-7 and 15-21 must select exactly the 1st and 3rd Fridays.

    These must agree with the scheduler's CronTrigger day="1-7,15-21"; a drift
    here publishes a 'next picks' date the worker never runs on.
    """
    fridays = [d for d in evaluation_fridays_between(date(2026, 1, 1), date(2026, 1, 31))]
    all_jan_fridays = [date(2026, 1, d) for d in range(1, 32)
                       if date(2026, 1, d).weekday() == 4]
    assert fridays == [all_jan_fridays[0], all_jan_fridays[2]]
    assert len(all_jan_fridays) >= 4
    assert not is_evaluation_friday(all_jan_fridays[1])
    assert not is_evaluation_friday(all_jan_fridays[3])


def test_non_fridays_are_never_evaluation_days():
    for offset in range(14):
        d = date(2026, 3, 1) + timedelta(days=offset)
        if d.weekday() != 4:
            assert is_evaluation_friday(d) is False


def test_next_evaluation_friday_is_inclusive_of_today():
    """'Next picks' must say today when today is an evaluation day."""
    d = next_evaluation_friday(date(2026, 1, 1))
    assert is_evaluation_friday(d)
    assert next_evaluation_friday(d) == d


def test_next_evaluation_friday_crosses_the_year_boundary():
    """The December -> January rollover is the case month arithmetic gets wrong."""
    d = next_evaluation_friday(date(2026, 12, 22))
    assert d.year == 2027 and is_evaluation_friday(d)


def test_next_evaluation_friday_always_terminates_within_its_bound():
    """The 40-day scan must cover the worst real gap between evaluation days."""
    cursor = date(2026, 1, 1)
    while cursor < date(2029, 1, 1):
        nxt = next_evaluation_friday(cursor)
        assert (nxt - cursor).days <= 40
        cursor += timedelta(days=1)


def test_evaluation_fridays_between_is_inclusive_and_empty_when_reversed():
    start, end = date(2026, 1, 2), date(2026, 1, 16)
    out = evaluation_fridays_between(start, end)
    assert out[0] == start and out[-1] == end
    assert evaluation_fridays_between(end, start) == []
