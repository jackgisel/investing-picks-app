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

## Phase 2: leaderboard

- `company_revenue` holds annual revenue, filled by the headcount job in the
  same pass (one extra request per name that has a headcount; a capped
  revenue-only backfill picks up names that came back empty).
- `app/services/workforce.py` pairs each headcount with the revenue year ending
  within 45 days of its period. Growth is only taken against a pair about a
  year earlier. Leverage = revenue growth minus headcount growth. In-industry
  percentile needs 5 peers. USD reporters only; $500M revenue and 50 employees
  floor (`MIN_REVENUE` / `MIN_EMPLOYEES` in `apps/web/src/lib/workforce.ts`).
- Public `/workforce`: top 10 for everyone, top 100 + sector filter + per
  company history chart for members (`requireSubscriber` on
  `/api/data/workforce/[ticker]`). The FastAPI routes are open like the rest of
  `/api/v1`; the web layer is the paywall.

## Phase 3: job openings

- Source: public Greenhouse, Lever and Ashby job-board feeds. Free. Large
  caps mostly use Workday or custom sites, so coverage skews to tech and
  mid-caps; a Workday pass is the obvious next source.
- `job_boards`: which board belongs to which company. `verified` only on an
  exact Greenhouse name match, or the company named in 60%+ of a Lever/Ashby
  board's postings. Unverified boards are counted but must not feed anything
  published.
- `job_opening_snapshots`: one row per company per day, append-only, total
  open postings plus the per-board split. A company is skipped for the day if
  any of its boards fails to load, so a partial count never reads as a
  hiring collapse.
- Jobs: `job_boards_discover` (Sun 09:00 ET, resumable) and
  `job_openings_collect` (weekdays 07:00 ET). Ops: `GET /api/ops/job-openings`
  (coverage by ATS, latest snapshot, weekday holes), `POST
  /api/ops/job-openings/discover|collect`.

## Phase 4: growth shape

Each company is placed in one of five shapes by revenue growth against
headcount growth (`classify_shape`): leaner, efficient growth, hiring ahead,
contracting, hiring into decline. Members get shape filters and a scatter of
every screened company.

## Phase 5: do the factors predict returns?

Runs as the on-demand job `workforce_ic` (`POST /api/ops/workforce-ic`, read
`GET /api/ops/workforce-ic`), or locally with `python -m worker.backtest.workforce_ic`
against whatever `DATABASE_URL` points at. Read-only. Factors: headcount growth, revenue growth (a control), leverage,
and revenue per employee ranked within industry. Month-end dates, forward
returns over 21 / 63 / 126 sessions, Spearman IC with a t-stat, same as
`factor_ic`. A headcount (and the revenue beside it) is only used from the
session after its filing date, and an amended filing only from its own. A name
whose prices stop before the horizon is dropped, not given a flat return.

Read it with the caveats it prints: today's universe (survivorship), overlapping
horizons overstate t, and a short window means direction, not size. Nothing
feeds `evaluate()` unless a factor holds up here and in the walk-forward.
