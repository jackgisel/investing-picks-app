# Backtest data window

Source of truth for the real-data backtest window. Strategy rules stay in
`packages/strategy` `evaluate()`; this file only records **what vintages we
hold** and **which FMP endpoints the current key can read**.

Locked decisions: FMP only, own snapshots going forward, full eligible universe
for scoring in the backtest (not the live top-400 cap), canonical
`position_size_usd=1000`, no proxy for revisions, max spend $100. Fill
assumption for later phases: same-close 0 bps canonical. Delisted price holes:
log-and-drop with a count. Return metrics gated on ≥ 24 evaluations.

## Segments

| Segment | Dates | Universe with a revisions pair | Evaluation Fridays |
|---|---|---|---|
| A. Live snapshots already in Postgres | first `fundamentals.as_of` carrying `epsEstimateAvg` → Phase 1 ship date | top-400-by-cap + held names, weekly (Saturday) | labelled `top400_live` |
| B. Full-universe snapshots | Phase 1 ship date + 5 days → forever | full eligible universe (~800–1,200 names), daily | labelled `full` |

Lead-in for the other factors (12 months of bars, 8+ quarters of statements)
is pulled from FMP history in Phase 2 and does not shorten this window.
Nothing before Segment A can ever be reconstructed: FMP `analyst-estimates`
is a current snapshot, not a vintage tape.

Fewer than ~24 evaluations → decision-level diagnostics only, never
CAGR/Sharpe as a headline. ≥ 24 → rolling risk/return with confidence bands.
≥ 48 → in-sample / holdout becomes meaningful.

## What Phase 1 records

Daily job `consensus_snapshot` (Mon–Fri 17:00 ET, after the close, before
`daily_marks` at 18:30). Also `RUN_JOB_ONCE=consensus_snapshot` and
`POST /api/ops/consensus-snapshot`.

- Table: `consensus_snapshots` (append-only, unique on
  `(ticker, as_of, fiscal_period)`). Same-day retries do **not** overwrite.
- Universe: FMP `company-screener` from **$250M / $4** (buffer under the live
  $300M / $5 floors) plus every active non-ETF `stocks` row plus every held
  name. Below-floor names are **not** admitted to `stocks`.
- Source: FMP `analyst-estimates` (`period=annual`), every fiscal period in
  the payload (~4 rows/ticker/day).
- `compute_estimate_revisions` reads `consensus_snapshots` first at each
  lookback tier (21-day target, then ≥ 5-day floor), then `fundamentals`.
  Segment A therefore stays usable; live top-400 revisions do not jump onto a
  6-day pair the week this job ships.
- A missed weekday after the first vintage writes an error `job_runs` row
  (`consensus_snapshot_gap`) so the existing ops alert sweep mails it. A
  silent empty poll raises instead of recording success.

Health: `GET /api/ops/consensus-snapshot` returns the latest `as_of`, ticker
count, and any weekday holes.

Production audit (fills the exact Segment A date after deploy):

```
python -m worker.audit_segment_a
python -m worker.audit_segment_a --json
```

## Segment A audit (live `fundamentals` vintages)

Run the command above against production Postgres and paste the generated
tables here. Until that query has been run, the shape is:

- Universe scope: `top400_live` (Saturday `refresh_fundamentals`, max 400 by
  market cap plus held names).
- First `fundamentals.as_of` carrying `epsEstimateAvg`: **unknown until the
  production audit runs** — expected on or after the July 2026 weekly refresh
  that started storing consensus fields (`epsAvg` / `estimatedEpsAvg`).
- Evaluation Fridays in that span are labelled `top400_live` and must never be
  mixed with Segment B `full` Fridays in a report.
- Expected Fridays if the first vintage is ~mid-July 2026: 17 Jul, 7 Aug,
  21 Aug, 4 Sep (holiday-shifted to the last session with a bar). Pair counts
  are zero until a ticker has two same-FY estimates ≥ 5 days apart.
- **Tape v2 (BUG-P8):** `derive_ticker` now pairs from the estimate vintage
  date, not the evaluation Friday, and ignores `source=pit` rows. The audit
  below still counts live `fundamentals` pairs (it already anchored on
  `snap.as_of`). Production `--json` was not available in the run121
  environment. The re-scored pin (`d61437921c87`, `derive_version = 2`) is
  Branch A: Aug 7 and Aug 21 both score with a spread revisions factor
  (mode share 0.29, `n_gate_pass` 14 / 16) rather than dropping as unscored.

The pytest fixture in `apps/api/tests/test_consensus_snapshot.py`
(`test_audit_segment_a_counts_pairs_and_evaluation_fridays`) pins the
counting rules: first vintage has no pair; a 7-day later vintage does; an
evaluation Friday uses the latest `fundamentals` row with `as_of <= friday`.

## FMP endpoint checks (Phase 2 prerequisites)

Client methods now exist on `FMPClient`:

| Endpoint | Method | Used in |
|---|---|---|
| `analyst-estimates` | `analyst_estimates` | Phase 1 snapshot (live) |
| `balance-sheet-statement?period=quarter` | `balance_sheet_quarterly` | Phase 2 ingest / Z-score |
| `historical-market-capitalization` | `historical_market_cap` | Phase 2 universe floor, EV |
| `delisted-companies` | `delisted_companies` | Phase 2 survivorship |

Each `consensus_snapshot` run probes all four and stores `{ok, n, error}` on
the `job_runs.detail` blob as `fmp_probes`. A 401/402/403 on a Phase 2
endpoint **does not fail** the snapshot job (the vintage is the urgent path).
Read the first production `consensus_snapshot` JobRun after deploy:

- `ok: true` → current key can read it; no FMP upgrade needed for that path.
- `ok: false` with `402` → plan restriction; stop before Phase 2 ingest and
  do not upgrade without a new spend decision.
- `ok: false` with `empty` → endpoint responded but returned no rows for the
  probe ticker (`AAPL` / first page of delistings); treat as a shape/params
  question, not a plan restriction.

`batch-quote` remains 402 on this plan; everything above is per-symbol.

## Point-in-time rules this table enforces

1. Consensus availability date is our snapshot `as_of` (the poll date in ET).
2. Rows are never rewritten. Restatements of FMP's *current* consensus become
   a new day's vintage, not an edit of yesterday.
3. Segment labelling: Segment A evaluations are `top400_live`; from the first
   Friday ≥ 5 days after the first full-universe snapshot, they are `full`.
