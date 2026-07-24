# Cutover from jdpicks → this monorepo

1. Export current paper book from jdpicks (positions + cash) to JSON matching `scripts/sample-portfolio.json`.
2. Point `DATABASE_URL` at production Postgres; run API once to create tables.
3. Import: `PYTHONPATH=apps/api python apps/worker/worker/import_positions.py export.json`
4. Set `OUTPICK_API_URL` on the web service to the new API.
5. Run worker with `FMP_API_KEY` for weekly refresh + biweekly eval.
6. Verify `/dashboard/ops` dry-run and that `max_adds_per_evaluation` stays 1.
7. Stop Alpaca paper execution in jdpicks; keep API read-only briefly if needed.
8. Decommission `etf.jackgisel.com` when traffic is fully on the new API.
