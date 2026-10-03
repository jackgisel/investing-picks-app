# Workforce datasets (headcount, job openings)

Our own datasets, built so we can eventually test whether they predict returns.
Strategy rules stay in `packages/strategy` `evaluate()`; nothing here feeds it
until the factor IC study (Phase 5) says it should.

## Phases

| # | Ships | Reviewable after deploy by |
|---|---|---|
| 1 | Headcount ingest from FMP 10-K extracts | `GET /api/ops/employee-counts` |
| 2 | Public leaderboard (revenue per employee); history and chart paywalled | the page |
| 3 | Job-openings collector (free ATS feeds), append-only | `GET /api/ops/job-openings` |
| 4 | Growth/decline views: revenue shape vs headcount vs openings | the page |
| 5 | Factor IC study through `worker/backtest/factor_ic.py` | `backtests/experiments/` |

Openings history cannot be recovered after the fact, so Phase 3 may be pulled
forward of Phase 2 if the clock matters more than the page.

## Phase 1: headcount

- Source: FMP `historical-employee-count` (from each 10-K). Annual, lags the
  period end by weeks. **Not yet confirmed readable on our plan** — the first
  production run answers that (see below).
- Tables: `employee_counts` (append-only; unique on
  `ticker, period_of_report, filing_date`; `filing_date` is the availability
  date) and `employee_count_checks` (when we last asked, so names FMP has
  nothing for are not re-requested every run).
- Job: `employee_counts_refresh`, Sundays 06:00 ET. Universe is the same as the
  consensus snapshot. Resumable: stops on a time budget and continues next run,
  held names first. A new 10-K is only looked for once the last filing is 330+
  days old; names with no data are retried every 60 days.
- Fails loudly (mails the admins via the job-failure sweep) if the endpoint is
  off-plan (401/402/403) or 25+ requests all return nothing.
- `historical-employee-count` is also in `probe_backtest_endpoints`, so the
  daily `consensus_snapshot` `job_runs.detail` reports `ok` / `402` / `empty`
  for it.

### After deploy

1. `POST /api/ops/employee-counts` (or wait for Sunday). First load is ~1,000
   requests at the FMP rate limit; it may take a second run.
2. `GET /api/ops/employee-counts` → `tickers_with_headcount` vs
   `tickers_empty`, `last_run.detail`, `newest_filing`.
3. Read it as: mostly populated → continue to Phase 2. `402` → plan
   restriction, stop and decide on spend. Many empties → coverage question for
   the leaderboard's floor.
