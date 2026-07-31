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

**Severity: high** for the sizing consequence above.

**CORRECTION (2026-07-27).** An earlier revision of this entry also claimed S1
writes two trade rows for one exit and inflates trade counts. **That was
wrong.** `apply_signals` sorts `FULL_SELL` ahead of `TRIM`
(`apps/api/app/services/portfolio.py:372-383`), executes the full sell first,
and `pop`s the position — so the TRIM finds nothing and writes no trade.
Exactly one trade row is written, with the correct share count. Nothing derived
from trade counts or realized notionals is affected.

What survives is only the planner-side `sim_cash` over-count described above,
which happens in `packages/strategy` before execution and is unaffected by the
executor's ordering.

The ledger *is* wrong here, but for a different reason — see **BUG-A5**: the
suppressed TRIM is still recorded as `executed: true`.

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

---

# PART 3 — API and published-number audit

Added 2026-07-27. Full per-field table of every published figure is in the
audit agent's report; the defects follow. **VERIFIED** = re-checked by hand.

## BUG-A1 — an admin position edit fabricates a return
`apps/api/app/routes/ops.py:290-332` — **CRITICAL**

`PATCH /api/ops/positions/{ticker}` rewrites shares/avg_cost and settles cash
but writes **no `Trade` row**. `picks_return`'s denominator is built from trade
notionals while its numerator is live market value, so the two diverge
permanently.

Reproduced by the audit: post AAA 10sh @ $100 (deployed $1,000, return 0.00%),
then correct the count to 20 — cash pays the extra $1,000, nothing is earned —
and the published picks return becomes **+100.00%**. The CAGR annualizes it.

## BUG-A2 — closed-pick P&L uses the last buy, not average cost
`apps/api/app/routes/public_v1.py:281-291` — **HIGH — VERIFIED**

The exit is compared against `ORDER BY timestamp DESC LIMIT 1` of prior buys.
Every earlier lot is discarded. Confirmed by reading.

Buy 100 @ $10, add 100 @ $30 (avg $20), sell 200 @ $25. Truth **+25%**.
Published: **−16.67%** — a winner reported as a loser.

Not an edge case: `allow_double_buy` is True in Run 118 and `DOUBLE_BUY` is an
explicit engine action, so multi-lot positions are routine.

**This is also the input to `closedWinRate()`** (`apps/web/src/lib/portfolio.ts`),
the WIN RATE tile added in `013bf09`. That tile inherits the defect: a real
winner is counted as a loss. Fixing the tile is not the fix — the API field is.

## BUG-A3 — the picks chart's final point drops every closed pick
`apps/api/app/services/benchmarks.py:249-255` — **HIGH**

The block anchoring the final point to the live book divides **open** market
value by capital deployed into **all** picks, closed included. Realized
proceeds leave the numerator while their capital stays in the denominator. The
per-session loop above it is correct; only the anchor is wrong.

Reproduced: one open pick ($1,000→$1,100), one closed ($1,000→$1,200).
Headline `picks_return_pct` **+15.0**; anchored final chart point **−45.0**. A
+15% headline sitting directly above a chart ending at −45%.

## BUG-A8 — evaluations are not idempotent
`apps/api/app/services/portfolio.py:512-547`, `apps/api/app/routes/ops.py:441-445`
— **HIGH**

Nothing records that an executed evaluation already ran for a cycle. Sells and
trims converge on re-run; **buys do not** — the second run buys the next-ranked
candidate. Reproduced: two runs the same day put two positions on the book with
`max_adds_per_evaluation = 1`.

`max_adds_per_evaluation` is in `PUBLIC_FIELDS` — a published claim about how
fast the book deploys capital. Triggers: a double-click on
`POST /api/ops/evaluate?dry_run=false` (no guard), a scheduler retry, or a
redeploy replaying `job_biweekly_evaluate`.

## BUG-A4 / A4b — unknown and total-loss P&L both publish as 0.00%
`apps/api/app/routes/public_v1.py:109-112` — **HIGH**

`_pnl_pct(...) or 0`. An unrecoverable `avg_cost` yields `None` → published as
a confident **0.00%** — the very state `_recover_avg_cost_from_trades` logs as
"its P&L will read as unavailable". Separately, `if not entry or not current`
rejects a **$0 mark**, so a delisted holding worth nothing publishes 0.00%
instead of −100%.

## BUG-A6 — `/performance` annualizes a different number than it publishes
`apps/api/app/routes/public_v1.py:358-362, 413-425` — **MEDIUM-HIGH**

`summary.total_return_pct` is the equity return; `summary.annualized_return_pct`
is derived from `picks_return`. Both sit in one object with nothing naming the
base. Reproduced: `total_return_pct: -6.5` beside `annualized_return_pct: 109.59`.

## BUG-A5 — the decision ledger marks skipped signals as executed
`apps/api/app/services/portfolio.py:330-341` — **MEDIUM**

`persist_evaluation` stamps `executed = (not dry_run)` **before**
`apply_signals` runs, and nothing corrects it afterwards. Every skip path lies:
the TRIM suppressed behind a FULL_SELL, a BUY with no mark, a cash-clamped
fill. The ledger is the artifact that makes a published track record checkable.

## BUG-A9 — `picks_return` counts recycled dollars twice
`apps/api/app/services/portfolio.py:170-207` — **MEDIUM**

`deployed` is gross buy notional across all time, so a dollar recycled into a
second pick is counted again; the published return is damped toward zero as the
book turns over. $1,000 → sold $1,200 → recycled into a pick now worth $1,300
is **+30%** to the investor and publishes as **+13.64%**. Symmetric on losses.
Whether gross or money-weighted is correct is a design call — pinned by a
characterization test, not an xfail.

## BUG-A7 / A10 — lower severity
- `base = snaps[0].total_value or 1` invents a $1 base from a $0 first
  snapshot, publishing `return_pct: 9999900.0` (`public_v1.py:381`).
- `closed_count` is distinct tickers, not closed positions — a re-bought name
  reports 0 (`portfolio.py:186-188`).

## Audited and CLEAN
Cash conservation and no-overdraw; partial-sell/house-money accounting
(including the `_position_to_state` basis boundary — the prior defect there is
genuinely fixed); transaction boundary (a crash mid-evaluation leaves no torn
state); dry-run writes nothing; **paywall and model leakage — `public_dict()`
everywhere public, no factor weights exposed**; CAGR denominator; benchmark
series construction.

---

# PART 4 — worker / data pipeline audit

Added 2026-07-27.

## BUG-W3 — a NULL sector drops a ticker with no trace (FIXED)
`apps/worker/worker/services/scoring.py:175` — **HIGH — VERIFIED**

```python
if s.ticker in funds and s.sector:
```

The same NULL-truthiness class as the `market_cap` bug, one gate later, and
worse: the skip happens **before `considered` is incremented and before
`missing_factor` is touched**, so the ticker appears in no count and no log
line anywhere.

**This means the market_cap fix in `294252e` was incomplete.** `refresh_marks`
creates `Stock(ticker=..., name=..., is_active=True, is_etf=False)` with no
sector, so a hand-seeded holding cleared the market-cap SQL filter and was then
dropped here — still unscored, still unrated, and still ineligible for every
exit rule because `_removal_signals` skips holdings with no score.

`refresh_fundamentals` resolves sector from the `profile` endpoint, but only on
the weekly Saturday refresh. Fixed by resolving sector in `refresh_marks` for
**held** tickers (scoped: candidates arrive from `refresh_universe` with a
sector, and SPY legitimately has none), with a loud warning when it cannot be
resolved.

## BUG-W1 — `refresh_marks` quotes an arbitrary, frozen set of 100 tickers
`apps/worker/worker/services/ingest.py:507-512` — **HIGH**

Candidates are selected `ORDER BY composite_scores.id DESC LIMIT 100`.
`score_universe` UPDATEs rows in place and only INSERTs for new tickers, so
**ids are frozen at first sight**: the 100 selected are whichever tickers
happened to be inserted last on the first-ever scoring run, permanently. There
is no `as_of` filter, so one ticker can occupy several slots.

A top-rated pick inserted early never gets a fresh quote — its mark and its
daily bar stop updating, feeding a stale price into momentum and into the price
shown beside the pick.

## BUG-W2 — momentum accepts an arbitrarily stale latest bar (HALF FIXED)
`apps/worker/worker/services/scoring.py:104-127` — **HIGH**

`_momentum_12m` imposes no recency requirement on the newest bar. Only held
positions, the (arbitrary, per W1) 100, and SPY get daily bars;
`backfill_price_history` is unscheduled. So most of the universe has a newest
bar frozen at the backfill date while the `as_of − 365d` anchor keeps moving.

A stock whose last bar is three months old at 200, against 100 a year before,
reports **+100% momentum** and tops its sector — while actually trading at 80.

**Supply side fixed.** `backfill_price_history` now runs Saturday 14:00 ET, and
its skip condition is short (`< min_bars`) **OR** stale (newest bar older than
`max_stale_days`, default 5) rather than bar count alone. Bar count alone was
what made this self-reinforcing: a series with a full year of frozen history
looked permanently well covered. Stale tickers are re-fetched from
`overlap_days` before their newest bar, so the weekly run is a top-up rather
than a full-universe re-download.

**Consumer side still open.** `_momentum_12m` itself still has no recency
guard, so the fabricated +100% above is still what scoring would compute if the
top-up ever fails to run (a wedged worker, an FMP outage, a ticker FMP has no
history for). The supply fix makes that unlikely, not impossible, and nothing
downstream would say so. Worth a `max_bar_age` check that returns None — but
that changes which tickers are scoreable at all under
`min_factor_coverage = 1.0`, so it belongs with the momentum port, not here.

## BUG-W4 — a two-ticker sector manufactures a perfect rating
`apps/worker/worker/services/scoring.py:213-220` — **HIGH**

No minimum sector population before percentile ranking (the old system required
≥15 names). With n=2 the better name scores 100th percentile on all five
factors → composite 100 → **quant_rating 5.0 with A+ across the board**,
clearing `min_quant_rating 4.0` and every grade floor at once, on no
information. n=1 is safe (50.0 → QR 3.0, below the buy gate), which makes n=2
the cliff. `min_factor_coverage = 1.0` shrinks covered sectors, making this
reachable.

## BUG-W6 — the $5 share-price floor never fires on a missing price
`apps/worker/worker/services/ingest.py:109-111` — **MEDIUM**

`price = row.get("price") or 0` then `if price and price < min_share_price`. A
missing or zero screener price is falsy, so the floor is skipped and the ticker
is admitted. `refresh_universe` is the only code path that reads
`min_share_price`, and nothing re-applies it, so admission is permanent.

## BUG-W7 / W8 — price-field handling
- `row.get("adjClose", row.get("close"))` uses the default only when the key is
  **absent**, not when it is present-and-null. FMP sends explicit nulls, so a
  usable close in the same row is discarded (`ingest.py:473`). A hole at the
  12-month anchor makes the ticker unscoreable.
- Two writers of `price_bars` disagree on field priority — `ingest` prefers
  `adjClose`, `backfill._parse_series` prefers `close`, and `upsert_price_bar`
  overwrites on conflict. Across a split this fabricates a 3x discontinuity
  that momentum reads as −67% or +200%.
- **Open question worth resolving against live FMP JSON:** `backfill.py:272-276`
  documents `/stable/historical-price-eod/full` as returning no `adjClose` at
  all. If that comment is right, ingest's preferred field is always absent and
  **all momentum runs on unadjusted prices**, so every recent split fabricates a
  large negative 12-month return.

## FMP field-name audit
Of ~33 fields read from FMP, **15 have no alias tuple** — notably
`priceToBookRatioTTM`, `priceToSalesRatioTTM`, the three profitability margins,
and `returnOnEquityTTM`/`returnOnAssetsTTM`/`returnOnCapitalEmployedTTM` (v3
called these `roeTTM`/`roaTTM`/`roicTTM`). A rename in any of them nulls the
factor.

`refresh_fundamentals` merges `{**key_metrics_ttm, **ratios_ttm}`, so the code
never records which endpoint supplied which metric and **`ratios-ttm` silently
wins any collision**.

The one live mitigation is `min_factor_coverage = 1.0`: a fully-nulled factor
makes tickers unscoreable and loudly logged rather than silently re-weighting
the model. **Lowering that floor would make the next FMP rename invisible.**

## Audited and CLEAN
Timezone handling (ET scheduler vs UTC `date.today()` — no boundary bug);
`existing_today` deletion is guarded against a total outage; screener partial
failure cannot shrink the universe (`is_active` is never set False); re-run
idempotency; the 45-day fundamentals cutoff; TTM growth math; `FMPClient` error
handling (401/402/403 raise rather than reading as "no data", 429 backs off,
api key is not logged); `market_calendar` including Easter and observed-holiday
shifts; estimate-revision fiscal-period pinning.

---

# PART 5 — parity against the LIVE old model

Added 2026-07-27. Oracle is `~/workspace/jdpicks` **live** code
(`services/scoring_engine.py`, `stock_selector.py`), not `services/backtest/`.
This matters: PART 2 compared against the backtest engine, but the current book
was picked by the live engine, and the two are not identical.

`jd.db` locally is empty (1 row, `theses`) — live data is on the production DB.
So parity here is a **differential test of the two implementations**, not a
data replay.

## What already matches — the configuration is not the problem

The live thesis row confirms the old system ran:
- factor weights `val 0.05 / gro 0.35 / pro 0.15 / mom 0.15 / rev 0.30`
- buy criteria `QR 4.0, rev B+, gro B, pro D, val C-`
- signal thresholds `4.5 / 3.5 / 2.5 / 1.5`, `max_positions 50`,
  `hold_removal 2.5`, biweekly

**All identical to `RUN118_PARAMS`.** Every divergence below is in how factor
*inputs* are computed, not how they are weighted.

## DIVERGENCE-1 — momentum is a different quantity (15% of the model)

Old live (`scoring_engine.py:203-239`): four windows, recency-weighted —
1m×0.15, 3m×0.25, 6m×0.30, 12m×0.30 — each percentile-ranked within sector,
plus a momentum-acceleration term.

New (`worker/services/scoring.py:218-220`): **12-month return only.**

Larger than PART 2 reported. That comparison was against the backtest engine
(6m+12m averaged); the *live* engine that picked the book uses four windows
weighted toward recent momentum. A name with strong 1m/3m and weak 12m scored
well in the old system and scores badly in the new one.

## DIVERGENCE-2 — the Z-score bankruptcy filter ran live and is dead here

`scoring_engine.py:291` implements `_compute_z_score`. The new system's
`z_score_floor = 1.8` is never reached because the only caller omits the
argument (BUG-P3). **The filter that excluded distressed names from the book
you own is not running.**

## DIVERGENCE-3 — percentile formula, quantified

Old: `rank = count(v <= value)`, `pct = rank/n × 100` — best 100, worst 100/n,
ties take the top of the run.
New: tie-midpoint over 0–100 — best 100, worst 0, ties take the midpoint.

Measured on an evenly-ranked 20-name sector, applying each scheme to all five
factors and running the real `composite_from_factor_pcts`:

| rank | old pct | new pct | old QR | new QR | ΔQR |
|---|---|---|---|---|---|
| 1 | 100.0 | 100.0 | 5.00 | 5.00 | +0.00 |
| 5 | 80.0 | 78.9 | 4.20 | 4.16 | −0.04 |
| 10 | 55.0 | 52.6 | 3.20 | 3.11 | −0.09 |
| 15 | 30.0 | 26.3 | 2.20 | 2.05 | −0.15 |
| 20 | 5.0 | 0.0 | 1.20 | 1.00 | −0.20 |

**The new engine is systematically slightly more bearish**, identical at the
top and diverging as rank falls. Bounded at ~0.20 QR points.

Where that changes a decision:
- Buy gate `min_quant_rating 4.0` — only a narrow band (old QR ≈ 4.00–4.04)
  flips to ineligible.
- Sell gate `hold_removal_rating 2.5` — a name at old QR 2.50–2.65 lands
  **below** 2.5 in the new engine. **The new system exits names the old one
  held.**

Checked separately: at n=10 the grade ladder produced **no** flips of the
`min_revisions_grade = B+` gate. The formula change moves the lower half of the
distribution, which is not where the buy gate sits.

## Assessment

Ranked by how much each moves the picks:

1. **Revisions** (30% weight, gates every buy) — consensus *change* vs
   consensus *dispersion position*. A different quantity, not a different scale.
2. **Momentum** (15%) — one window vs four recency-weighted windows.
3. **Z-score filter** — ran live, dead here.
4. **Percentile formula** — real but bounded at ~0.2 QR, and directional
   (slightly more bearish).
5. **Missing filters** — country cap (20% per non-US country), minimum sector
   population (≥15).

1 and 2 are the ones that would make the new engine pick different stocks. 3
and 5 change which names are eligible at all. 4 only shifts timing at the
margin.

**Parity is achievable — but as porting work, not bug-fixing.** The defects in
PARTS 1–4 are real and worth fixing on their own merits; fixing all of them
would not make this engine reproduce the old one's picks, because the factor
inputs are computed differently by design decisions nobody flagged as
decisions.
