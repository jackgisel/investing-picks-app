import { pool } from "@/lib/db";
import {
  normalizeStripeStatus,
  type SubscriptionStatus,
} from "@/lib/billing";

export type Subscription = {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

export type SubscriptionRecord = Subscription & {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  foundersDiscountRedeemedAt: string | null;
};

const INACTIVE: SubscriptionRecord = {
  status: "inactive",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  foundersDiscountRedeemedAt: null,
};

type Row = {
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  founders_discount_redeemed_at: Date | null;
};

function rowToRecord(row: Row): SubscriptionRecord {
  return {
    status: normalizeStripeStatus(row.status),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at?.toISOString() ?? null,
    foundersDiscountRedeemedAt:
      row.founders_discount_redeemed_at?.toISOString() ?? null,
  };
}

export async function getSubscriptionRecord(
  userId: string,
): Promise<SubscriptionRecord> {
  const result = await pool.query<Row>(
    `SELECT status, stripe_customer_id, stripe_subscription_id,
            current_period_end, cancel_at_period_end, canceled_at,
            founders_discount_redeemed_at
       FROM user_subscription
      WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ? rowToRecord(result.rows[0]) : { ...INACTIVE };
}

/** Public subscription state. Provider identifiers never leave the server. */
export async function getSubscription(userId: string): Promise<Subscription> {
  const record = await getSubscriptionRecord(userId);
  return {
    status: record.status,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    canceledAt: record.canceledAt,
  };
}

/** Save the authenticated user-to-Customer mapping before Checkout redirects. */
export async function saveStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO user_subscription (user_id, stripe_customer_id, status, updated_at)
     VALUES ($1, $2, 'inactive', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = NOW()`,
    [userId, stripeCustomerId],
  );
}

/** Record only successfully acknowledged Stripe deliveries for auditability. */
export async function recordStripeWebhookEvent(
  eventId: string,
  eventType: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO stripe_webhook_event (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType],
  );
}

export type StripeSubscriptionSnapshot = {
  metadataUserId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  foundersOffer: boolean;
};

/**
 * Apply an already-retrieved Stripe snapshot. Metadata is the first trusted
 * mapping; the stored Customer ID is the fallback. There is deliberately no
 * email lookup, so a billing email can never grant another account access.
 */
export async function syncStripeSubscription(
  snapshot: StripeSubscriptionSnapshot,
): Promise<boolean> {
  let userId: string | null = null;

  if (snapshot.metadataUserId) {
    const byMetadata = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE id = $1 LIMIT 1`,
      [snapshot.metadataUserId],
    );
    userId = byMetadata.rows[0]?.id ?? null;
  }

  if (!userId) {
    const byCustomer = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM user_subscription WHERE stripe_customer_id = $1 LIMIT 1`,
      [snapshot.stripeCustomerId],
    );
    userId = byCustomer.rows[0]?.user_id ?? null;
  }

  if (!userId) return false;

  await pool.query(
    `INSERT INTO user_subscription
       (user_id, stripe_customer_id, stripe_subscription_id, status,
        current_period_end, cancel_at_period_end, canceled_at,
        founders_discount_redeemed_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             CASE WHEN $8 THEN NOW() ELSE NULL END, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       canceled_at = EXCLUDED.canceled_at,
       founders_discount_redeemed_at = CASE
         WHEN $8 THEN COALESCE(
           user_subscription.founders_discount_redeemed_at, NOW()
         )
         ELSE user_subscription.founders_discount_redeemed_at
       END,
       membership_welcome_email_claimed_at = CASE
         WHEN user_subscription.stripe_subscription_id IS DISTINCT FROM
              EXCLUDED.stripe_subscription_id THEN NULL
         ELSE user_subscription.membership_welcome_email_claimed_at
       END,
       membership_welcome_email_sent_at = CASE
         WHEN user_subscription.stripe_subscription_id IS DISTINCT FROM
              EXCLUDED.stripe_subscription_id THEN NULL
         ELSE user_subscription.membership_welcome_email_sent_at
       END,
       updated_at = NOW()`,
    [
      userId,
      snapshot.stripeCustomerId,
      snapshot.stripeSubscriptionId,
      snapshot.status,
      snapshot.currentPeriodEnd,
      snapshot.cancelAtPeriodEnd,
      snapshot.canceledAt,
      snapshot.foundersOffer && snapshot.status === "active",
    ],
  );
  return true;
}

export type MembershipWelcomeClaim = {
  userId: string;
  email: string;
  name: string | null;
};

/**
 * Atomically claim the membership welcome send for one active Subscription.
 * A stale claim is recoverable so an interrupted webhook worker cannot suppress
 * the email forever. Resend also receives a subscription-scoped idempotency key
 * as a second line of duplicate protection.
 */
export async function claimMembershipWelcomeEmail(
  stripeSubscriptionId: string,
): Promise<MembershipWelcomeClaim | null> {
  const result = await pool.query<{
    user_id: string;
    email: string;
    name: string | null;
  }>(
    `UPDATE user_subscription AS subscription
        SET membership_welcome_email_claimed_at = NOW(),
            updated_at = NOW()
       FROM "user" AS account
      WHERE subscription.stripe_subscription_id = $1
        AND subscription.user_id = account.id
        AND subscription.status = 'active'
        AND subscription.membership_welcome_email_sent_at IS NULL
        AND (
          subscription.membership_welcome_email_claimed_at IS NULL
          OR subscription.membership_welcome_email_claimed_at
             < NOW() - INTERVAL '10 minutes'
        )
      RETURNING subscription.user_id, account.email, account.name`,
    [stripeSubscriptionId],
  );
  const row = result.rows[0];
  return row
    ? { userId: row.user_id, email: row.email, name: row.name }
    : null;
}

export async function markMembershipWelcomeEmailSent(
  stripeSubscriptionId: string,
): Promise<void> {
  await pool.query(
    `UPDATE user_subscription
        SET membership_welcome_email_sent_at = NOW(),
            membership_welcome_email_claimed_at = NULL,
            updated_at = NOW()
      WHERE stripe_subscription_id = $1
        AND membership_welcome_email_sent_at IS NULL`,
    [stripeSubscriptionId],
  );
}

export async function releaseMembershipWelcomeEmailClaim(
  stripeSubscriptionId: string,
): Promise<void> {
  await pool.query(
    `UPDATE user_subscription
        SET membership_welcome_email_claimed_at = NULL,
            updated_at = NOW()
      WHERE stripe_subscription_id = $1
        AND membership_welcome_email_sent_at IS NULL`,
    [stripeSubscriptionId],
  );
}
