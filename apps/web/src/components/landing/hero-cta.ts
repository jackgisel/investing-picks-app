import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";
import {
  isSubscriptionEntitled,
  type SubscriptionStatus,
} from "@/lib/billing";

/** Same destination as the header Dashboard control. */
export const HERO_DASHBOARD_HREF = "/dashboard";
export const HERO_MEMBERSHIP_HREF = "/subscribe";

export const HERO_DASHBOARD_LABEL = "Go to dashboard";
export const HERO_MEMBERSHIP_LABEL = "Start your membership";

export type HeroPrimaryCta = {
  href: string;
  label: string;
  /** Checkout conversion goal — omitted on the dashboard destination. */
  checkoutGoal?: string;
};

/**
 * Landing hero primary button. Paid membership (active / trialing / past_due)
 * replaces the membership CTA. Logged-out and unpaid signed-in visitors keep
 * the subscribe path. Login alone is not enough.
 */
export function heroPrimaryCta(
  status: SubscriptionStatus | null | undefined,
): HeroPrimaryCta {
  if (status && isSubscriptionEntitled(status)) {
    return {
      href: HERO_DASHBOARD_HREF,
      label: HERO_DASHBOARD_LABEL,
    };
  }
  return {
    href: HERO_MEMBERSHIP_HREF,
    label: HERO_MEMBERSHIP_LABEL,
    checkoutGoal: DATAFAST_CHECKOUT_GOAL,
  };
}
