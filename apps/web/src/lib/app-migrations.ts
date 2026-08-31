import { pool } from "@/lib/db";
import { reviewWindowHours } from "@/lib/review-window";

/**
 * App-owned tables that aren't managed by BetterAuth.
 *
 * Idempotent — uses CREATE TABLE IF NOT EXISTS so it can run on every cold
 * start without breaking anything. Called from ensureMigrations() in auth.ts.
 */
export async function runAppMigrations() {
  // Notification preferences. One row per user.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      new_picks BOOLEAN NOT NULL DEFAULT TRUE,
      weekly_summary BOOLEAN NOT NULL DEFAULT TRUE,
      performance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
      product_updates BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Stripe subscription state. Provider identifiers stay server-side.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_subscription (
      user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      canceled_at TIMESTAMPTZ,
      founders_discount_redeemed_at TIMESTAMPTZ,
      membership_welcome_email_claimed_at TIMESTAMPTZ,
      membership_welcome_email_sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // One-time Paddle cutover. Only rows carrying Paddle identifiers are made
  // inactive; manually seeded rows without provider IDs keep their status.
  await pool.query(`
    ALTER TABLE user_subscription
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS founders_discount_redeemed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS membership_welcome_email_claimed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS membership_welcome_email_sent_at TIMESTAMPTZ
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'user_subscription'
           AND column_name = 'paddle_customer_id'
      ) THEN
        UPDATE user_subscription
           SET status = 'inactive', cancel_at_period_end = FALSE, updated_at = NOW()
         WHERE paddle_customer_id IS NOT NULL
            OR paddle_subscription_id IS NOT NULL;
        DROP INDEX IF EXISTS user_subscription_paddle_customer_idx;
        DROP INDEX IF EXISTS user_subscription_paddle_subscription_idx;
        ALTER TABLE user_subscription
          DROP COLUMN paddle_customer_id,
          DROP COLUMN paddle_subscription_id;
      END IF;
    END $$
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_subscription_stripe_customer_idx
      ON user_subscription(stripe_customer_id)
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_subscription_stripe_subscription_idx
      ON user_subscription(stripe_subscription_id)
  `);

  // A success-only audit ledger for webhook deliveries. Subscription updates
  // still retrieve Stripe's current snapshot, so duplicate and out-of-order
  // events remain safe even when Stripe retries them concurrently.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_event (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Admin flag on the BetterAuth user table. Gates /dashboard/ops and
  // /api/ops/*. Seeded from the ADMIN_EMAILS env var (see lib/admin.ts).
  await pool.query(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE
  `);

  // Weekly market note list. Deliberately NOT keyed to "user" — the whole point
  // is capturing people who have not signed up for an account, so this table
  // stands alone and an address may exist here, in "user", or in both.
  //
  // `token` is the unsubscribe capability: it is the only thing the one-click
  // unsubscribe link carries, so it must be unguessable. Unsubscribing sets
  // unsubscribed_at rather than deleting the row, so a resubscribe does not
  // silently reset a prior opt-out and we keep an auditable record of consent.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_note_subscriber (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unsubscribed_at TIMESTAMPTZ
    )
  `);

  // Partial index: every send scans for active subscribers only.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS market_note_subscriber_active_idx
      ON market_note_subscriber(created_at)
      WHERE unsubscribed_at IS NULL
  `);

  // Public identity for comment threads, kept SEPARATE from BetterAuth's
  // `name`. `name` comes from signup and is frequently a real full name; the
  // moment comments are published it would become public without the user ever
  // choosing that. Null means "has not set one" — the UI must not fall back to
  // `name` for display.
  await pool.query(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS display_name TEXT
  `);

  // Comments on blog posts and research notes.
  //
  // (subject_type, subject_slug) rather than a FK: blog posts are filesystem
  // content (lib/blog.ts) with nothing to reference, and insights addressed the
  // same way when they were too. Insights are rows now — but the slugs did not
  // change in that migration precisely so these threads stayed attached, and a
  // FK on one subject_type but not the other buys nothing. subject_type is
  // constrained because a typo would silently create a second, invisible thread
  // on the same page.
  //
  // deleted_at rather than DELETE: a removed comment in the middle of a thread
  // still has replies hanging off it, and cascading them away deletes other
  // people's words to moderate one person's.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comment (
      id BIGSERIAL PRIMARY KEY,
      subject_type TEXT NOT NULL CHECK (subject_type IN ('blog', 'insight')),
      subject_slug TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      parent_id BIGINT REFERENCES post_comment(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  // The one query every thread runs.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS post_comment_subject_idx
      ON post_comment(subject_type, subject_slug, created_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS post_comment_parent_idx
      ON post_comment(parent_id)
  `);

  // Research notes. Previously .tsx modules under src/content/insights, which
  // meant publishing one was a code change and a deploy — so nothing that
  // notices a new pick could ever write the note for it.
  //
  // lede / tldr / key_takeaway are columns rather than markdown because the
  // Prose components they map to (<Lede>, <TLDR>, <KeyTakeaway>) have no
  // markdown equivalent and would not survive a round trip. body_md carries
  // the part markdown does represent faithfully — headings, paragraphs, lists,
  // emphasis, links — and MarkdownProse renders it onto the same primitives the
  // hand-written articles used. The educational disclaimer is a fixed template
  // in the route, deliberately not model output.
  //
  // email_sent_at is the double-send guard. Approving claims it in the same
  // UPDATE that publishes, so a double-click, a retry, or two admins racing
  // cannot mail the list twice. There is no un-send.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS insight (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      ticker TEXT,
      post_type TEXT NOT NULL DEFAULT 'pick'
        CHECK (post_type IN ('pick', 'quarterly_review', 'weekly_review')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'draft', 'failed', 'approved', 'rejected')),
      title TEXT,
      description TEXT,
      lede TEXT,
      tldr JSONB,
      body_md TEXT,
      key_takeaway TEXT,
      tags JSONB,
      reading_time INT,
      author TEXT,
      quarter TEXT,
      generation_error TEXT,
      source_facts JSONB,
      published_at TIMESTAMPTZ,
      email_sent_at TIMESTAMPTZ,
      auto_publish_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Auto-publish. A draft carries its own deadline rather than the sweep
  // deriving one from updated_at: editing a note must not silently push its
  // send back, and regenerating one must reset it. Stamped by saveDraft.
  await pool.query(`
    ALTER TABLE insight
      ADD COLUMN IF NOT EXISTS auto_publish_at TIMESTAMPTZ
  `);

  // 'rejected' postdates the original CHECK, and CREATE TABLE IF NOT EXISTS
  // does not revisit an existing table's constraints. Drop and re-add rather
  // than conditionally patching: the constraint is cheap to revalidate and the
  // statement then states the full set of legal statuses in one place.
  await pool.query(`
    ALTER TABLE insight DROP CONSTRAINT IF EXISTS insight_status_check
  `);
  await pool.query(`
    ALTER TABLE insight
      ADD CONSTRAINT insight_status_check
      CHECK (status IN ('pending', 'draft', 'failed', 'approved', 'rejected'))
  `);

  // Drafts written before auto-publish existed carry no deadline, and the sweep
  // requires one — without this they would wait for a button forever, which is
  // the exact failure the feature was built to end.
  //
  // The window is measured from now rather than from `updated_at`, so an old
  // draft gets the full review period starting at the deploy that introduced
  // the behaviour. Backdating would mail a note that has been sitting unread
  // for days within fifteen minutes of this migration running, with nobody
  // watching. Idempotent: it only ever fills a NULL.
  await pool.query(
    `UPDATE insight
        SET auto_publish_at = NOW() + ($1::numeric * INTERVAL '1 hour')
      WHERE status = 'draft'
        AND email_sent_at IS NULL
        AND auto_publish_at IS NULL`,
    [reviewWindowHours()],
  );

  // One pick note per ticker. Partial, because quarterly reviews have no ticker
  // and several of them would otherwise collide on NULL.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS insight_pick_ticker_idx
      ON insight(ticker)
      WHERE post_type = 'pick' AND ticker IS NOT NULL
  `);

  // The index page and the ops queue both sort by this.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS insight_status_published_idx
      ON insight(status, published_at DESC)
  `);

  // The auto-publish sweep runs every few minutes and asks one question: which
  // drafts are due? Partial, so the index holds only the handful of rows that
  // are actually in the window rather than every note ever published.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS insight_auto_publish_due_idx
      ON insight(auto_publish_at)
      WHERE status = 'draft' AND email_sent_at IS NULL
  `);

  // Drafting retries. A generation failure used to park the note in `failed`
  // until a human noticed and pressed Regenerate — the same "gate with no
  // doorbell" shape as the approval bug. The sweep now retries, and this is the
  // stopper: a ticker whose facts genuinely cannot be drafted must not burn a
  // model call on every pass forever.
  await pool.query(`
    ALTER TABLE insight
      ADD COLUMN IF NOT EXISTS generation_attempts INT NOT NULL DEFAULT 0
  `);

  // weekly_review postdates the original CHECK. Same drop-and-readd as
  // insight_status_check: CREATE TABLE IF NOT EXISTS will not widen an
  // existing constraint, and the statement then names the full set.
  await pool.query(`
    ALTER TABLE insight DROP CONSTRAINT IF EXISTS insight_post_type_check
  `);
  // 'exit' postdates the widening above. Same drop-and-readd for the same
  // reason. An exit note is the other half of a pick note: the position closed,
  // and this is the rule that closed it. Deliberately NOT covered by
  // insight_pick_ticker_idx — that index is scoped to post_type = 'pick', and a
  // ticker can be bought, sold and bought again, so a ticker legitimately has
  // many exit notes. Slug uniqueness is the only constraint they need.
  await pool.query(`
    ALTER TABLE insight
      ADD CONSTRAINT insight_post_type_check
      CHECK (post_type IN ('pick', 'quarterly_review', 'weekly_review', 'exit'))
  `);

  /*
   * The public sample.
   *
   * Every insight is members-only and noindex. Exactly one pick note and one
   * exit note are nominated from ops as the public specimen, served
   * unauthenticated at /research/<slug> so a visitor can read real research
   * before paying. A flag on the row rather than a slug in constants.ts: the
   * choice is editorial and changes without a deploy, and the landing page
   * reads the same flag, so the cards can never advertise a note the public
   * route would refuse to serve.
   */
  await pool.query(`
    ALTER TABLE insight
      ADD COLUMN IF NOT EXISTS public_sample_at TIMESTAMPTZ
  `);

  /*
   * The free weekly Market Note.
   *
   * Its own table rather than another `insight` post_type. An insight is a
   * members-only research note keyed to a position; a Market Note is public
   * commentary mailed to addresses that are not accounts. They share almost no
   * columns and every query on `insight` would have had to start excluding it.
   *
   * Confirm-then-send, like the Friday review: `confirmed_at` is a human
   * saying the draft is ready, `sent_at` is the ledger saying it went. A draft
   * with neither is invisible to the sender.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_note_issue (
      id BIGSERIAL PRIMARY KEY,
      week_key TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      lede TEXT,
      body_md TEXT,
      confirmed_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      recipients INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS market_note_issue_recent_idx
      ON market_note_issue(created_at DESC)
  `);

  // One sample per post type. Nominating a second pick note has to displace the
  // first rather than silently produce two.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS insight_public_sample_idx
      ON insight(post_type)
      WHERE public_sample_at IS NOT NULL
  `);

  // Confirm-then-send for the Friday review. Stays NULL on pick notes. A
  // confirmed weekly_review is still status=draft until noon publishes it —
  // members must not see it, and pick auto-publish must not pick it up.
  await pool.query(`
    ALTER TABLE insight
      ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ
  `);

  /*
   * One ledger for "has this exact message already gone out?".
   *
   * The weekly digest, the performance alerts and anything added later all need
   * the same guarantee the pick announcement gets from `email_sent_at`: a job
   * that fires twice, a retried request, or two workers overlapping must not
   * mail the list twice. A bespoke column per feature is how one of them ends
   * up without the guard, so they share a claim table instead.
   *
   * `kind` is the feature, `dedupe_key` is whatever makes an instance unique to
   * it — an ISO week for the digest, `TICKER:100` for a milestone. The primary
   * key IS the lock: INSERT ... ON CONFLICT DO NOTHING has exactly one winner.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_dispatch (
      kind TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      recipients INT NOT NULL DEFAULT 0,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (kind, dedupe_key)
    )
  `);

  /*
   * Product updates — the admin-composed announcement.
   *
   * A row, not a code deploy, for the same reason research notes became rows:
   * writing one should not require shipping the app. `sent_at` is the claim,
   * mirroring `insight.email_sent_at`, so approving twice cannot mail twice.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_update (
      id BIGSERIAL PRIMARY KEY,
      subject TEXT NOT NULL,
      body_md TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent')),
      sent_at TIMESTAMPTZ,
      recipients INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS product_update_status_idx
      ON product_update(status, created_at DESC)
  `);

  /*
   * Feature requests — what members ask us to build.
   *
   * The channel before this was a mailto: link, which captured nothing: no
   * count of how many people wanted the same thing, no way to tell a member
   * their idea shipped, and no list to work from. A row fixes all three.
   *
   * `title` and `body` are separate because the list views are scannable only
   * if there is a one-line handle for each request; folding them into one text
   * column would mean truncating a paragraph and hoping the first sentence was
   * the point.
   *
   * `status` is the member-visible half of triage and `admin_note` the reply —
   * both are read back on the member's own page, so nothing written here is
   * private. `declined` is deliberately in the set: silently leaving a request
   * `open` forever is a worse answer than saying no.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_request (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'planned', 'shipped', 'declined')),
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // The member page's only query, and the 24h rate-limit count.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS feature_request_user_idx
      ON feature_request(user_id, created_at DESC)
  `);
  // The ops triage list.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS feature_request_triage_idx
      ON feature_request(status, created_at DESC)
  `);

  /*
   * X threads — the long-form reply threads we post to our own X account.
   *
   * A row is a whole thread, not a post: `posts` is the ordered JSONB array of
   * post bodies, because the unit a human reviews and confirms is the thread.
   * Splitting it into one row per post would make the confirm gate meaningless
   * (you would be approving fragments) and would let a partially-posted thread
   * look complete.
   *
   * The lifecycle mirrors the Friday review exactly — draft, admin confirm,
   * then post — for the same reason: these threads make performance claims
   * about a real book to the public, and nothing that does that goes out
   * unread. `confirmed_at` is the gate, `posted_at` is the claim.
   *
   * `posted_ids` records what actually landed. A thread that dies at post 4
   * leaves three posts on the timeline; without the ids there is no way to
   * tell that from a thread that never started, and the recovery for the two
   * is opposite (delete-and-redo versus just run it).
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS x_thread (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL
        CHECK (kind IN ('pick', 'weekly_review', 'market', 'spotlight')),
      dedupe_key TEXT NOT NULL,
      posts JSONB NOT NULL DEFAULT '[]'::jsonb,
      facts JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'posted', 'failed', 'rejected')),
      confirmed_at TIMESTAMPTZ,
      posted_at TIMESTAMPTZ,
      posted_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      failed_at_index INTEGER,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (kind, dedupe_key)
    )
  `);
  // 'sunday_review' postdates the original CHECK, and CREATE TABLE IF NOT
  // EXISTS does not revisit an existing table's constraints — same situation
  // as insight_status_check above, same fix. Without this the Sunday draft
  // job fails its INSERT on every deployment that already has the table.
  await pool.query(`
    ALTER TABLE x_thread DROP CONSTRAINT IF EXISTS x_thread_kind_check
  `);
  await pool.query(`
    ALTER TABLE x_thread
      ADD CONSTRAINT x_thread_kind_check
      CHECK (kind IN ('pick', 'weekly_review', 'market', 'spotlight',
                      'sunday_review'))
  `);
  // The ops queue: newest first, drafts before anything else.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS x_thread_queue_idx
      ON x_thread(status, created_at DESC)
  `);
}
