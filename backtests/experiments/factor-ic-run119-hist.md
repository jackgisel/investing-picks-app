# Factor IC tape

Fridays: 31 (2025-08-01 → 2026-09-18). Last price session: 2026-09-18.

IC is the Spearman correlation between a score and the forward return across every scored name on a Friday, averaged over Fridays. `t` is mean / (sd / √n). Horizons past 5 sessions overlap week to week, so their t overstates confidence. Under ~24 Fridays, read direction, not size.

Every variant runs on top of `{'weight_revisions': 0}`.

## 5-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run119 (shipped) | +0.000 | +0.00 | 62% | +0.06% | +0.81% | +0.01% | 8 |
| run118 scoring | +0.011 | +0.16 | 62% | +0.07% | +0.81% | +0.01% | 8 |
| run119 + reweight | +0.014 | +0.25 | 50% | -0.14% | +2.85% | +5.52% | 8 |

## 10-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run119 (shipped) | -0.079 | -1.61 | 33% | -1.45% | +0.56% | -2.69% | 6 |
| run118 scoring | -0.098 | -1.55 | 33% | -2.16% | +0.56% | -2.69% | 6 |
| run119 + reweight | -0.059 | -0.93 | 50% | -1.64% | +4.66% | +11.15% | 6 |

## 20-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run119 (shipped) | -0.039 | -0.73 | 25% | -1.03% | +1.80% | -2.11% | 4 |
| run118 scoring | -0.078 | -1.71 | 25% | -3.25% | +1.80% | -2.11% | 4 |
| run119 + reweight | -0.005 | -0.08 | 25% | -0.92% | +12.32% | +23.21% | 4 |

## run119 factor by factor (same weights as Run 118)

| Factor | Weight | Corr with composite | IC 5d (t) | IC 10d (t) | IC 20d (t) |
|---|---|---|---|---|---|
| valuation | 0.05 | -0.02 | +0.039 (+1.05) | +0.103 (+3.37) | +0.135 (+3.53) |
| growth | 0.35 | +0.90 | -0.009 (-0.21) | -0.073 (-1.40) | -0.013 (-0.17) |
| profitability | 0.15 | +0.44 | +0.001 (+0.03) | +0.033 (+0.57) | +0.026 (+0.59) |
| momentum | 0.15 | +0.48 | +0.011 (+0.18) | -0.112 (-1.64) | -0.121 (-3.79) |
| revisions | 0.30 | +0.21 | +0.026 (+0.69) | +0.001 (+0.02) | -0.057 (-1.66) |

## Top pick by Friday

| Friday | run119 (shipped) | run118 scoring | run119 + reweight |
|---|---|---|---|
| 2026-08-07 | GOOG | GOOG | MPC |
| 2026-08-14 | LLY | LLY | MPC |
| 2026-08-21 | LLY | LLY | MPC |
| 2026-08-28 | LLY | LLY | MPC |
| 2026-09-04 | LLY | LLY | MPC |
| 2026-09-11 | LLY | LLY | DELL |
| 2026-09-18 | INSW | INSW | INSW |
