import type Stripe from "stripe";
import {
  membershipCurrentPeriodEnd,
  normalizeStripeStatus,
  unixTimestampToIso,
} from "@/lib/billing";
import type { StripeSubscriptionSnapshot } from "@/lib/subscription";

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

export function snapshotStripeSubscription(
  subscription: Stripe.Subscription,
  annualPriceId: string,
): StripeSubscriptionSnapshot {
  return {
    metadataUserId: subscription.metadata.outpick_user_id || null,
    stripeCustomerId: customerIdOf(subscription),
    stripeSubscriptionId: subscription.id,
    status: normalizeStripeStatus(subscription.status),
    currentPeriodEnd: membershipCurrentPeriodEnd(subscription, annualPriceId),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: unixTimestampToIso(subscription.canceled_at),
    foundersOffer:
      subscription.metadata.founders_offer?.toLowerCase() === "true",
  };
}

