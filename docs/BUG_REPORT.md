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

---

# PART 2 — Parity audit vs. the previous system of record

Added 2026-07-27. Claims below marked **VERIFIED** were checked by hand against
`~/workspace/jdpicks` (read-only) by the reviewing engineer, not taken from the
audit that surfaced them.

## BUG-P1 — the published performance claims trace to no recorded run
`apps/web/src/lib/constants.ts:27-54` — **CRITICAL — VERIFIED**

The site publishes, as Run 118: +250.39% total return, +38.99% CAGR, Sharpe
1.14, max drawdown -27.38%, over Jun 15 2022 – Apr 06 2026.

Run 118's only surviving record says otherwise:

> `jdpicks/CLAUDE.md`: "Validated via 7-year walk-forward backtesting (Apr 2019
> - Apr 2026). +323% total return, 22.8% CAGR, 0.69 Sharpe. Validation period
> (Jul 2024+): 1.36 Sharpe, +94.5% alpha over SPY. Backtest Run ID 118."

`BACKTEST_HISTORY.md` contains exactly seven runs — 6 through 12. There is no
Run 118 in it, and no recorded run anywhere returning more than +155.3%. The
`backtest_runs` / `backtest_snapshots` tables are absent from `jd.db`.

**Every headline figure differs from the record**: CAGR 38.99% vs 22.8%,
Sharpe 1.14 vs 0.69, max drawdown -27.38% vs -41%, period Jun 2022 vs Apr 2019.

## BUG-P2 — the numbers describe a configuration that was replaced
**CRITICAL — VERIFIED**

Two commits in `jdpicks`, both dated 2026-04-06:

- `6f2b68c` "feat: deploy optimized AP strategy — **250% backtest return (39%
  CAGR)**" — the published figures, verbatim.
- `37d889d` "feat: aggressive recycling (QR<4.0) + underwater stop — 323% 7yr
  backtest", body: "7yr results: **+323%, 22.8% CAGR, 0.69 Sharpe, -41% max
  DD**." This commit **is** Run 118.

`37d889d` lands *after* `6f2b68c` and changes the strategy (recycling threshold
3.0→4.0, underwater stop, winner threshold 1.0→0.60). `RUN118_PARAMS` in this
repo encodes `37d889d`.

So the marketing numbers describe the configuration that Run 118 **replaced**,
while the shipped strategy is the replacement. They are two different parameter
sets, and the site attributes one's numbers to the other.

## BUG-P3 — the Z-score bankruptcy filter is dead code
`apps/worker/worker/services/scoring.py:231` — **HIGH — VERIFIED**

`composite_from_factor_pcts` accepts `z_score` and rejects a ticker below
`z_score_floor = 1.8` (`packages/strategy/.../scoring.py:71`). The only
production caller never passes it, so `z_score` is always None and the branch
never fires. Distressed names the backtest excluded are now buyable.

Found independently by two separate audit passes.

## BUG-P4 — fundamentals are not bounded point-in-time (latent look-ahead)
`apps/worker/worker/services/scoring.py:161-167` — **HIGH (latent) — VERIFIED**

Prices are bounded on both sides:
`PriceBar.date <= as_of` and `>= window_start` (line 92).
Fundamentals have only a lower bound: `Fundamentals.as_of >= oldest_allowed`.

Live scoring is unaffected — `as_of` is always today. But the moment anyone
passes a historical `as_of` (i.e. builds the backtester this project needs),
prices will be honest and fundamentals clairvoyant. **This must be fixed before
any backtest result is trusted.**

## BUG-P7 — the scoring model is not a faithful port
**HIGH — agent-reported, spot-checked, not exhaustively re-verified**

Portfolio mechanics (sizing, trims, caps, exits, recycling, cadence, sector cap)
are a faithful port. The scoring model is not:

| Input | Old (Run 118) | New |
|---|---|---|
| Revisions (**30% weight**, gates every buy via `min_revisions_grade=B+`) | consensus-dispersion position within analyst high/low | period-over-period change in consensus |
| Momentum (15%) | average of 6m and 12m percentiles | 12m only |
| Percentile formula | inclusive rank, ties take top of run | tie-midpoint on 0–100 |
| Missing factors | renormalize over present factors | refuse to score (`min_factor_coverage=1.0`) |
| Country cap | 20% of positions per non-US country | **absent** |
| Min sector population | ≥15 names to rank | **absent** |

**Consequence: even on identical price data, the new engine picks different
stocks than Run 118 did.** Parity is not reachable by fixing defects alone.

## What this means for Aug 7

Parity with Run 118 cannot currently be demonstrated, for three independent
reasons:
1. Run 118's underlying record does not exist in any reachable location.
2. The new scoring model computes different inputs, so it is a different model.
3. There is no backtester, and BUG-P4 would invalidate one if written today.
