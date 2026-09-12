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

## run119

Loosen the valuation buy gate from C- (15th percentile of sector) to D
(5th percentile). Hypothesis: the valuation gate at C-, not the QR 4.0
floor, is the marginal decider of Run 118 picks, because a
growth+revisions model's sector leaders are structurally among the most
expensive names in their sector; moving the gate to D will widen the
gate-pass set on every non-empty Friday and change the top pick on at
least one Friday in the window, while per-Friday rank correlation stays
exactly 1.0.

Experiment card: [`/cursor/stores/bc-f1616977-269d-4932-bb39-f751d6f7b989/docs/run119-experiment.md`](/cursor/stores/bc-f1616977-269d-4932-bb39-f751d6f7b989/docs/run119-experiment.md).

| | |
|---|---|
| `version_label` | `run119` |
| Change | `BuyCriteria.min_valuation_grade`: `C-` → `D` |
| Unchanged | weights, penalty, Z floor, exits, sizing, cadence, `max_adds_per_evaluation=1`, `position_size_usd=1000` |
| Side | `evaluate()` only — same score tape as run118, no re-score |
| Canonical size | `$1,000` per pick, `max_adds_per_evaluation=1`, `$50k` starting cash |
| Sample | below the return and holdout gates; publish decision diagnostics only |
| PR | [#33](https://github.com/jackgisel/investing-picks-app/pull/33) |

### Decision-diff vs run118 (pinned window 2026-08-07 → 2026-09-04, 3 Fridays)

| | run119 | run118 |
|---|---|---|
| `params_version` | `d9aeff3d4146` | `28bf660fdbab` |
| Dataset | `b052a791ebc8` (unchanged) | `b052a791ebc8` |
| `n_scored` | 245 / 247 / 252 | identical |
| `n_gate_pass` | 0 / 0 / 18 | 0 / 0 / 18 |
| Top pick | none / none / LLY | none / none / LLY |
| `top_pick_fridays_differ` | 0 | — |
| `mean_gate_pass_jaccard` | 1.0 | — |
| `trades_by_action` | `{buy: 1}` | `{buy: 1}` |
| End holdings | `[LLY]` | `[LLY]` |
| Sensitivity (`next_close` + 10 bps) | same tickers | same tickers |

Null result on this pin: loosening C- → D did not admit anyone new and did not change the pick. Aug 7 / Aug 21 stay empty (`n_gate_pass=0`, top ranked MU); Sep 4 still buys LLY from the same 18-name gate-pass set. Rank correlation is 1.0 by construction (same score tape). Sample is below the return gate; no performance claim. The card's reject criterion 1 (null: `top_pick_fridays_differ = 0` and Jaccard ≥ 0.9) is met on this window.

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
