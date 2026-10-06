# Factor IC tape

Fridays: 78 (2023-08-18 → 2026-09-18). Last price session: 2026-09-18.

IC is the Spearman correlation between a score and the forward return across every scored name on a Friday, averaged over Fridays. `t` is mean / (sd / √n). Horizons past 5 sessions overlap week to week, so their t overstates confidence. Under ~24 Fridays, read direction, not size.

## 5-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run119 (shipped) | -0.005 | -0.06 | 50% | +0.31% | +0.32% | +1.24% | 6 |
| run118 scoring | -0.009 | -0.10 | 50% | -0.16% | +0.25% | +1.24% | 6 |
| run119 + reweight | -0.005 | -0.07 | 50% | +0.14% | +1.28% | +1.59% | 6 |

## 10-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run119 (shipped) | -0.066 | -0.88 | 50% | -0.68% | -0.26% | -2.47% | 4 |
| run118 scoring | -0.074 | -0.72 | 50% | -1.33% | -0.38% | -2.47% | 4 |
| run119 + reweight | -0.058 | -0.60 | 50% | -0.37% | +0.94% | +4.44% | 4 |

## 20-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run119 (shipped) | -0.122 | -1.87 | 0% | -1.91% | -0.15% | -2.05% | 2 |
| run118 scoring | -0.127 | -1.87 | 0% | -3.22% | -0.33% | -2.05% | 2 |
| run119 + reweight | -0.114 | -2.39 | 0% | -0.86% | +3.15% | +5.07% | 2 |

## run119 factor by factor (same weights as Run 118)

| Factor | Weight | Corr with composite | IC 5d (t) | IC 10d (t) | IC 20d (t) |
|---|---|---|---|---|---|
| valuation | 0.05 | -0.07 | +0.005 (+0.13) | +0.052 (+1.76) | +0.072 (+2.60) |
| growth | 0.35 | +0.76 | +0.000 (+0.00) | -0.063 (-1.00) | -0.082 (-1.25) |
| profitability | 0.15 | +0.32 | -0.009 (-0.19) | -0.002 (-0.03) | +0.008 (+0.37) |
| momentum | 0.15 | +0.53 | -0.014 (-0.17) | -0.068 (-0.71) | -0.072 (-1.67) |
| revisions | 0.30 | +0.67 | +0.026 (+0.69) | +0.001 (+0.02) | -0.057 (-1.66) |

## Top pick by Friday

| Friday | run119 (shipped) | run118 scoring | run119 + reweight |
|---|---|---|---|
| 2026-08-07 | FIX | FIX | AMZN |
| 2026-08-14 | LLY | LLY | MPC |
| 2026-08-21 | LLY | LLY | MPC |
| 2026-08-28 | LLY | LLY | MPC |
| 2026-09-04 | LLY | LLY | MPC |
| 2026-09-11 | LLY | LLY | DELL |
| 2026-09-18 | SNDK | SNDK | DELL |
