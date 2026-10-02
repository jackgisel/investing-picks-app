# X posts

The only thing Outpick posts to X is an income visual: a company's income
statement drawn as a flow, queued as each company reports. The written thread
formats (weekly review, market, spotlight, week ahead, hot take, leaderboard,
question) were removed.

Drafts land in Communication → X Threads
(`/dashboard/ops/communication?tab=x-threads`). An income visual posts itself
once its review window passes unless an admin rejects it; see
`apps/web/src/lib/income-visual/x.ts` for the knobs
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
   X_HANDLE=outpick          # no @, used only to build permalinks
   ```

   With any of the four secrets unset, drafts still queue and posting is
   disabled — the ops page says so, and the job skips rather than failing.

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
| Weekdays 04:00–19:45, every 15 min | `income_visuals_watch` | Drafts a visual for each new print |
| Hourly, weekdays 07:00–17:00 | `x_thread_post` | Posts whatever is confirmed or past its review window |

Run either on demand with `RUN_JOB_ONCE=<job>` on the worker.
