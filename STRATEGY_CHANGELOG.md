# Strategy changelog

One entry per `StrategyParams.version_label`. The live engine and the backtest
call the same `evaluate()` in `packages/strategy`. Do not re-express buy/sell
rules elsewhere.

## Version-bump rule

Any change to:

- `StrategyParams` defaults in `packages/strategy/src/outpick_strategy/params.py`
- `packages/strategy/src/outpick_strategy/signals.py`
- `packages/strategy/src/outpick_strategy/scoring.py`
- worker scoring that changes what `evaluate()` sees (`apps/worker/worker/services/scoring.py`)

**must** in the same PR:

1. Bump `version_label` (`run118` → `run119` → …). That changes `version_hash()`.
2. Regenerate `packages/strategy/tests/golden/<label>_evaluate.json` (`UPDATE_GOLDEN=1`).
3. Regenerate `backtests/baselines/<label>.json` from the pinned dataset (`UPDATE_BASELINE=1`).
4. Add a section below with the decision-diff vs the previous version and the PR link.

`max_adds_per_evaluation` stays **1**. Canonical sizing is `position_size_usd=1000`.
Do not reintroduce Alpaca execution.

### Promotion gates

| Gate | When | What it judges |
|---|---|---|
| Decision-diff | always | Top-pick Fridays, Jaccard of the buy-gate set, rule firings, trades by action, end holdings |
| Return metrics | `n_evaluations >= 24` | CAGR, Sharpe, Sortino, max DD, Calmar, turnover, hit rate, with bootstrap bands |
| In-sample / holdout | `n_evaluations >= 48` | Chronological half/half split; not meaningful on the current short window |

Until the holdout gate, promote with decision-diff plus two live shadow cycles
(`params_json` override, `dry_run`), then flip the default.

Robustness: `python -m worker.backtest compare RESULT BASELINE --sweep` perturbs
numeric thresholds ±10% (never `max_adds_per_evaluation` or `position_size_usd`).

## Research switches and live parity (strategy run118 unchanged)

**Not a strategy version.** `version_label` stays `run118` and
`RUN118_PARAMS.version_hash()` stays `3dae13a76007`: a research switch at its
neutral value (`RESEARCH_SWITCH_NEUTRAL` in `params.py`) is left out of the
hash, and every default is neutral. Turning one on changes the hash, and
promoting one is a version bump under the rule above.

### Live parity fixes (live inputs change; the tape does not)

| Fix | Why | Tape effect |
|---|---|---|
| Non-positive valuation multiples are missing, not cheap (`scoring.py` `NON_POSITIVE_IS_MISSING`) | FMP returns P/E −45 for a loss-maker and PEG < 0 for a shrinking one; ranked "lower is better" those were the cheapest names in the sector. 423 / 1,206 live rows in the Sep dataset carried one | None: `backtest_derive._valuation` never emits a non-positive multiple |
| Live `altmanZ` (`refresh_fundamentals` calls `backtest_derive.altman_z`) | `z_score_floor = 1.8` ran on the tape and silently passed every name live | None: PIT rows already carried `altmanZ` |

Both change what live `evaluate()` sees, in the direction of what the backtest
has always measured. Run an ops dry-run after deploy and diff the buy-gate set
against the previous Friday before the next live evaluation.

Refresh cost: two more FMP calls per refreshed ticker (`balance-sheet-statement`
limit 2, `earnings`), both endpoints already used on this plan.

### Data added (additive keys; nothing removed)

- `epsEstimatePrior` beside `epsRevisionPct`, and FY2 revisions
  (`epsRevisionPctFy2`, `revenueRevisionPctFy2`, `epsEstimatePriorFy2`,
  `epsEstimateAvgFy2`) live and in `derive_ticker`. FY2 pairs only from
  `consensus_snapshots`, so it fills in three weeks after daily snapshots.
  `DERIVE_VERSION` is unchanged: re-derive a copy to read the new keys on old
  Fridays (`factor_ic --rederive`).
- `earnings_history` is upserted for every refreshed name, not only holdings,
  and a scheduled row is updated in place when its print lands.

### Switches

| Switch | Neutral | Measured by |
|---|---|---|
| `momentum_skip_days` (12-1 momentum) | 0 | `factor_ic` |
| `momentum_blend_6m` | False | `factor_ic` |
| `revisions_eps_scaling` (`"price"`) | `"pct"` | `factor_ic` |
| `revision_min_lookback_days` | 0 | `factor_ic` |
| `revisions_fy2_blend` | False | `factor_ic` (needs FY2 snapshots) |
| `valuation_penalize_losses` | False | `factor_ic` |
| `growth_drop_net_income` | False | `factor_ic` |
| `weight_surprise` (SUE factor from `earnings_history`) | 0.0 | `factor_ic` |
| `rank_smoothing` | False | `compare --sweep` |
| `earnings_blackout_days` | 0 | `compare --sweep` |
| `max_pair_correlation` / `correlation_lookback_days` | None / 90 | `compare --sweep` |
| `sector_cap_basis` (`"held"`) | `"max_positions"` | `compare --sweep` |

`momentum_penalty` (the round-2 handoff) is an existing field and is included
in the `factor_ic` standard set at 0.

### Measurement

`python -m worker.backtest.factor_ic --dataset <copy> --standard` recomputes
scores per variant and reports, per forward horizon, the mean cross-sectional
rank IC of the composite and of each factor, the Q5−Q1 spread, the gate-pass
basket's excess return, and the top pick's. `--base weight_revisions=0` scores
Fridays before the consensus tape, so momentum, valuation, growth and
profitability can be judged on the full price and filing history.

`.github/workflows/factor-ic.yml` runs `--rederive --standard` on a copy of the
pinned dataset every Saturday and uploads the report (a report, not a gate).

### First read (2026-09-23)

Re-derived working copy of `dataset-cadence.sqlite`, not the pin. Reports in
`backtests/experiments/factor-ic-{live,hist,long}.md`. Mean 5-session rank IC:

| Window | Fridays | Composite IC (t) | Note |
|---|---|---|---|
| Shipped model, Aug–Sep 2026 | 6 | −0.009 (−0.10) | Only window with revisions |
| Revisions weighted out, Aug 2025 → | 30 | +0.011 (+0.35) | Growth needs 8 quarters of filings |
| Revisions and growth out, Aug 2024 → | 53 | +0.010 (+0.47) | Momentum needs 12 months of bars |

- The composite does not rank forward returns at any horizon or window.
- Valuation (weight 0.05) is the only factor with a steady positive IC over
  30 Fridays (t +2.4 / +2.8 / +3.7 at 5 / 10 / 20 sessions). Over 53 Fridays it
  fades to t ≈ +1, so treat it as a lead, not a finding.
- Growth (0.35) is flat. Profitability (0.15) is negative (t −2.3 at 20
  sessions over 53 Fridays; overlapping windows overstate that t).
- Momentum correlates +0.71 to +0.82 with the composite at 0.15 weight. Its IC
  is small and positive.
- No switch moves composite IC by more than ±0.01. None is ready to promote.
  `revisions_eps_scaling = "price"` ran on 6 Fridays and changed no top pick.
  `revisions_fy2_blend` is a no-op until daily snapshots hold FY2 pairs
  (snapshots start 2026-09-11).
- Book switches (`compare --sweep`, 3 evaluations): no top-pick change.

## run121 — tape v2 (strategy run118 unchanged)

Dataset revisions self-pair fix (BUG-P8). **Not a strategy version.**
`StrategyParams.version_label` stays `run118`; `params_version` must read
`28bf660fdbab` on both sides of the compare. `evaluate()`, buy-gate defaults,
`scoring.py`, `signals.py`, and worker `compute_scores` are untouched.

| | |
|---|---|
| What changed | `derive_ticker` anchors the revisions pair on the estimate vintage date, not the evaluation Friday, and `_prior_estimate_snapshot` ignores `source=pit` rows |
| Why | On Aug 7 / Aug 21 the tape paired a Saturday vintage with itself (`revisionLookbackDays = 6`, every `epsRevisionPct = 0.0`) so every scored name was Rev B- and the buy gate was unpassable |
| `deriveVersion` | 2 |
| Pin | `d61437921c87` (`derive_version` 2); superseded tape kept as `backtests/baselines/run118-tape-b052a791.json` (`b052a791ebc8`) |

### Mechanism

`current_estimate` returns `(estimate, vintage_as_of)` from the live
`fundamentals` row or the max `consensus_snapshots.as_of`, skipping pit rows.
`derive_ticker` calls `compute_estimate_revisions(..., vintage_as_of=vintage)`.
Priors are `< vintage`; the 5–21 day window is measured from the vintage.
Re-deriving a Friday is idempotent: the previous pass's pit row cannot become
the current estimate or a prior.

Nightly walk-forward re-derives any Friday whose pit rows carry an older or
missing `deriveVersion`, so a tape fix cannot leave Aug 7 / Aug 21 on v1
forever. `score_dataset` raises if a scored Friday's modal `revisions_grade`
share is ≥ 0.90 (unless `--allow-degenerate-revisions`).

### Audit / compare

Production `audit_segment_a` was not run here (`DATABASE_URL` unset). The
re-scored pin is **Branch A**: both Aug Fridays have genuine pairs (modal
revisions-grade share 0.29, `n_self_paired = 0`). Aug 7 / Aug 21 are not empty.

Compare vs `backtests/baselines/run118-tape-b052a791.json` (`params_version`
`28bf660fdbab` both sides; dataset `b052a791` → `d61437921c87`; tape `None` → `2`):

| | old tape | tape v2 |
|---|---|---|
| Fridays | Aug 7 / Aug 21 / Sep 4 | same 3 (`fridays_only_in_baseline` = []) |
| `revisions_grade` mode share | B- ×245 / B- ×246 / spread | C+ 0.29 / C+ 0.29 / C 0.15 |
| `revision_lookback_days` | 6 / 6 / 27 (self-pair) | 5–7 / 7–21 / 21; `n_self_paired = 0` |
| `n_scored` | 245 / 247 / 252 | 239 / 239 / 249 |
| `n_gate_pass` | 0 / 0 / 18 | **14 / 16 / 18** |
| `max_qr` | 4.261 / 4.267 / 4.469 | 4.548 / 4.554 / 4.465 |
| `top_pick` | — / — / LLY | **FIX / GOOG / LLY** |
| `top_pick_fridays_differ` | — | **2** |
| `trades_by_action` | `{buy: 1}` | `{buy: 3}` |
| `end_holdings` | `[LLY]` | `[FIX, GOOG, LLY]` |
| Sensitivity (`next_close` + 10 bps) | same tickers | same tickers (`trade_diff` false) |

Aug 21 buys GOOG because FIX (still top-ranked) was bought Aug 7 and is not up
≥ 30% — `signals.py` moves to the next passer. Sep 4 still buys LLY; the
18-name gate-pass set is the same names as the old tape. GEV is in the Aug 7
gate-pass set (live's Aug 7 add). Return metrics stay gated at N ≥ 24.

run119 (Val D) and run120 (QR 3.5) were judged on the self-paired tape; re-read
from their existing JSON on the new pin. Neither is re-proposed here. The
round-2 handoff (`momentum_penalty` 20 → 0) is the first strategy experiment
once this tape is honest.

## run118

Shipped engine as of 2026-09. Measures what actually runs, not the old marketing
+250% / 39% CAGR figures (BUG-P1/P2 — remove those numbers; do not replace them
until `n_evaluations >= 24`).

| | |
|---|---|
| `version_label` | `run118` |
| Canonical size | `$1,000` per pick, `max_adds_per_evaluation=1`, `$50k` starting cash |
| Fill | same-close 0 bps (headline); next-close + 10 bps (sensitivity) |
| Window | first revisions-pair Friday 2026-08-07 → latest complete Friday in the pin |
| Sample | below the return and holdout gates; publish decision diagnostics only |

Engine hardening and harness: [#23](https://github.com/jackgisel/investing-picks-app/pull/23),
[#24](https://github.com/jackgisel/investing-picks-app/pull/24).
Consensus snapshots: [#25](https://github.com/jackgisel/investing-picks-app/pull/25).
Dataset ingest: [#26](https://github.com/jackgisel/investing-picks-app/pull/26).
PIT derive / score / Segment A parity: [#27](https://github.com/jackgisel/investing-picks-app/pull/27).
Backtest CLI and N≥24 gate: [#28](https://github.com/jackgisel/investing-picks-app/pull/28).
CI replay job: [#29](https://github.com/jackgisel/investing-picks-app/pull/29).

### Candidates to measure (not assumed)

These are experiments, not shipped defaults. Report decision-diff first.

| Candidate | How | Status |
|---|---|---|
| Z-score floor 1.8 | Already in params; live was dead code (no inputs). Dataset now has `altmanZ`. Measuring “Z on” is the shipped engine on Fridays that have the inputs | measure via replay, do not fork `evaluate()` |
| 4-window momentum (BUG-P7) | Would change `scoring.py` — bump to a new version first | not implemented |
| `min_holding_days` 30 / 60 | param override | `--sweep` experiment list |
| Drawdown breaker on | `enable_drawdown_circuit_breaker=true` | `--sweep` experiment list |
| `hold_removal_rating` 2.5 vs 2.7 | param override | `--sweep` experiment list |
| Sector cap 30% vs 20% | `sector_concentration` 0.30 vs 0.20 | `--sweep` experiment list |
