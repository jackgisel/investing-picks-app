<!-- Source: re-derived working copy of datasets/dataset-cadence.sqlite (not the pinned d61437921c87). Command: python -m worker.backtest.factor_ic --rederive, then per report: live = --standard; hist = --standard --base weight_revisions=0; long = --base weight_revisions=0,weight_growth=0 with momentum/valuation variants. -->

# Factor IC tape

Fridays: 78 (2023-08-18 → 2026-09-18). Last price session: 2026-09-18.

IC is the Spearman correlation between a score and the forward return across every scored name on a Friday, averaged over Fridays. `t` is mean / (sd / √n). Horizons past 5 sessions overlap week to week, so their t overstates confidence. Under ~24 Fridays, read direction, not size.

Every variant runs on top of `{'weight_revisions': 0}`.

## 5-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | +0.011 | +0.35 | 60% | +0.42% | +0.81% | +0.01% | 30 |
| momentum_penalty_0 | -0.001 | -0.05 | 57% | +0.21% | +0.81% | +0.01% | 30 |
| momentum_12_1 | +0.016 | +0.50 | 60% | +0.41% | +0.54% | +3.30% | 30 |
| momentum_12_1_penalty_0 | +0.002 | +0.09 | 57% | +0.16% | +0.53% | +3.30% | 30 |
| momentum_blend_6m | +0.013 | +0.43 | 60% | +0.49% | +0.95% | +1.94% | 30 |
| revisions_price | +0.011 | +0.35 | 60% | +0.42% | +0.40% | +0.01% | 30 |
| revisions_min_14d | +0.011 | +0.35 | 60% | +0.42% | +0.93% | +0.98% | 30 |
| revisions_fy2 | +0.011 | +0.35 | 60% | +0.42% | +0.81% | +0.01% | 30 |
| valuation_penalize_losses | +0.011 | +0.35 | 60% | +0.42% | +0.81% | +0.01% | 30 |
| growth_drop_net_income | +0.008 | +0.25 | 57% | +0.46% | +0.58% | +1.26% | 30 |
| surprise_0_10 | +0.013 | +0.42 | 57% | +0.44% | +1.47% | +1.71% | 30 |

## 10-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | -0.003 | -0.09 | 54% | +0.39% | +0.56% | -2.69% | 28 |
| momentum_penalty_0 | -0.007 | -0.29 | 46% | +0.47% | +0.56% | -2.69% | 28 |
| momentum_12_1 | -0.002 | -0.05 | 57% | +0.30% | +0.42% | -1.52% | 28 |
| momentum_12_1_penalty_0 | -0.007 | -0.29 | 46% | +0.37% | +0.32% | -1.52% | 28 |
| momentum_blend_6m | -0.000 | -0.01 | 54% | +0.35% | +0.86% | -2.43% | 28 |
| revisions_price | -0.003 | -0.09 | 54% | +0.39% | -0.04% | -2.69% | 28 |
| revisions_min_14d | -0.003 | -0.09 | 54% | +0.39% | +0.54% | -0.80% | 28 |
| revisions_fy2 | -0.003 | -0.09 | 54% | +0.39% | +0.56% | -2.69% | 28 |
| valuation_penalize_losses | -0.003 | -0.10 | 54% | +0.43% | +0.56% | -2.69% | 28 |
| growth_drop_net_income | -0.005 | -0.14 | 54% | +0.37% | +0.80% | -2.43% | 28 |
| surprise_0_10 | +0.003 | +0.08 | 50% | +0.60% | +1.86% | -0.05% | 28 |

## 20-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | -0.004 | -0.16 | 58% | +0.61% | +1.80% | -2.11% | 26 |
| momentum_penalty_0 | -0.000 | -0.01 | 54% | +1.00% | +1.80% | -2.11% | 26 |
| momentum_12_1 | +0.003 | +0.12 | 58% | +0.71% | +0.32% | -1.78% | 26 |
| momentum_12_1_penalty_0 | +0.001 | +0.07 | 54% | +0.86% | +0.32% | -1.78% | 26 |
| momentum_blend_6m | -0.001 | -0.05 | 58% | +0.68% | +1.41% | -2.03% | 26 |
| revisions_price | -0.004 | -0.16 | 58% | +0.61% | +1.80% | -2.11% | 26 |
| revisions_min_14d | -0.004 | -0.16 | 58% | +0.61% | — | — | 26 |
| revisions_fy2 | -0.004 | -0.16 | 58% | +0.61% | +1.80% | -2.11% | 26 |
| valuation_penalize_losses | -0.005 | -0.18 | 58% | +0.63% | +1.80% | -2.11% | 26 |
| growth_drop_net_income | -0.006 | -0.22 | 54% | +0.65% | +1.49% | -2.03% | 26 |
| surprise_0_10 | +0.003 | +0.11 | 58% | +1.14% | +4.15% | -2.07% | 26 |

## Run 118 factor by factor

| Factor | Weight | Corr with composite | IC 5d (t) | IC 10d (t) | IC 20d (t) |
|---|---|---|---|---|---|
| valuation | 0.05 | -0.18 | +0.054 (+2.36) | +0.063 (+2.84) | +0.084 (+3.74) |
| growth | 0.35 | +0.76 | -0.013 (-0.60) | -0.014 (-0.63) | -0.004 (-0.18) |
| profitability | 0.15 | +0.28 | -0.016 (-1.01) | -0.027 (-1.34) | -0.037 (-2.30) |
| momentum | 0.15 | +0.71 | +0.029 (+0.86) | +0.019 (+0.45) | +0.026 (+0.71) |
| revisions | 0.30 | +0.27 | +0.026 (+0.69) | +0.001 (+0.02) | -0.057 (-1.66) |

## Top pick by Friday

| Friday | run118 | momentum_penalty_0 | momentum_12_1 | momentum_12_1_penalty_0 | momentum_blend_6m | revisions_price | revisions_min_14d | revisions_fy2 | valuation_penalize_losses | growth_drop_net_income | surprise_0_10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-07 | GOOG | GOOG | RDDT | RDDT | FIX | GOOG | — | GOOG | GOOG | FIX | GOOG |
| 2026-08-14 | LLY | LLY | LLY | LLY | LLY | LLY | — | LLY | LLY | LLY | LLY |
| 2026-08-21 | LLY | LLY | GOOG | GOOG | LLY | LLY | — | LLY | LLY | LLY | GOOG |
| 2026-08-28 | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | GOOG |
| 2026-09-04 | LLY | LLY | LLY | LLY | GOOG | LLY | LLY | LLY | LLY | LLY | GOOG |
| 2026-09-11 | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | GOOG |
| 2026-09-18 | INSW | INSW | INSW | INSW | INSW | INSW | GOOG | INSW | INSW | INSW | INSW |
