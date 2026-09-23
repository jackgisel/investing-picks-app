<!-- Source: re-derived working copy of datasets/dataset-cadence.sqlite (not the pinned d61437921c87). Command: python -m worker.backtest.factor_ic --rederive, then per report: live = --standard; hist = --standard --base weight_revisions=0; long = --base weight_revisions=0,weight_growth=0 with momentum/valuation variants. -->

# Factor IC tape

Fridays: 78 (2023-08-18 → 2026-09-18). Last price session: 2026-09-18.

IC is the Spearman correlation between a score and the forward return across every scored name on a Friday, averaged over Fridays. `t` is mean / (sd / √n). Horizons past 5 sessions overlap week to week, so their t overstates confidence. Under ~24 Fridays, read direction, not size.

## 5-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | -0.009 | -0.10 | 50% | -0.16% | +0.25% | +1.24% | 6 |
| momentum_penalty_0 | -0.004 | -0.06 | 50% | +0.27% | +0.32% | +1.24% | 6 |
| momentum_12_1 | -0.002 | -0.02 | 50% | -0.09% | +0.31% | -2.14% | 6 |
| momentum_12_1_penalty_0 | +0.000 | +0.00 | 50% | +0.32% | +0.48% | -2.14% | 6 |
| momentum_blend_6m | -0.003 | -0.04 | 50% | -0.11% | +0.28% | -1.46% | 6 |
| revisions_price | -0.009 | -0.11 | 50% | -0.15% | +0.25% | +1.24% | 6 |
| revisions_min_14d | +0.097 | +0.84 | 67% | +1.30% | +0.39% | +1.03% | 3 |
| revisions_fy2 | -0.009 | -0.10 | 50% | -0.16% | +0.25% | +1.24% | 6 |
| valuation_penalize_losses | -0.009 | -0.10 | 50% | -0.14% | +0.25% | +1.24% | 6 |
| growth_drop_net_income | -0.007 | -0.08 | 50% | +0.03% | -0.07% | +1.24% | 6 |
| surprise_0_10 | -0.005 | -0.05 | 50% | -0.22% | +0.76% | +1.26% | 6 |

## 10-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | -0.074 | -0.72 | 50% | -1.33% | -0.38% | -2.47% | 4 |
| momentum_penalty_0 | -0.065 | -0.87 | 50% | -0.68% | -0.26% | -2.47% | 4 |
| momentum_12_1 | -0.072 | -0.68 | 50% | -1.37% | -0.61% | -5.87% | 4 |
| momentum_12_1_penalty_0 | -0.059 | -0.77 | 50% | -0.64% | -0.42% | -5.87% | 4 |
| momentum_blend_6m | -0.069 | -0.70 | 50% | -0.97% | -0.06% | -2.47% | 4 |
| revisions_price | -0.073 | -0.70 | 50% | -1.16% | -0.17% | -2.47% | 4 |
| revisions_min_14d | +0.090 | — | 100% | +2.49% | -0.21% | -0.66% | 1 |
| revisions_fy2 | -0.074 | -0.72 | 50% | -1.33% | -0.38% | -2.47% | 4 |
| valuation_penalize_losses | -0.075 | -0.73 | 50% | -1.33% | -0.38% | -2.47% | 4 |
| growth_drop_net_income | -0.070 | -0.69 | 50% | -1.08% | -0.90% | -2.47% | 4 |
| surprise_0_10 | -0.070 | -0.66 | 50% | -1.23% | +0.53% | -2.44% | 4 |

## 20-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | -0.127 | -1.87 | 0% | -3.22% | -0.33% | -2.05% | 2 |
| momentum_penalty_0 | -0.120 | -1.85 | 0% | -1.91% | -0.15% | -2.05% | 2 |
| momentum_12_1 | -0.108 | -1.93 | 0% | -2.58% | -0.61% | -4.69% | 2 |
| momentum_12_1_penalty_0 | -0.102 | -1.66 | 0% | -1.22% | -0.28% | -4.69% | 2 |
| momentum_blend_6m | -0.119 | -1.82 | 0% | -2.40% | -0.04% | -2.05% | 2 |
| revisions_price | -0.128 | -1.87 | 0% | -3.03% | +0.73% | -2.05% | 2 |
| revisions_min_14d | — | — | — | — | — | — | 0 |
| revisions_fy2 | -0.127 | -1.87 | 0% | -3.22% | -0.33% | -2.05% | 2 |
| valuation_penalize_losses | -0.128 | -1.86 | 0% | -3.22% | -0.33% | -2.05% | 2 |
| growth_drop_net_income | -0.121 | -1.84 | 0% | -2.49% | -1.41% | -2.05% | 2 |
| surprise_0_10 | -0.121 | -1.89 | 0% | -2.66% | +2.44% | -2.01% | 2 |

## Run 118 factor by factor

| Factor | Weight | Corr with composite | IC 5d (t) | IC 10d (t) | IC 20d (t) |
|---|---|---|---|---|---|
| valuation | 0.05 | -0.12 | +0.010 (+0.23) | +0.062 (+2.08) | +0.082 (+2.67) |
| growth | 0.35 | +0.60 | +0.000 (+0.00) | -0.063 (-1.00) | -0.082 (-1.25) |
| profitability | 0.15 | +0.20 | -0.009 (-0.19) | -0.002 (-0.03) | +0.008 (+0.37) |
| momentum | 0.15 | +0.72 | -0.014 (-0.17) | -0.068 (-0.71) | -0.072 (-1.67) |
| revisions | 0.30 | +0.61 | +0.026 (+0.69) | +0.001 (+0.02) | -0.057 (-1.66) |

## Top pick by Friday

| Friday | run118 | momentum_penalty_0 | momentum_12_1 | momentum_12_1_penalty_0 | momentum_blend_6m | revisions_price | revisions_min_14d | revisions_fy2 | valuation_penalize_losses | growth_drop_net_income | surprise_0_10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-07 | FIX | FIX | FIX | FIX | FIX | FIX | — | FIX | FIX | FIX | FIX |
| 2026-08-14 | LLY | LLY | RDDT | RDDT | LLY | LLY | — | LLY | LLY | LLY | LLY |
| 2026-08-21 | LLY | LLY | LLY | LLY | LLY | LLY | — | LLY | LLY | LLY | LLY |
| 2026-08-28 | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY |
| 2026-09-04 | LLY | LLY | LLY | LLY | ALAB | LLY | LLY | LLY | LLY | LLY | LLY |
| 2026-09-11 | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY | LLY |
| 2026-09-18 | SNDK | SNDK | TPR | TPR | SNDK | SNDK | DELL | INSW | SNDK | SNDK | SNDK |
