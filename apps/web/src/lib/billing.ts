import type Stripe from "stripe";

export const STRIPE_SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type StripeSubscriptionStatus =
  (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];
export type SubscriptionStatus = StripeSubscriptionStatus | "inactive";

const STATUS_SET = new Set<string>(STRIPE_SUBSCRIPTION_STATUSES);
const ENTITLED = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
]);

export function normalizeStripeStatus(raw: unknown): SubscriptionStatus {
  return typeof raw === "string" && STATUS_SET.has(raw)
    ? (raw as StripeSubscriptionStatus)
    : "inactive";
}

export function isSubscriptionEntitled(status: SubscriptionStatus): boolean {
  return ENTITLED.has(status);
}

export function isFoundersOfferEligible(args: {
  foundersWindowActive: boolean;
  redeemedAt: Date | string | null;
}): boolean {
  return args.foundersWindowActive && args.redeemedAt === null;
}

/**
 * Clover moved renewal timestamps from Subscription to SubscriptionItem.
 * Only the configured membership Price is authoritative; unrelated items do
 * not get to extend membership access.
 */
export function membershipCurrentPeriodEnd(
  subscription: Pick<Stripe.Subscription, "items">,
  annualPriceId: string,
): string | null {
  const item = subscription.items.data.find(
    (candidate) => candidate.price.id === annualPriceId,
  );
  return item
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;
}

export function unixTimestampToIso(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

