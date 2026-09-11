import type Stripe from "stripe";
import { datafastCheckoutMetadata } from "@/lib/datafast";

export type CheckoutOffer = "standard" | "founders" | "production_test";

export function automaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX_ENABLED?.trim().toLowerCase() === "true";
}

export function isProductionTestAccount(
  userEmail: string,
  configuredEmail: string | undefined,
): boolean {
  const allowlisted = configuredEmail?.trim().toLowerCase();
  return Boolean(allowlisted) && userEmail.trim().toLowerCase() === allowlisted;
}

export function buildCheckoutParams(args: {
  appUrl: URL;
  userId: string;
  customerId: string;
  annualPriceId: string;
  couponId: string | null;
  offer: CheckoutOffer;
  automaticTax: boolean;
  datafastVisitorId?: string | null;
  datafastSessionId?: string | null;
}): Stripe.Checkout.SessionCreateParams {
  // The temporary production-test discount consumes the same one-time account
  // benefit as the founders offer. This prevents the smoke-test account from
  // claiming a second discounted first year later.
  const consumesFoundersOffer = args.offer !== "standard";
  const metadata = {
    outpick_user_id: args.userId,
    founders_offer: consumesFoundersOffer ? "true" : "false",
    offer_type: args.offer,
  };
  // Visitor/session ids belong on the Checkout Session only. Copying them onto
  // the Subscription would persist marketing cookies on a long-lived object.
  const sessionMetadata = {
    ...metadata,
    ...datafastCheckoutMetadata({
      visitorId: args.datafastVisitorId,
      sessionId: args.datafastSessionId,
    }),
  };

  return {
    mode: "subscription",
    customer: args.customerId,
    client_reference_id: args.userId,
    line_items: [{ price: args.annualPriceId, quantity: 1 }],
    ...(args.couponId
      ? { discounts: [{ coupon: args.couponId }] }
      : {}),
    // Never send `automatic_tax: { enabled: false }`. Accounts with Stripe
    // Managed Payments (the Dashboard default) reject that combination, which
    // is what blocked /subscribe after sign-up. Omitting the field lets the
    // account default apply; Managed Payments then handles tax itself.
    // `customer_update` is also unsupported on Managed Payments sessions.
    ...(args.automaticTax
      ? {
          automatic_tax: { enabled: true as const },
          customer_update: { address: "auto" as const, name: "auto" as const },
        }
      : {}),
    billing_address_collection: "required",
    metadata: sessionMetadata,
    subscription_data: { metadata },
    success_url: new URL("/welcome?checkout=success", args.appUrl).toString(),
    cancel_url: new URL("/subscribe?checkout=canceled", args.appUrl).toString(),
  };
}
