import type Stripe from "stripe";
import { isSubscriptionEntitled, normalizeStripeStatus } from "@/lib/billing";
import {
  ensureComplimentaryCoupon,
  isComplimentaryInviteEmail,
} from "@/lib/membership-invites";
import { getStripe } from "@/lib/stripe";
import { buildComplimentarySubscriptionParams } from "@/lib/stripe-checkout";
import { snapshotStripeSubscription } from "@/lib/stripe-webhook";
import {
  getSubscriptionRecord,
  saveStripeCustomer,
  syncStripeSubscription,
} from "@/lib/subscription";

export type ComplimentaryGrantResult =
  | "granted"
  | "already_active"
  | "not_invited"
  | "unavailable";

/**
 * Create the $0 Subscription and record it locally in the same request, so
 * the invitee is a member the moment this returns rather than when the
 * webhook lands. The webhook still arrives and converges on the same row; it
 * is also what sends the membership welcome email.
 *
 * The idempotency key is per user AND Customer: a double sign-in or a racing
 * /subscribe replays the first create instead of making a second Subscription,
 * while a replaced Customer still gets a fresh one.
 */
export async function createComplimentarySubscription(
  stripe: Stripe,
  args: { userId: string; customerId: string; annualPriceId: string },
): Promise<void> {
  const couponId = await ensureComplimentaryCoupon(stripe, args.annualPriceId);
  const subscription = await stripe.subscriptions.create(
    buildComplimentarySubscriptionParams({ ...args, couponId }),
    {
      idempotencyKey: `outpick-complimentary-v1-${args.userId}-${args.customerId}`,
    },
  );
  await syncStripeSubscription(
    snapshotStripeSubscription(subscription, args.annualPriceId),
  );
}

/**
 * Turn an admin invite into a live membership with no action from the
 * invitee beyond signing in. Called on every new session (lib/auth.ts), so it
 * is cheap for everyone who is not invited: one indexed lookup, no Stripe.
 *
 * The grant is keyed to a proven inbox. Magic-link sign-in is the proof, and
 * `emailVerified` is checked anyway so an invite can never be claimed by
 * someone who merely typed the address.
 */
export async function grantComplimentaryMembership(user: {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}): Promise<ComplimentaryGrantResult> {
  if (!user.emailVerified) return "not_invited";
  if (!(await isComplimentaryInviteEmail(user.email))) return "not_invited";

  const stripe = getStripe();
  const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID?.trim();
  if (!stripe || !annualPriceId) return "unavailable";

  const record = await getSubscriptionRecord(user.id);
  if (isSubscriptionEntitled(record.status)) return "already_active";

  let customerId = record.stripeCustomerId;
  if (customerId) {
    const existing = await stripe.customers.retrieve(customerId);
    if (existing.deleted) {
      customerId = null;
    } else {
      // Stripe is the source of truth ahead of a delayed webhook, same as
      // checkout: never stack a second Subscription on a live one.
      const current = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      if (
        current.data.some((candidate) =>
          isSubscriptionEntitled(normalizeStripeStatus(candidate.status)),
        )
      ) {
        return "already_active";
      }
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: user.email,
        name: user.name ?? undefined,
        metadata: { outpick_user_id: user.id },
      },
      { idempotencyKey: `outpick-complimentary-customer-v1-${user.id}` },
    );
    customerId = customer.id;
    await saveStripeCustomer(user.id, customerId);
  }

  await createComplimentarySubscription(stripe, {
    userId: user.id,
    customerId,
    annualPriceId,
  });
  return "granted";
}
