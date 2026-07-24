# Outpick monorepo

Virtual portfolio engine (Python) + member UI (Next.js). **No Alpaca** — the book of record is Postgres (or SQLite locally).

## Layout

```
apps/web      Next.js member + ops UI (BetterAuth, Paddle)
apps/api      FastAPI — /api/v1 (public) + /api/ops (ledger)
apps/worker   APScheduler jobs (FMP ingest, score, evaluate)
packages/strategy  Pure Run 118 rules (shared live/backtest)
```

## Hard rule

Live evaluation and backtest must call `outpick_strategy.evaluate(...)`. Params default to **Run 118** (1 buy/eval, active recycling, house money uncapped, 270d underwater).

## Quick start (local)

```bash
# Strategy tests
python3 -m venv .venv && .venv/bin/pip install -e "packages/strategy[dev]"
.venv/bin/pytest packages/strategy/tests -q

# API (SQLite by default)
.venv/bin/pip install -e packages/strategy fastapi "uvicorn[standard]" sqlalchemy pydantic-settings
cd apps/api && PYTHONPATH=. ../../.venv/bin/uvicorn app.main:app --reload --port 8000

# Web
cd apps/web && pnpm install && OUTPICK_API_URL=http://localhost:8000 pnpm dev
```

Docker (Postgres + all services):

```bash
docker compose up --build
```

## Ops visibility

- `GET /api/ops/dry-run` — what would we do next (structured rules)
- `GET /api/ops/evaluations` — decision ledger
- `GET /api/ops/portfolio` — full virtual book (dollars)
- Header: `X-Ops-Key: $OPS_API_KEY`

Web: `/dashboard/ops` and `/dashboard/ops/book`

## Import from jdpicks

Export positions to JSON, then:

```bash
PYTHONPATH=apps/api .venv/bin/python apps/worker/worker/import_positions.py path/to/snapshot.json
```

See `scripts/sample-portfolio.json`.

## Env

Copy `.env.example`. Key vars: `DATABASE_URL`, `FMP_API_KEY`, `OPS_API_KEY`, `OUTPICK_API_URL`.

## Deprecating jdpicks

Keep `jdpicks` / `etf.jackgisel.com` read-only until this API is the source of truth. Point `OUTPICK_API_URL` at the new service, then shut down Alpaca paper execution.
