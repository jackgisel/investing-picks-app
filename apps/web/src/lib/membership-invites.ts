import Stripe from "stripe";
import { isSubscriptionEntitled, normalizeStripeStatus } from "@/lib/billing";
import { pool } from "@/lib/db";
import { sendMembershipInviteEmail } from "@/lib/email";
import {
  BOOTSTRAP_MEMBERSHIP_INVITES,
  membershipInviteUrl,
  normalizeInviteEmail,
} from "@/lib/membership-invite-format";
import {
  COMPLIMENTARY_COUPON_ID,
  isComplimentaryAccount,
} from "@/lib/stripe-checkout";

export type MembershipInvite = {
  email: string;
  name: string | null;
  note: string | null;
  createdAt: string;
  sentAt: string | null;
  invitedBy: string | null;
};

/** Where an invitee is in the funnel, for the admin list. */
export type MembershipInviteStatus = "invited" | "signed_up" | "active";

export type MembershipInviteWithStatus = MembershipInvite & {
  status: MembershipInviteStatus;
};

type Row = {
  email: string;
  name: string | null;
  note: string | null;
  created_at: Date;
  sent_at: Date | null;
  invited_by: string | null;
};

function toInvite(row: Row): MembershipInvite {
  return {
    email: row.email,
    name: row.name,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString() ?? null,
    invitedBy: row.invited_by,
  };
}

const COLUMNS = `email, name, note, created_at, sent_at, invited_by`;

export { BOOTSTRAP_MEMBERSHIP_INVITES, membershipInviteUrl, normalizeInviteEmail } from "@/lib/membership-invite-format";

export async function listMembershipInvites(): Promise<
  MembershipInviteWithStatus[]
> {
  // "user".email is stored as typed; invites are normalized. LOWER() on the
  // account side is what makes a mixed-case sign-up still match.
  const { rows } = await pool.query<
    Row & { has_account: boolean; subscription_status: string | null }
  >(
    `SELECT invite.email, invite.name, invite.note, invite.created_at,
            invite.sent_at, invite.invited_by,
            account.id IS NOT NULL AS has_account,
            subscription.status AS subscription_status
       FROM membership_invite AS invite
       LEFT JOIN "user" AS account ON LOWER(account.email) = invite.email
       LEFT JOIN user_subscription AS subscription
              ON subscription.user_id = account.id
      ORDER BY invite.created_at DESC`,
  );
  return rows.map((row) => ({
    ...toInvite(row),
    status:
      row.subscription_status &&
      isSubscriptionEntitled(normalizeStripeStatus(row.subscription_status))
        ? "active"
        : row.has_account
          ? "signed_up"
          : "invited",
  }));
}

export async function hasMembershipInvite(userEmail: string): Promise<boolean> {
  const email = normalizeInviteEmail(userEmail);
  if (!email) return false;
  const { rows } = await pool.query<{ email: string }>(
    `SELECT email FROM membership_invite WHERE email = $1`,
    [email],
  );
  return rows.length > 0;
}

export async function isComplimentaryInviteEmail(
  userEmail: string,
): Promise<boolean> {
  if (isComplimentaryAccount(userEmail, process.env.STRIPE_COMPLIMENTARY_EMAILS)) {
    return true;
  }
  return hasMembershipInvite(userEmail);
}

export async function seedBootstrapMembershipInvites(): Promise<void> {
  for (const invite of BOOTSTRAP_MEMBERSHIP_INVITES) {
    await pool.query(
      `INSERT INTO membership_invite (email, name, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [invite.email, invite.name, invite.note],
    );
  }
}

export async function upsertMembershipInvite(args: {
  email: string;
  name?: string | null;
  note?: string | null;
  invitedBy?: string | null;
}): Promise<MembershipInvite> {
  const email = normalizeInviteEmail(args.email);
  if (!email) {
    throw new Error("A valid email is required");
  }
  const name = args.name?.trim() || null;
  const note = args.note?.trim() || "Complimentary membership";
  const { rows } = await pool.query<Row>(
    `INSERT INTO membership_invite (email, name, note, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, membership_invite.name),
       note = COALESCE(EXCLUDED.note, membership_invite.note),
       invited_by = COALESCE(EXCLUDED.invited_by, membership_invite.invited_by)
     RETURNING ${COLUMNS}`,
    [email, name, note, args.invitedBy ?? null],
  );
  return toInvite(rows[0]);
}

export async function markMembershipInviteSent(email: string): Promise<void> {
  await pool.query(
    `UPDATE membership_invite SET sent_at = NOW() WHERE email = $1 AND sent_at IS NULL`,
    [email],
  );
}

export async function sendMembershipInvite(
  invite: Pick<MembershipInvite, "email" | "name">,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const result = await sendMembershipInviteEmail({
    to: invite.email,
    name: invite.name,
    inviteUrl: membershipInviteUrl(invite.email),
  });
  if (result.ok) {
    await markMembershipInviteSent(invite.email);
  }
  return result;
}

/**
 * Mail any invite that has not yet reached an inbox. Safe to call on every
 * cold start: a successful send stamps `sent_at`, and a failure leaves the
 * row unsent so the next boot retries.
 */
export async function flushPendingMembershipInvites(): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM membership_invite WHERE sent_at IS NULL ORDER BY created_at ASC`,
  );
  for (const row of rows) {
    const result = await sendMembershipInvite(toInvite(row));
    if (!result.ok) {
      console.error(
        `[membership-invite] failed to send to ${row.email}: ${result.error ?? "unknown"}`,
      );
    }
  }
}

function productIdOf(price: Stripe.Price): string | null {
  return typeof price.product === "string"
    ? price.product
    : price.product && !price.product.deleted
      ? price.product.id
      : null;
}

function isMissingCoupon(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}

/**
 * Returns the Coupon id to apply at complimentary Checkout.
 *
 * Uses `STRIPE_COMPLIMENTARY_COUPON_ID` when set. Otherwise retrieves or
 * creates the stable `outpick_complimentary` 100% forever Coupon, restricted
 * to the membership Product so it cannot discount anything else.
 */
export async function ensureComplimentaryCoupon(
  stripe: Stripe,
  annualPriceId: string,
): Promise<string> {
  const configured = process.env.STRIPE_COMPLIMENTARY_COUPON_ID?.trim();
  const couponId = configured || COMPLIMENTARY_COUPON_ID;
  try {
    await stripe.coupons.retrieve(couponId);
    return couponId;
  } catch (error) {
    if (!isMissingCoupon(error)) throw error;
    if (configured && configured !== COMPLIMENTARY_COUPON_ID) {
      throw error;
    }
  }

  const price = await stripe.prices.retrieve(annualPriceId, {
    expand: ["product"],
  });
  const productId = productIdOf(price);
  if (!productId) {
    throw new Error("Membership price is missing a Product");
  }

  try {
    await stripe.coupons.create({
      id: COMPLIMENTARY_COUPON_ID,
      percent_off: 100,
      duration: "forever",
      name: "Complimentary membership",
      applies_to: { products: [productId] },
      metadata: { outpick_offer: "complimentary" },
    });
  } catch (error) {
    // Two checkouts can race the create. The loser retrieves the winner.
    try {
      await stripe.coupons.retrieve(COMPLIMENTARY_COUPON_ID);
      return COMPLIMENTARY_COUPON_ID;
    } catch {
      throw error;
    }
  }
  return COMPLIMENTARY_COUPON_ID;
}
