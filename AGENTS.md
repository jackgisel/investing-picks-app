# Monorepo notes for agents

## Architecture
- `packages/strategy` — pure Run 118 `evaluate()`; no I/O
- `apps/api` — FastAPI virtual book + decision ledger
- `apps/worker` — FMP ingest, scoring, scheduled eval
- `apps/web` — Next.js UI; proxies `/api/data/*` → `OUTPICK_API_URL`

## Do not
- Reintroduce Alpaca execution
- Duplicate strategy rules outside `packages/strategy`
- Use adaptive max_buys (always `max_adds_per_evaluation=1`)
