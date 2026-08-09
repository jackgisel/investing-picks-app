# Sanitized production clone

Rebuild the local development databases from the Railway production data:

```bash
pnpm db:refresh-local
```

The command is intentionally idempotent. Every run force-drops and recreates
only these local databases:

- `outpick_dev` — portfolio, market, scoring, and decision-ledger data
- `outpick_web_dev` — web schema and published insights

It never writes to production. The web export uses a positive data allowlist:
only rows from `insight` are copied. Production users, password hashes,
sessions, email subscribers, Stripe subscription identifiers, preferences,
comments, and any future non-allowlisted tables never enter the local dump.

After restoring, the script creates one local-only subscribed admin:

```text
Email:    local@outpick.test
Password: outpick-local
```

It also overwrites `apps/api/.env` and `apps/web/.env.local` with local-only
configuration. Restart both dev servers after a refresh.

## Requirements

- Railway CLI, authenticated and linked to the `outpick` project
- `jq`
- local PostgreSQL running
- PostgreSQL 18 client tools (`brew install postgresql@18` on macOS)
- dependencies installed in `apps/web`

## Overrides

The safe defaults can be overridden for another local setup:

```bash
LOCAL_PG_ADMIN_URL=postgresql:///postgres \
LOCAL_MAIN_DB=outpick_dev \
LOCAL_WEB_DB=outpick_web_dev \
LOCAL_TEST_EMAIL=local@outpick.test \
LOCAL_TEST_PASSWORD=outpick-local \
PG18_BIN=/path/to/postgresql-18/bin \
pnpm db:refresh-local
```

Database names are validated, and the script refuses to replace `postgres`,
`template0`, or `template1`.
