import { pool } from "@/lib/db";

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

  // Paddle subscription state. Populated by the Paddle webhook handler.
  // user_id is the FK; paddle_customer_id and paddle_subscription_id are
  // looked up by the webhook (we identify the user by email at first sight).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_subscription (
      user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      paddle_customer_id TEXT,
      paddle_subscription_id TEXT,
      status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end TIMESTAMPTZ,
      canceled_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_subscription_paddle_customer_idx
      ON user_subscription(paddle_customer_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_subscription_paddle_subscription_idx
      ON user_subscription(paddle_subscription_id)
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
        CHECK (post_type IN ('pick', 'quarterly_review')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'draft', 'failed', 'approved')),
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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
}
