# Weekly versus biweekly

This is a description of the stored tape, not a promotion result. Production reports still withhold CAGR, Sharpe, and alpha until 24 evaluations. Weekly here means every Friday, still one add. It also runs trims and removals on the extra dates, so exits can differ.

## Window

Start 2026-08-07, end 2026-09-18.
Window extended from the pinned end 2026-09-04 to 2026-09-18 (1217 price bars that session).
Working copy does not match the committed pin d61437921c87. It started from the current bucket object, then this run added off-cycle scores and SPY bars locally. backtests/run118.toml was not rewritten.
Live Postgres export failed; using snapshots already in the copy.
Price ingest skipped.
SPY bars already in the copy (30).

Pinned dataset end is 2026-09-04. The working copy is `/Users/jackgisel/workspace/investing-picks-app/datasets/dataset-cadence.sqlite`. The pinned file and the Run 118 baseline were not rewritten.

Both arms add at most one name per evaluation, $1000 each, fill `same_close` at 0.0 bps. Starting cash is $50000.

## Book

| | Biweekly | Weekly |
| --- | --- | --- |
| Evaluations | 4 | 7 |
| Buys | 4 | 7 |
| Exits | 0 | 0 |
| Ending names | 4 | 7 |
| Ending invested | $3,985 | $6,859 |

Biweekly dates: 2026-08-07, 2026-08-21, 2026-09-04, 2026-09-18.
Weekly dates: 2026-08-07, 2026-08-14, 2026-08-21, 2026-08-28, 2026-09-04, 2026-09-11, 2026-09-18.

## Stock book

Biweekly: stock-book return -2.79% over 29 return days, daily standard deviation 2.27%, annualized volatility 35.98%.
Weekly: stock-book return -1.40% over 29 return days, daily standard deviation 1.46%, annualized volatility 23.24%.

Those annualized figures extrapolate a few weeks of daily moves. They are not a year of volatility.

## Same-dollar S&P 500

Each fill buys or sells SPY with the same notional. Alpha is the stock book's dollar P&L minus that SPY path, marked on the last day of the window.

Biweekly: picks $-14.59, SPY $-31.26, alpha $16.67.
Weekly: picks $-140.69, SPY $-63.49, alpha $-77.20.

## Total equity

Total-equity volatility counts the cash pile. It is not the test of a larger stock book.

Biweekly: total equity return -0.03%, annualized volatility 1.00%, ending equity $49,985.
Weekly: total equity return -0.28%, annualized volatility 1.38%, ending equity $49,859.

## Picks

Biweekly buys:
- 2026-08-07 FIX $1,000 (buy)
- 2026-08-21 GOOG $1,000 (buy)
- 2026-09-04 LLY $1,000 (buy)
- 2026-09-18 SNDK $1,000 (buy)
Weekly buys:
- 2026-08-07 FIX $1,000 (buy)
- 2026-08-14 LLY $1,000 (buy)
- 2026-08-21 GOOG $1,000 (buy)
- 2026-08-28 TPR $1,000 (buy)
- 2026-09-04 ROST $1,000 (buy)
- 2026-09-11 DELL $1,000 (buy)
- 2026-09-18 SNDK $1,000 (buy)

Only weekly bought: DELL, ROST, TPR.
Only biweekly bought: none.
Both bought: FIX, GOOG, LLY, SNDK.

Off-cycle weekly buys:

- LLY on 2026-08-14. Biweekly bought it later on 2026-09-04.
- TPR on 2026-08-28. Biweekly did not buy it on a later evaluation Friday.
- DELL on 2026-09-11. Biweekly did not buy it on a later evaluation Friday.
