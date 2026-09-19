import type Stripe from "stripe";
import { datafastCheckoutMetadata } from "@/lib/datafast";

export type CheckoutOffer =
  | "standard"
  | "founders"
  | "production_test"
  | "complimentary";

/** Stable Coupon id created on first complimentary checkout if none is configured. */
export const COMPLIMENTARY_COUPON_ID = "outpick_complimentary";

export function automaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX_ENABLED?.trim().toLowerCase() === "true";
}

export function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isProductionTestAccount(
  userEmail: string,
  configuredEmail: string | undefined,
): boolean {
  const allowlisted = configuredEmail?.trim().toLowerCase();
  return Boolean(allowlisted) && userEmail.trim().toLowerCase() === allowlisted;
}

export function isComplimentaryAccount(
  userEmail: string,
  configuredEmails: string | undefined,
): boolean {
  const email = userEmail.trim().toLowerCase();
  return Boolean(email) && parseEmailList(configuredEmails).includes(email);
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
  // Production-test consumes the founders benefit so a smoke-test account
  // cannot claim a second discounted first year later. Complimentary is a
  // separate grant and must not burn that one-time offer.
  const consumesFoundersOffer = args.offer === "founders" || args.offer === "production_test";
  const complimentary = args.offer === "complimentary";
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
    // 100% off forever still creates a subscription. Without this, Checkout
    // demands a card for a $0 invoice.
    ...(complimentary
      ? { payment_method_collection: "if_required" as const }
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
    billing_address_collection: complimentary ? "auto" : "required",
    // DataFast cookies must not appear here. They change between retries while
    // the idempotency key stays `outpick-checkout-v2-${user}-${offer}` for 24
    // hours, which is what 502'd Start membership after the first session
    // already existed. Attach them with `checkoutDatafastUpdate` after create.
    metadata,
    subscription_data: { metadata },
    success_url: checkoutSuccessUrl(args.appUrl),
    cancel_url: new URL("/subscribe?checkout=canceled", args.appUrl).toString(),
  };
}

export function checkoutDatafastUpdate(args: {
  visitorId?: string | null;
  sessionId?: string | null;
}): Stripe.Checkout.SessionUpdateParams | null {
  const metadata = datafastCheckoutMetadata(args);
  if (Object.keys(metadata).length === 0) return null;
  return { metadata };
}

export function findReusableCheckoutSession(
  sessions: ReadonlyArray<
    Pick<Stripe.Checkout.Session, "id" | "url" | "metadata">
  >,
  offer: CheckoutOffer,
): { id: string; url: string } | null {
  for (const session of sessions) {
    if (session.metadata?.offer_type === offer && session.url) {
      return { id: session.id, url: session.url };
    }
  }
  return null;
}

export function isCheckoutIdempotencyMismatch(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return message.includes(
    "Keys for idempotent requests can only be used with the same parameters",
  );
}

export function checkoutSuccessUrl(appUrl: URL): string {
  // Stripe substitutes the literal `{CHECKOUT_SESSION_ID}` token. The URL
  // constructor would percent-encode the braces and the substitution would
  // not run.
  return `${new URL("/welcome?checkout=success", appUrl).toString()}&session_id={CHECKOUT_SESSION_ID}`;
}
