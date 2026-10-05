# X posts

Outpick posts graphics for a fixed theme list (Big Tech and AI platforms,
semiconductors, AI infrastructure, energy and power) — see
`apps/web/src/lib/income-visual/themes.json`. A name not on that list is not
drafted, and a holding is never posted.

Each weekday drafts three graphics — open roles, headcount, and revenue —
and posts them at a stable time inside the morning, midday, and afternoon
windows. When a theme-list company reports, one more card is drafted: the
income mix when it is stored, otherwise the income-statement flow. On an
evaluation Friday a pick-result post names one holding from the prior cycle.
The written thread formats were removed.

Drafts land in Communication → X
(`/dashboard/ops/communication?piece=x`). A daily graphic posts at its clock
time unless an admin rejects it. An earnings card posts once its review
window passes. See `apps/web/src/lib/income-visual/x.ts` for the knobs
(`X_INCOME_VISUALS_AUTO_POST`, `X_INCOME_VISUAL_REVIEW_HOURS`,
`X_INCOME_VISUALS_PER_DAY`).

## Setup

1. Create a project and app at <https://developer.x.com>. Under **User
   authentication settings**, set app permissions to **Read and write** —
   read-only tokens produce a 403 on every post, with no hint as to why.
2. Generate the four OAuth 1.0a credentials (Consumer keys, plus Access token
   and secret). If you generated the access token *before* switching the app to
   Read and write, regenerate it — the permission is baked into the token.
3. Set these on the **web** service (the worker never posts; it only asks the
   web app to):

   ```
   X_CONSUMER_KEY=
   X_CONSUMER_SECRET=
   X_ACCESS_TOKEN=
   X_ACCESS_TOKEN_SECRET=
   X_HANDLE=outpickxyz       # no @. Must match the user the access token belongs to.
   ```

   With any of the four secrets unset, drafts still queue and posting is
   disabled — the ops page says so, and the job skips rather than failing.

   The access token is the account that posts. Before each run the web app
   calls `GET /2/users/me` and refuses to post when that username is not
   `X_HANDLE`. A mismatch is shown on Communication → X Threads. Regenerating
   the access token while logged into @outpickxyz, then setting the four
   secrets and `X_HANDLE=outpickxyz` on the web service, is what changes the
   account. The default handle, when `X_HANDLE` is unset, is `outpickxyz`.

## Cost

X removed the free tier for new developers in February 2026; posting is
pay-per-use. At the rates the client encodes:

- **$0.015** per post
- **$0.20** per post containing a URL

A ten-post thread is about 15c. This is why the style guide forbids links in
the body — one link would cost more than the rest of the thread combined, and
the profile bio already carries the site. The ops page shows the estimate for
each thread before you confirm it.

## Schedule

| When (PT) | Job | What it does |
|---|---|---|
| Weekdays 03:30 | `income_statements_refresh` | Refreshes statements for every held name |
| Weekdays 04:00–19:45, every 15 min | `income_visuals_watch` | Drafts the day's jobs, headcount, and revenue cards, plus a sankey or pie when a theme-list company reports |
| Weekdays 08:00–18:45, every 15 min | `x_thread_post` | Posts a graphic once its clock time has passed, unless it was rejected |

Run either on demand with `RUN_JOB_ONCE=<job>` on the worker.
