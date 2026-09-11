# Outpick monorepo

Virtual portfolio engine (Python) + member UI (Next.js). **No Alpaca** — the book of record is Postgres (or SQLite locally).

## Layout

```
apps/web      Next.js member + ops UI (BetterAuth, Stripe Billing)
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

## Billing

Stripe Checkout and the Customer Portal are hosted by Stripe; the web app does
not need a publishable key. Configure an “Outpick Membership” Product with tax
code `txcd_10701401` (Website Information Services – Personal Use), a $1,000
USD yearly Price with exclusive tax, and a Product-restricted $750 coupon with
`duration=once`. Confirm the tax code with the business's tax adviser.

Enable payment-method updates, invoice downloads, and cancellation at period
end in the Stripe Customer Portal. Register `/api/webhooks/stripe` for
`checkout.session.completed` and `customer.subscription.created`, `.updated`,
and `.deleted`, plus `invoice.paid` and `invoice.payment_failed` events. Keep
`STRIPE_AUTOMATIC_TAX_ENABLED=false` until an adviser confirms the applicable
registrations and Stripe shows them as active. Test and live mode need separate
Product, Price, Coupon, portal, webhook, tax-registration, and secret
configuration.

Production smoke tests can use a temporary, server-only
`STRIPE_PRODUCTION_TEST_EMAIL` and product-restricted
`STRIPE_PRODUCTION_TEST_COUPON_ID`. The coupon is applied automatically only to
that verified address; remove both variables after the test.

## Env

Copy `.env.example`. Billing uses `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_ANNUAL_PRICE_ID`, and
`STRIPE_FOUNDERS_COUPON_ID` in addition to the database and API variables. Use
a least-privilege restricted live key for the deployed application. Analytics
uses `NEXT_PUBLIC_DATAFAST_WEBSITE_ID` from the DataFast dashboard.

## Deprecating jdpicks

Keep `jdpicks` / `etf.jackgisel.com` read-only until this API is the source of truth. Point `OUTPICK_API_URL` at the new service, then shut down Alpaca paper execution.
