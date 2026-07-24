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
}
