<!-- Source: re-derived working copy of datasets/dataset-cadence.sqlite (not the pinned d61437921c87). Command: python -m worker.backtest.factor_ic --rederive, then per report: live = --standard; hist = --standard --base weight_revisions=0; long = --base weight_revisions=0,weight_growth=0 with momentum/valuation variants. -->

# Factor IC tape

Fridays: 78 (2023-08-18 → 2026-09-18). Last price session: 2026-09-18.

IC is the Spearman correlation between a score and the forward return across every scored name on a Friday, averaged over Fridays. `t` is mean / (sd / √n). Horizons past 5 sessions overlap week to week, so their t overstates confidence. Under ~24 Fridays, read direction, not size.

Every variant runs on top of `{'weight_revisions': 0, 'weight_growth': 0}`.

## 5-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | +0.010 | +0.47 | 53% | +0.21% | +0.24% | +0.37% | 53 |
| momentum_12_1 | +0.010 | +0.45 | 50% | +0.25% | +0.48% | +0.37% | 52 |
| momentum_penalty_0 | +0.008 | +0.41 | 51% | +0.14% | +0.24% | +0.37% | 53 |
| momentum_12_1_penalty_0 | +0.007 | +0.35 | 48% | +0.13% | +0.48% | +0.37% | 52 |
| valuation_penalize_losses | +0.010 | +0.47 | 53% | +0.21% | -0.12% | +1.90% | 53 |

## 10-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | +0.013 | +0.61 | 55% | +0.35% | -0.87% | -2.07% | 51 |
| momentum_12_1 | +0.009 | +0.44 | 50% | +0.24% | -2.31% | -2.07% | 50 |
| momentum_penalty_0 | +0.012 | +0.61 | 49% | +0.24% | -0.87% | -2.07% | 51 |
| momentum_12_1_penalty_0 | +0.006 | +0.30 | 50% | +0.11% | -2.31% | -2.07% | 50 |
| valuation_penalize_losses | +0.013 | +0.61 | 55% | +0.35% | -1.39% | +0.30% | 51 |

## 20-session forward returns

| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |
|---|---|---|---|---|---|---|---|
| run118 | +0.010 | +0.49 | 51% | +0.68% | -0.61% | -1.99% | 49 |
| momentum_12_1 | +0.007 | +0.37 | 54% | +0.64% | -3.33% | -1.99% | 48 |
| momentum_penalty_0 | +0.012 | +0.60 | 47% | +0.54% | -0.61% | -1.99% | 49 |
| momentum_12_1_penalty_0 | +0.004 | +0.24 | 58% | +0.35% | -3.33% | -1.99% | 48 |
| valuation_penalize_losses | +0.010 | +0.49 | 51% | +0.69% | -2.10% | +6.37% | 49 |

## Run 118 factor by factor

| Factor | Weight | Corr with composite | IC 5d (t) | IC 10d (t) | IC 20d (t) |
|---|---|---|---|---|---|
| valuation | 0.05 | -0.18 | +0.023 (+1.21) | +0.018 (+0.93) | +0.012 (+0.56) |
| growth | 0.35 | +0.31 | -0.013 (-0.60) | -0.014 (-0.63) | -0.004 (-0.18) |
| profitability | 0.15 | +0.38 | -0.018 (-1.57) | -0.021 (-1.52) | -0.026 (-2.26) |
| momentum | 0.15 | +0.82 | +0.018 (+0.73) | +0.025 (+0.96) | +0.031 (+1.28) |
| revisions | 0.30 | +0.27 | +0.026 (+0.69) | +0.001 (+0.02) | -0.057 (-1.66) |

## Top pick by Friday

| Friday | run118 | momentum_12_1 | momentum_penalty_0 | momentum_12_1_penalty_0 | valuation_penalize_losses |
|---|---|---|---|---|---|
| 2026-08-07 | WDC | WDC | WDC | WDC | WDC |
| 2026-08-14 | WDC | WDC | WDC | WDC | GOOG |
| 2026-08-21 | GOOG | GOOG | GOOG | GOOG | GOOG |
| 2026-08-28 | WDC | WDC | WDC | WDC | WDC |
| 2026-09-04 | WDC | WDC | WDC | WDC | WDC |
| 2026-09-11 | WDC | WDC | WDC | WDC | WDC |
| 2026-09-18 | INSW | INSW | INSW | INSW | INSW |
