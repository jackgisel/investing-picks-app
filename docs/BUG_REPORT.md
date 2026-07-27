# Backend audit — bug report

Opened 2026-07-27. Target: parity with the previous system of record (`jdpicks`)
by 2026-08-07.

Status key: **CONFIRMED** = read against source and verified by hand.
**LEAD** = flagged by an audit pass, not yet verified. Do not act on a LEAD
without confirming it first — one lead in this batch (S1) was initially graded
critical and turned out to be medium once the executor was read.

---

## CONFIRMED

### BUG-S6 — an unrecognised minimum grade disables a buy filter, failing OPEN
`packages/strategy/src/outpick_strategy/grades.py:51`

```python
return GRADE_ORDER.get(grade or "F", 0) >= GRADE_ORDER.get(min_grade, 0)
```

`GRADE_ORDER.get(min_grade, 0)` defaults an unrecognised minimum to `0`, which
is F's rank. Every grade then satisfies `>= 0`, so the criterion passes
everything.

The actual-grade side (`grade or "F"`) defaults to F and so fails *closed* —
that half is fine. The minimum side fails *open*, which is the dangerous
direction: the strategy buys names it was configured to reject.

**Reachable from data, not just code.** `params_from_portfolio`
(`apps/api/app/services/portfolio.py:52-54`) splices arbitrary `params_json`
from the database over the defaults. A lowercase `"b+"`, a stray space, or a
typo in one config row silently removes a quality gate. Nothing errors, and the
decision ledger still records the rule as having passed.

**Scenario:** set `min_revisions_grade: "b+"` (lowercase) in `params_json`. A
stock with revisions grade F now clears the revisions criterion. The ledger
shows `min_revisions_grade` passed.

**Severity: critical.** Silent, data-triggerable, fails open, affects what
subscribers are told to buy.

---

### BUG-S3 / BUG-S1 — the same shares are counted twice as available cash
`packages/strategy/src/outpick_strategy/signals.py:446-451` (S3),
`signals.py:582-585` (S1)

`evaluate()` runs `_weight_trim_signals` first and `_removal_signals` second,
and neither knows about the other. A position that is both over its weight cap
and flagged for exit gets a TRIM *and* a FULL_SELL in the same evaluation.

`_buy_signals` then simulates the cash those sells will free:

```python
for s in prior_signals:
    if s.action == Action.FULL_SELL and s.ticker in portfolio.positions:
        sim_cash += portfolio.positions[s.ticker].market_value
    elif s.sell_shares and s.ticker in portfolio.positions:
        sim_cash += s.sell_shares * portfolio.positions[s.ticker].current_price
```

Both signals for that ticker are iterated, so its shares are added twice —
once whole via `market_value`, once partially via the trim. The planner
believes it has more cash than the book will have.

**Where it lands.** The executor is defensive and cannot overdraw:
`apps/api/app/services/portfolio.py:449-451` clamps
`if notional > portfolio.cash: shares = portfolio.cash / price`. So cash never
goes negative. Instead the buy is **silently truncated to whatever cash
remains** — an arbitrarily-sized position, with nothing in the signal or the
ledger recording that it was not the intended size.

That matters because sizing is a strategy parameter: `position_size_usd`
funds every pick equally ($1,000 × 8 in the live book). A silently truncated
buy breaks the equal weighting the strategy is built on.

**Scenario:** position A is 18% of a 15%-capped book *and* its rating has
fallen below `hold_removal_rating`. A gets both a TRIM and a FULL_SELL.
`sim_cash` over-counts A by the trim amount. The planner authorises a
full-size buy of B; the executor funds only part of it. B enters at the wrong
weight and no record says so.

**Severity: high.** Also note S1 independently writes two trade rows for one
exit, inflating any published metric derived from trade counts.

---

### BUG-S8 — a doubled winner with NULL `initial_investment` is never trimmed
`packages/strategy/src/outpick_strategy/signals.py:248-256`

```python
if (is_winner and not pos.is_house_money
        and pos.initial_investment and pos.current_price > 0):
```

`initial_investment` is truthiness-tested. `is_house_money` is
`initial_investment is not None and <= 0` (`types.py:65`), so a **None** passes
the `not is_house_money` guard and is then rejected by the truthiness test.

Result: the Winners Circle partial sell — the rule that recovers the original
stake once a position has run — silently never fires for that position.

The executor backfills `initial_investment` on buys
(`portfolio.py:481-484`), so engine-opened positions are fine. Positions
inserted another way (the ops `create_position` route, hand-seeding) can carry
NULL. Same shape as the `market_cap` bug fixed in `294252e`: a hand-seeded row
missing a field, failing silently rather than loudly.

**Severity: high.** A core risk-management rule silently does not run, on
exactly the positions most likely to have been hand-entered.

---

### BUG-S9 — the drawdown circuit breaker leaves no trace
`packages/strategy/src/outpick_strategy/signals.py:591-604`

When buys are halted by the drawdown breaker, `evaluate()` appends a signal to
"Record that buys were blocked" carrying
`metadata={"skip_execution": True}` — and the final line strips exactly that:

```python
return [s for s in signals if not s.metadata.get("skip_execution")]
```

The placeholder is constructed and immediately discarded. It never reaches the
caller, the ledger, or the ops UI.

**Scenario:** the book draws down past the breaker. Buys stop. The evaluation
records zero buy signals, indistinguishable from "the strategy considered the
universe and chose nothing". Nobody can tell the breaker fired.

**Severity: high** for operability — this is precisely the state you most need
to be able to see, and it is invisible.

---

### BUG-S7 — a sector cap that floors to zero reads as "no cap"
`apps/web/src/components/dashboard/sector-model.ts:70`

Known and previously reported. `sectorPositionCap` returns `null` when
`floor(max_positions × sector_concentration)` is 0, and the UI renders that as
no cap. In the engine `count >= 0` is always true, so a zero cap is the
*strictest* possible state — no new position in any sector at all. The test
`"treats a cap that floors to zero as no cap at all"` pins the inverted
semantics.

Unreachable at Run 118's numbers (needs `sector_concentration < 1/max_positions`,
i.e. < 0.02 at 50 slots) but both operands are per-portfolio configurable via
`params_json`.

**Severity: low** (unreachable in current config), **but the test asserting the
wrong semantics should be corrected regardless.**

---

## LEADS — flagged, NOT yet verified

From an audit pass that terminated early. Verify before acting.

| ID | Claim |
|----|-------|
| S2 | `_buy_signals` excludes only tickers in `exiting` (FULL_SELL), not other exit actions |
| S4 | BUY path gates on `sim_cash >= 0.5 × target_notional`, permitting half-funded entries |
| S10 | `_plan_recycle_trims` sorts on `quant_rating` alone, so ties are non-deterministic |
| S11 | `_buy_signals` early-returns on `open_slots <= 0`, skipping work that should still run |
| S13 | `factor_percentile_score` filters `None` but not `NaN` |
| S14 | The DOUBLE_BUY path reuses the module-level `limit_rule` object |

S10 and S13 matter for reproducibility: non-deterministic ordering or a `NaN`
leaking into a percentile would make backtest results unrepeatable, which
undermines any parity claim.

---

## Not yet audited

- `apps/worker` data pipeline, including the FMP field-name audit
- `apps/api` money math and published figures
- Cross-component integration paths
- Web e2e
- **Parity against `jdpicks`, and verification that the published `BACKTEST`
  claims trace to a recorded run**
