# Deploys

Railway project **`outpick`** (`f839a276-d3ef-470d-8d35-d80a561459a3`), environment
`production`. Four services: `web`, `api`, `worker`, `Postgres`.

> The separate `etf` Railway project is the old live deployment. Nothing here touches it.

## The one thing that will break your build

All three Dockerfiles build from the **repository root**, not from their own directory:

- `apps/api/Dockerfile` copies `packages/strategy` *and* `apps/api`
- `apps/worker/Dockerfile` copies `packages/strategy`, `apps/api`, *and* `apps/worker`
- `apps/web/Dockerfile` copies `apps/web/package.json`, i.e. a root-relative path

So in Railway each service's **Root Directory must stay `/`** (empty). Setting it to
`apps/web` — the intuitive move in a monorepo — makes every `COPY` fail, because the build
context no longer contains those paths. The Dockerfile is selected by
`build.dockerfilePath` in the config files below, not by the root directory.

## Config as code

Because all services share one build context, they can't share one `railway.json` at the
root — each needs its own, selected per service:

| Service | Config file | Rebuilds when |
|---|---|---|
| `web` | `railway.web.json` | `apps/web/**` |
| `api` | `railway.api.json` | `apps/api/**`, `packages/strategy/**` |
| `worker` | `railway.worker.json` | `apps/worker/**`, `apps/api/**`, `packages/strategy/**` |

The watch patterns are what stop a one-line CSS change from rebuilding and restarting the
worker. Note `worker` watches `apps/api/**` too — its Dockerfile copies that tree, so an
API change genuinely does change the worker image.

## Connecting GitHub (one-time, dashboard only)

The Railway CLI has no command for this and it can't be scripted without a
`RAILWAY_TOKEN`. In the dashboard, for **each** of `web`, `api`, `worker`:

1. Service → **Settings** → **Source** → **Connect Repo** →
   `jackgisel/investing-picks-app`, branch **`main`**.
   The first service will prompt you to install the Railway GitHub App on the repo.
2. Leave **Root Directory** empty. (See above — this is the failure mode.)
3. Set **Config File Path** to that service's file from the table.
4. Confirm **Wait for CI** is off unless you add CI first.

Connecting a source triggers an immediate deploy of the branch head.

## Rollback

Railway keeps prior deployments per service — redeploy a previous one from the service's
Deployments tab. `railway redeploy` / `railway down` also work against the linked service.
