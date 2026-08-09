import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-02-25.clover" as const;

let stripe: Stripe | null = null;

/** Server-only Stripe client. Callers must handle missing configuration. */
export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  stripe ??= new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  return stripe;
}

