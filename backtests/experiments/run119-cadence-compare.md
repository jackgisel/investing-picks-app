# run119 vs run118 on the local cadence dataset

Replay of `evaluate()` on `datasets/dataset-cadence.sqlite` (7 weekly Fridays, 2026-08-07 → 2026-09-18; 4 evaluation Fridays). `$1,000` per pick, `$50k` starting cash, same-close 0 bps. Every row except the first was scored on a freshly re-derived copy of the tape, so the strategy is the only thing that differs between them. The first row is the committed `composite_scores` as the dataset shipped, which a nightly re-derive has since moved; it is here so the GOOG-on-Aug-21 pick in the old baseline is not mistaken for a strategy effect.

Return metrics are gated (`n_evaluations` = 4 < 24). Decision diagnostics only.

## Buys by evaluation Friday

| Variant | Params | 2026-08-07 | 2026-08-21 | 2026-09-04 | 2026-09-18 | End holdings |
|---|---|---|---|---|---|---|
| run118 (stale tape, as committed) | `28bf660fdbab` | FIX | GOOG (top FIX) | LLY | SNDK | FIX, GOOG, LLY, SNDK |
| run118 (re-derived tape) | `5c5833591c3c` | FIX | LLY | ALAB (top LLY) | SNDK | ALAB, FIX, LLY, SNDK |
| run119 book rules, run118 scoring | `c015bd1494ab` | FIX | LLY | ALAB (top LLY) | TPR (top SNDK) | ALAB, FIX, LLY, TPR |
| run119 (shipped) | `1986857f3d15` | FIX | LLY | ALAB (top LLY) | TPR (top SNDK) | ALAB, FIX, LLY, TPR |
| run119 + reweight | `c4b531a805a3` | AMZN | MPC | COHR (top MPC) | INSW (top DELL) | AMZN, COHR, INSW, MPC |

`(top X)` marks a Friday where the top-ranked name was not the one bought.

## Gate-pass set size by Friday

| Variant | 2026-08-07 | 2026-08-21 | 2026-09-04 | 2026-09-18 |
|---|---|---|---|---|
| run118 (stale tape, as committed) | 14 | 16 | 18 | 42 |
| run118 (re-derived tape) | 14 | 19 | 18 | 43 |
| run119 book rules, run118 scoring | 14 | 19 | 18 | 43 |
| run119 (shipped) | 15 | 20 | 19 | 44 |
| run119 + reweight | 12 | 11 | 12 | 29 |

## Reading

- **Scoring changes changed no pick.** `momentum_penalty` 20 → 0 and `valuation_penalize_losses` on move a handful of names across the gates (gate-pass set 14 → 15 on Aug 7, 18 → 19 on Sep 4) and do not touch the top of the ranking on any Friday. "run119 book rules, run118 scoring" and "run119 (shipped)" buy the same four names.
- **The held-basis sector cap is the only rule that changed a trade.** On Sep 18 the book holds four names, so the cap is `int(5 × 0.30)` = 1 per sector. ALAB (Technology) is held, so SNDK (Technology, top ranked at 4.549) is skipped and TPR (Consumer Cyclical, 4.41) is bought. On the Run 118 basis (15 of 50 slots) SNDK would have been bought. On the live eight-name book the cap is 2 per sector.
- **No stop fired.** Nothing in the window was down 40% or unrated for 21 days, so `max_loss_stop` and `unrated_exit` are exercised by the golden fixture only.
- **No buy needed funding.** Four `$1,000` buys against `$50k`; `funded` is 0.0 on every trade. The funding path is exercised by `apps/api/tests/test_funded_book.py`.
- **The reweight is a different model.** `weight_valuation` 0.25 / `weight_growth` 0.30 / `weight_profitability` 0 buys a different name on every Friday (AMZN, MPC, COHR, INSW) and passes fewer names through the gates. It is not shipped; see the factor IC reports beside this file.
