import crypto from "crypto";

/**
 * Paddle Billing webhook signature verification.
 *
 * Paddle sends `paddle-signature: ts=<unix-seconds>;h1=<hex-hmac>` and signs
 * the string `${ts}:${rawBody}` — NOT the body alone. Signing the body alone
 * means no genuine webhook ever verifies, so a customer pays and never gets
 * access.
 *
 * https://developer.paddle.com/webhooks/signature-verification
 */

/** How far out of date a signature may be before we reject it as a replay. */
export const DEFAULT_MAX_AGE_SECONDS = 5 * 60;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

type ParsedSignature = { ts: string; h1: string };

/** Parse `ts=...;h1=...`. Order-independent; unknown parts are ignored. */
export function parsePaddleSignature(header: string): ParsedSignature | null {
  let ts: string | undefined;
  let h1: string | undefined;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "h1") h1 = value;
  }

  if (!ts || !h1) return null;
  if (!/^\d+$/.test(ts)) return null;
  if (!/^[0-9a-f]+$/i.test(h1)) return null;
  return { ts, h1 };
}

/**
 * Constant-time hex comparison.
 *
 * `crypto.timingSafeEqual` THROWS when the buffers differ in length, which
 * would turn a malformed signature into a 500 instead of a clean rejection.
 */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Paddle webhook. Fails closed: a missing secret or missing signature
 * is a rejection, never a bypass.
 */
export function verifyPaddleWebhook(args: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string | null | undefined;
  maxAgeSeconds?: number;
  nowSeconds?: number;
}): VerifyResult {
  const { rawBody, signatureHeader, secret } = args;
  const maxAge = args.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!secret || !secret.trim()) {
    return { ok: false, reason: "PADDLE_WEBHOOK_SECRET is not configured" };
  }
  if (!signatureHeader) {
    return { ok: false, reason: "Missing paddle-signature header" };
  }

  const parsed = parsePaddleSignature(signatureHeader);
  if (!parsed) {
    return { ok: false, reason: "Malformed paddle-signature header" };
  }

  const age = now - Number(parsed.ts);
  if (!Number.isFinite(age) || Math.abs(age) > maxAge) {
    return { ok: false, reason: "Signature timestamp outside the allowed window" };
  }

  // The signed payload is the timestamp and the body, colon-separated.
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.ts}:${rawBody}`)
    .digest("hex");

  if (!safeEqualHex(parsed.h1, expected)) {
    return { ok: false, reason: "Signature mismatch" };
  }
  return { ok: true };
}

/** Build a valid signature header. Test helper — mirrors what Paddle sends. */
export function signPaddlePayload(
  rawBody: string,
  secret: string,
  tsSeconds: number
): string {
  const ts = String(tsSeconds);
  const h1 = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");
  return `ts=${ts};h1=${h1}`;
}
