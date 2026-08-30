# X threads

Long-form reply threads posted to our own X account, drafted from the same
book facts the Friday review runs on.

Nothing reaches the timeline without an admin confirming it in
`/dashboard/ops/x-threads`. That gate is the point of the feature, not a
formality: these threads make public performance claims about a real book.

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

   With any of the four secrets unset, drafting still works and posting is
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
| --- | --- | --- |
| Fri 10:30 | `x_thread_draft` | Drafts the week-in-the-book thread |
| Tue 09:00 | `x_thread_market_draft` | Drafts the market & sectors thread |
| Weekdays 06:00 | `news_refresh` (worker) | Pulls headlines for held + top-rated non-held tickers into `stock_news` |
| Weekdays 06:30 | `x_thread_spotlight_draft` | Drafts the daily screener spotlight (name, sector, or news — never a pick) |
| Weekdays 07:00–17:00, hourly | `x_thread_post` | Posts whatever is confirmed |

Run any of them on demand with `RUN_JOB_ONCE=x_thread_draft` on the worker.
The ops page has **Draft now** and **Post now** buttons that call the same code.

## What the model may and may not say

Enforced in the style guide in `src/lib/x-thread-draft.ts`:

- Percentages only for our book. No position sizes, share counts, entry or
  exit prices, portfolio values, or dollar P&L.
- Every number must appear in the payload. The payload carries a `missing`
  array naming what is unavailable, and those stay unknown.
- **No cherry-picking**: a thread citing an individual holding's return must
  also state how the whole book did over a comparable period.
- Losses and weak grades get stated in the same voice as the wins.
- No price targets of ours, no urgency, no future-performance promises.

## Shape: engineered for reads, not just accurate

Decided 2026-08-30, deliberately in tension with the rule above it — see the
note in memory (`project_outpick_x_threads`) for why. The compliance rules
above are untouched and take priority; what changed is presentation:

- **7–12 posts is the target shape**, not just the allowed range. Padding to
  hit it is still banned.
- **The hook (post 1) is expected to earn the read** — a specific, surprising
  claim, not a topic announcement. A real curiosity gap is fine as long as
  post 2 pays it off fast; a teaser that never pays off is not.
- **One idea per middle post**, each one written to stand alone if
  screenshotted out of the thread.
- **The thread closes on its most quotable line, then one plain invitation to
  engage** — a question, "reply with...", "quote it if...". That invitation
  is to talk, never to trade: it may not ask anyone to buy, sell, or act on a
  position. The no-urgency / no-second-person-exhortation rule above still
  governs the trade itself; it does not ban inviting a reply.

The market thread has a specific trap it is written around: we have our own
holdings' sectors, but no broad-market sector indices. `missing` always
carries `broad_market_sector_performance`, and the brief tells the model it may
describe how *our* sector positioning fared but not diagnose sector rotation it
cannot see.

## The spotlight thread

Daily, drafted at 06:30 PT. It covers ONE thing sourced from the same
non-held watchlist the Monday market note and the video pipeline already
draw on (`/ops/editorial-brief`): a screen-rated name we do not hold, a
sector breadth reading, or a recent headline about one of those non-held
names. `pickSpotlightIndex` in `x-thread-draft.ts` rotates evenly across
whichever of the three actually has data that day and cycles the list within
whichever is picked, deterministically — a re-fired job on the same day lands
on the same subject instead of a random one, which is also what keeps the
dedupe key (the calendar day, not the ISO week) idempotent. A day with no
news ingested just rotates between the other two; it never leaves a gap.

This is the thread most likely to read as a stock tip if the style guide is
loosened, so it carries two extra rules beyond the shared ones: it must state
plainly, in its own words, that the subject is not a portfolio position or a
recommendation, and it must never cite an individual holding's return next to
it — only the book's aggregate, if any comparison is made at all.

**News**, added 2026-08-30: the worker's `news_refresh` job (weekdays 06:00
PT) pulls headlines from FMP's `/stable/news/stock` for held tickers plus the
~20 highest-rated non-held names, and upserts them into the `stock_news`
table, deduped by URL and pruned after 14 days
(`worker.services.ingest.refresh_news`). `/ops/editorial-brief` then serves
the last 3 days of that table, **excluding anything about a held ticker** —
a headline about something we own would read as commentary on a holding,
which this thread is explicitly not allowed to be. There is still no general
market-news feed; only names the screen already tracks.

## When a thread fails halfway

There is no un-post. A thread that dies at post 4 leaves three posts public,
so `postThread` never retries: it returns exactly what landed, the row goes to
`failed` with its `posted_ids`, and the ops page shows "Partial — 3 of 8
posted". Recovery is manual and deliberate: delete the stub on X, then draft
again. A thread where *nothing* posted releases its claim and can be retried
as-is.
