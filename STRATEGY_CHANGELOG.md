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

## run120

QR buy floor 4.0 → 3.5. One knob. Experiment card:
`docs/run120-experiment.md` (Project store). run119 (valuation C- → D) was
rejected on a null table ([#33](https://github.com/jackgisel/investing-picks-app/pull/33),
not merged); that label is dead.

**Hypothesis.** On the dataset tape the QR 4.0 floor, not any grade gate, is what
empties Aug 7 and Aug 21: sector-relative percentiles on a ~245-name, Z-filtered
universe compress the top of the ranking into the 3.6–4.0 band, so at 3.5 both
August Fridays admit at least one name that still clears all four grade gates
and the top pick changes on ≥ 1 Friday while Sep 4 stays LLY.

| | |
|---|---|
| `version_label` | `run120` |
| Knob | `BuyCriteria.min_quant_rating` 4.0 → 3.5 |
| Unchanged | weights, `momentum_penalty`, Z floor, exits, `weak_signal_threshold=4.0`, `max_adds_per_evaluation=1`, `position_size_usd=1000` |
| Side | `evaluate()` only; same score tape as run118; Spearman QR rank corr must be 1.0 |
| Window | same pin as run118 (`b052a791ebc8`, 2026-08-07 → 2026-09-04) |
| Sample | below the return and holdout gates; decision diagnostics only |

### Live-shadow watch

Do not move `weak_signal_threshold` in this version. A name bought at 3.6 is a
recycle-trim candidate the same day when cash is short. Invisible on the fresh
$50k book; watch it on two dry-run cycles with
`params_json = {"buy_criteria": {"min_quant_rating": 3.5}}` before treating the
default flip as live.

### Compare vs run118

From `python -m worker.backtest compare <run120 result> backtests/baselines/run118.json --summary`
(CI artifact of run `34710334263`). Pin 2026-08-07 → 2026-09-04, 3 Fridays,
`top400_live`, dataset `b052a791ebc8`.

**Headline: null on picks.** `top_pick_fridays_differ = 0`. Aug 7 / Aug 21 stay
empty. The QR floor was not what closed them: `top_ranked_qr` is 4.261 / 4.267
(≥ 4.0), with 3 names at QR ≥ 4.0 each day, and the top-25 fail `min_revisions_grade`
25/25. Sep 4 still buys LLY; gate-pass 18 → 31 (13 names in [3.5, 4.0), Jaccard
0.5806). Sensitivity (`next_close` + 10 bps) same tickers.

| | run118 | run120 | Reading |
|---|---|---|---|
| `n_scored` | 245 / 247 / 252 | 245 / 247 / 252 | same tape |
| Spearman QR rank corr | — | n/a vs uninstrumented baseline; 1.0 by construction (same dataset hash, evaluate()-side) | control |
| `top_ranked` | MU / MU / LLY | MU / MU / LLY | |
| `top_ranked_qr` | not recorded | **4.261 / 4.267 / 4.469** | hypothesis wanted 3.5 ≤ x < 4.0 on Aug; falsified |
| `n_qr_ge_4_0` | — | 3 / 3 / 19 | names already above the old floor |
| `n_qr_in_3_5_4_0` | — | 33 / 35 / 39 | band the knob opens |
| `n_gate_pass` | 0 / 0 / 18 | **0 / 0 / 31** | August still empty |
| `top_pick` | — / — / LLY | — / — / LLY | `top_pick_fridays_differ = 0` |
| `mean_gate_pass_jaccard` | — | 0.8602 | 1.0 / 1.0 / 0.5806 |
| `trades_by_action` | `{buy: 1}` | `{buy: 1}` | |
| `end_holdings` | `[LLY]` | `[LLY]` | |
| Top-25 fail (Aug 7 / 21) | — | `min_revisions_grade` 25/25 both days | the binding gate |
| Sensitivity | same tickers | same tickers | |

Reject criterion 1 of the card. Hand revisions (tie-mass / thin first pair) to
round 3. Do not promote. `weak_signal_threshold` coupling is moot if 3.5 does
not buy on this tape.

PR: [#34](https://github.com/jackgisel/investing-picks-app/pull/34).

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
