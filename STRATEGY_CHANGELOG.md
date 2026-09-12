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
| Pin | superseded tape kept as `backtests/baselines/run118-tape-b052a791.json` (dataset `b052a791ebc8`) |

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

Filled after the full-window re-score and `compare` against
`backtests/baselines/run118-tape-b052a791.json`. Branch A = genuine pair on
Aug 7 / Aug 21 (spread revisions, non-null top pick). Branch B = Aug 7 drops
as unscored (`fridays_only_in_baseline`). Either way the tape must not keep a
B- ×245 Friday.

run119 (Val D) and run120 (QR 3.5) were judged on the self-paired tape; re-read
from their existing JSON on the new pin. Neither is re-proposed here. The
round-2 handoff (`momentum_penalty` 20 → 0) is the first strategy experiment
once this tape is honest. Return metrics stay gated at N ≥ 24.

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
