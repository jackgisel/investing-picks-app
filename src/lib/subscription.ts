import { pool } from "@/lib/db";

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled";

export type Subscription = {
  status: SubscriptionStatus;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  currentPeriodEnd: string | null; // ISO
  canceledAt: string | null; // ISO
};

const INACTIVE: Subscription = {
  status: "inactive",
  paddleCustomerId: null,
  paddleSubscriptionId: null,
  currentPeriodEnd: null,
  canceledAt: null,
};

type Row = {
  status: string;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  current_period_end: Date | null;
  canceled_at: Date | null;
};

function rowToSub(row: Row): Subscription {
  return {
    status: (row.status as SubscriptionStatus) ?? "inactive",
    paddleCustomerId: row.paddle_customer_id,
    paddleSubscriptionId: row.paddle_subscription_id,
    currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
    canceledAt: row.canceled_at?.toISOString() ?? null,
  };
}

/** Returns the user's subscription state, or INACTIVE if no row exists. */
export async function getSubscription(userId: string): Promise<Subscription> {
  const result = await pool.query<Row>(
    `SELECT status, paddle_customer_id, paddle_subscription_id, current_period_end, canceled_at
       FROM user_subscription
      WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return { ...INACTIVE };
  return rowToSub(result.rows[0]);
}

/**
 * Webhook entry point. Resolves a Paddle event into our internal user record
 * (by email or by paddle_customer_id) and upserts the subscription row.
 *
 * Returns true if a user was found and updated, false otherwise (so the
 * webhook handler can log unknown subscribers without failing).
 */
export async function upsertSubscriptionFromWebhook(args: {
  email: string | null;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null; // ISO
  canceledAt: string | null; // ISO
}): Promise<boolean> {
  // 1) Try to resolve user by paddle_customer_id (faster path for repeat events)
  let userRow:
    | { id: string }
    | undefined;

  if (args.paddleCustomerId) {
    const byCustomer = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM user_subscription WHERE paddle_customer_id = $1`,
      [args.paddleCustomerId]
    );
    if (byCustomer.rows[0]) userRow = { id: byCustomer.rows[0].user_id };
  }

  // 2) Fall back to looking up by email in the user table
  if (!userRow && args.email) {
    const byEmail = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [args.email]
    );
    if (byEmail.rows[0]) userRow = { id: byEmail.rows[0].id };
  }

  if (!userRow) return false;

  await pool.query(
    `INSERT INTO user_subscription
        (user_id, paddle_customer_id, paddle_subscription_id, status, current_period_end, canceled_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        paddle_customer_id = COALESCE(EXCLUDED.paddle_customer_id, user_subscription.paddle_customer_id),
        paddle_subscription_id = COALESCE(EXCLUDED.paddle_subscription_id, user_subscription.paddle_subscription_id),
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = NOW()`,
    [
      userRow.id,
      args.paddleCustomerId,
      args.paddleSubscriptionId,
      args.status,
      args.currentPeriodEnd,
      args.canceledAt,
    ]
  );
  return true;
}
