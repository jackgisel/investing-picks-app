export const DEFAULT_GOOGLE_ADS_ID = "AW-967967302";
export const DEFAULT_GOOGLE_ADS_SEND_TO = "AW-967967302/0AqvCL3y2vYcEMaEyM0D";
export const GOOGLE_ADS_FALLBACK_VALUE = 250;
export const GOOGLE_ADS_CURRENCY = "USD";
export const GOOGLE_ADS_CONVERSION_STORAGE_PREFIX =
  "outpick:google-ads-conversion:";

const MEASUREMENT_ID_PATTERN = /^AW-[0-9]+$/;
const SEND_TO_PATTERN = /^AW-[0-9]+\/[A-Za-z0-9_-]+$/;
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test_|live_)?[A-Za-z0-9]+$/;

export type GoogleAdsConversionEvent = {
  sendTo: string;
  value: number;
  currency: typeof GOOGLE_ADS_CURRENCY;
  transactionId: string;
};

type CheckoutSessionLike = {
  id: string;
  status: string | null;
  payment_status: string | null;
  amount_total?: number | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_intent?: string | { id?: string | null } | null;
};

function readPublicSetting(
  raw: string | undefined,
  fallback: string,
): string | null {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const disabled = trimmed.toLowerCase();
  if (disabled === "off" || disabled === "false" || disabled === "0") {
    return null;
  }
  return trimmed;
}

export function googleAdsMeasurementId(
  raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
): string | null {
  const value = readPublicSetting(raw, DEFAULT_GOOGLE_ADS_ID);
  if (!value || !MEASUREMENT_ID_PATTERN.test(value)) return null;
  return value;
}

export function googleAdsConversionSendTo(
  raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO,
): string | null {
  if (!googleAdsMeasurementId()) return null;
  const value = readPublicSetting(raw, DEFAULT_GOOGLE_ADS_SEND_TO);
  if (!value || !SEND_TO_PATTERN.test(value)) return null;
  return value;
}

export function parseCheckoutSessionId(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || !CHECKOUT_SESSION_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function conversionValueFromAmountTotal(
  amountTotal: number | null | undefined,
): number {
  if (typeof amountTotal !== "number" || !Number.isFinite(amountTotal)) {
    return GOOGLE_ADS_FALLBACK_VALUE;
  }
  return amountTotal / 100;
}

export function transactionIdFromSession(session: {
  id: string;
  payment_intent?: string | { id?: string | null } | null;
}): string {
  if (session.id) return session.id;
  const intent = session.payment_intent;
  if (typeof intent === "string" && intent.startsWith("pi_")) return intent;
  if (
    intent &&
    typeof intent === "object" &&
    typeof intent.id === "string" &&
    intent.id.startsWith("pi_")
  ) {
    return intent.id;
  }
  return "";
}

export function checkoutSessionBelongsToUser(
  session: Pick<CheckoutSessionLike, "client_reference_id" | "metadata">,
  userId: string,
): boolean {
  return (
    session.client_reference_id === userId ||
    session.metadata?.outpick_user_id === userId
  );
}

export function isSuccessfulCheckoutSession(
  session: Pick<CheckoutSessionLike, "status" | "payment_status">,
): boolean {
  if (session.status !== "complete") return false;
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  );
}

export function googleAdsConversionFromSession(
  session: CheckoutSessionLike,
  userId: string,
  sendTo = googleAdsConversionSendTo(),
): GoogleAdsConversionEvent | null {
  if (!sendTo) return null;
  if (!checkoutSessionBelongsToUser(session, userId)) return null;
  if (!isSuccessfulCheckoutSession(session)) return null;
  const transactionId = transactionIdFromSession(session);
  if (!transactionId) return null;
  return {
    sendTo,
    value: conversionValueFromAmountTotal(session.amount_total),
    currency: GOOGLE_ADS_CURRENCY,
    transactionId,
  };
}

export function googleAdsConversionParams(event: GoogleAdsConversionEvent) {
  return {
    send_to: event.sendTo,
    value: event.value,
    currency: event.currency,
    transaction_id: event.transactionId,
  };
}

export function googleAdsConversionStorageKey(transactionId: string): string {
  return `${GOOGLE_ADS_CONVERSION_STORAGE_PREFIX}${transactionId}`;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
