import type Stripe from "stripe";

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

  return {
    mode: "subscription",
    customer: args.customerId,
    client_reference_id: args.userId,
    line_items: [{ price: args.annualPriceId, quantity: 1 }],
    ...(args.couponId
      ? { discounts: [{ coupon: args.couponId }] }
      : {}),
    automatic_tax: { enabled: args.automaticTax },
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    metadata,
    subscription_data: { metadata },
    success_url: new URL("/welcome?checkout=success", args.appUrl).toString(),
    cancel_url: new URL("/subscribe?checkout=canceled", args.appUrl).toString(),
  };
}
