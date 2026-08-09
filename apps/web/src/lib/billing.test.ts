import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  isFoundersOfferEligible,
  isSubscriptionEntitled,
  membershipCurrentPeriodEnd,
  normalizeStripeStatus,
} from "./billing";
import { isSameOriginBrowserPost } from "./billing-security";
import {
  buildCheckoutParams,
  isProductionTestAccount,
} from "./stripe-checkout";
import { snapshotStripeSubscription } from "./stripe-webhook";

function stripeSubscription(over: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    metadata: { outpick_user_id: "user_1", founders_offer: "true" },
    items: {
      data: [
        {
          price: { id: "price_membership" },
          current_period_end: 1_800_000_000,
        },
      ],
    },
    ...over,
  } as Stripe.Subscription;
}

describe("Stripe subscription decisions", () => {
  it.each([
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ])("keeps the Stripe status %s", (status) => {
    expect(normalizeStripeStatus(status)).toBe(status);
  });

  it("normalizes unknown statuses to inactive", () => {
    expect(normalizeStripeStatus("mystery")).toBe("inactive");
    expect(normalizeStripeStatus(null)).toBe("inactive");
  });

  it.each(["active", "trialing", "past_due"] as const)(
    "entitles %s",
    (status) => expect(isSubscriptionEntitled(status)).toBe(true),
  );

  it.each([
    "inactive",
    "incomplete",
    "incomplete_expired",
    "canceled",
    "unpaid",
    "paused",
  ] as const)("does not entitle %s", (status) => {
    expect(isSubscriptionEntitled(status)).toBe(false);
  });

  it("allows the founders coupon only in-window and before redemption", () => {
    expect(
      isFoundersOfferEligible({ foundersWindowActive: true, redeemedAt: null }),
    ).toBe(true);
    expect(
      isFoundersOfferEligible({
        foundersWindowActive: true,
        redeemedAt: "2026-06-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isFoundersOfferEligible({ foundersWindowActive: false, redeemedAt: null }),
    ).toBe(false);
  });

  it("reads renewal from the configured membership item", () => {
    const subscription = stripeSubscription({
      items: {
        object: "list",
        url: "/v1/subscription_items",
        has_more: false,
        data: [
          {
            price: { id: "price_other" },
            current_period_end: 1_700_000_000,
          },
          {
            price: { id: "price_membership" },
            current_period_end: 1_800_000_000,
          },
        ],
      } as Stripe.ApiList<Stripe.SubscriptionItem>,
    });
    expect(membershipCurrentPeriodEnd(subscription, "price_membership")).toBe(
      "2027-01-15T08:00:00.000Z",
    );
    expect(membershipCurrentPeriodEnd(subscription, "price_missing")).toBeNull();
  });

  it("keeps scheduled cancellation active and records the period end", () => {
    const snapshot = snapshotStripeSubscription(
      stripeSubscription({ cancel_at_period_end: true }),
      "price_membership",
    );
    expect(snapshot).toMatchObject({
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2027-01-15T08:00:00.000Z",
    });
    expect(isSubscriptionEntitled(snapshot.status)).toBe(true);
  });

  it("treats terminal cancellation as not entitled", () => {
    const snapshot = snapshotStripeSubscription(
      stripeSubscription({
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: 1_800_000_001,
      }),
      "price_membership",
    );
    expect(snapshot.canceledAt).toBe("2027-01-15T08:00:01.000Z");
    expect(isSubscriptionEntitled(snapshot.status)).toBe(false);
  });
});

describe("Checkout parameters and browser origin", () => {
  const appUrl = new URL("https://outpick.xyz/base");

  it("builds only trusted redirects and a server-selected one-time coupon", () => {
    const params = buildCheckoutParams({
      appUrl,
      userId: "user_1",
      customerId: "cus_1",
      annualPriceId: "price_annual",
      couponId: "coupon_founders",
      offer: "founders",
      automaticTax: false,
    });
    expect(params).toMatchObject({
      mode: "subscription",
      customer: "cus_1",
      line_items: [{ price: "price_annual", quantity: 1 }],
      discounts: [{ coupon: "coupon_founders" }],
      automatic_tax: { enabled: false },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      metadata: {
        outpick_user_id: "user_1",
        founders_offer: "true",
        offer_type: "founders",
      },
      subscription_data: {
        metadata: {
          outpick_user_id: "user_1",
          founders_offer: "true",
          offer_type: "founders",
        },
      },
      success_url: "https://outpick.xyz/welcome?checkout=success",
      cancel_url: "https://outpick.xyz/subscribe?checkout=canceled",
    });
  });

  it("omits discounts after founders eligibility ends", () => {
    const params = buildCheckoutParams({
      appUrl,
      userId: "user_1",
      customerId: "cus_1",
      annualPriceId: "price_annual",
      couponId: null,
      offer: "standard",
      automaticTax: false,
    });
    expect(params).not.toHaveProperty("discounts");
    expect(params.metadata).toMatchObject({ founders_offer: "false" });
  });

  it("matches the production-test allowlist case-insensitively", () => {
    expect(
      isProductionTestAccount(
        " Second@Example.com ",
        "second@example.COM",
      ),
    ).toBe(true);
    expect(isProductionTestAccount("one@example.com", undefined)).toBe(false);
    expect(
      isProductionTestAccount("one@example.com", "two@example.com"),
    ).toBe(false);
  });

  it("accepts only same-origin POSTs", () => {
    const request = (method: string, origin?: string) => ({
      method,
      headers: new Headers(origin ? { origin } : {}),
    });
    expect(isSameOriginBrowserPost(request("POST", "https://outpick.xyz"), appUrl)).toBe(true);
    expect(isSameOriginBrowserPost(request("GET", "https://outpick.xyz"), appUrl)).toBe(false);
    expect(isSameOriginBrowserPost(request("POST", "https://evil.test"), appUrl)).toBe(false);
    expect(isSameOriginBrowserPost(request("POST"), appUrl)).toBe(false);
  });
});
