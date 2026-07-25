/**
 * Paddle webhook signature verification tests.
 *
 * Run from apps/web:  node scripts/test-paddle-webhook.mjs
 *
 * Kept as a standalone script because the web app has no JS test runner
 * configured. Mirrors src/lib/paddle-webhook.ts — if you change the
 * verification logic, change it here too.
 */
import crypto from "crypto";
import assert from "assert";

const DEFAULT_MAX_AGE_SECONDS = 5 * 60;

function parsePaddleSignature(header) {
  let ts, h1;
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

function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPaddleWebhook({
  rawBody,
  signatureHeader,
  secret,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!secret || !secret.trim())
    return { ok: false, reason: "PADDLE_WEBHOOK_SECRET is not configured" };
  if (!signatureHeader)
    return { ok: false, reason: "Missing paddle-signature header" };
  const parsed = parsePaddleSignature(signatureHeader);
  if (!parsed) return { ok: false, reason: "Malformed paddle-signature header" };
  const age = nowSeconds - Number(parsed.ts);
  if (!Number.isFinite(age) || Math.abs(age) > maxAgeSeconds)
    return { ok: false, reason: "Signature timestamp outside the allowed window" };
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.ts}:${rawBody}`)
    .digest("hex");
  if (!safeEqualHex(parsed.h1, expected))
    return { ok: false, reason: "Signature mismatch" };
  return { ok: true };
}

function signPaddlePayload(rawBody, secret, tsSeconds) {
  const ts = String(tsSeconds);
  const h1 = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");
  return `ts=${ts};h1=${h1}`;
}

// ---------------------------------------------------------------------------

const SECRET = "pdl_ntfset_test_secret_value";
const NOW = 1_800_000_000;
const BODY = JSON.stringify({
  event_type: "subscription.activated",
  data: { id: "sub_123", status: "active", customer: { email: "a@b.com" } },
});

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
};

console.log("paddle webhook signature verification");

check("accepts a correctly signed Paddle payload", () => {
  const header = signPaddlePayload(BODY, SECRET, NOW);
  const r = verifyPaddleWebhook({
    rawBody: BODY,
    signatureHeader: header,
    secret: SECRET,
    nowSeconds: NOW,
  });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
});

check("rejects the old body-only signing scheme (the original bug)", () => {
  const h1 = crypto.createHmac("sha256", SECRET).update(BODY).digest("hex");
  const r = verifyPaddleWebhook({
    rawBody: BODY,
    signatureHeader: `ts=${NOW};h1=${h1}`,
    secret: SECRET,
    nowSeconds: NOW,
  });
  assert.strictEqual(r.ok, false);
});

check("rejects a tampered body", () => {
  const header = signPaddlePayload(BODY, SECRET, NOW);
  const tampered = BODY.replace("a@b.com", "attacker@evil.com");
  const r = verifyPaddleWebhook({
    rawBody: tampered,
    signatureHeader: header,
    secret: SECRET,
    nowSeconds: NOW,
  });
  assert.strictEqual(r.ok, false);
});

check("rejects a wrong secret", () => {
  const header = signPaddlePayload(BODY, "other_secret", NOW);
  const r = verifyPaddleWebhook({
    rawBody: BODY,
    signatureHeader: header,
    secret: SECRET,
    nowSeconds: NOW,
  });
  assert.strictEqual(r.ok, false);
});

check("rejects a stale timestamp (replay)", () => {
  const header = signPaddlePayload(BODY, SECRET, NOW - 3600);
  const r = verifyPaddleWebhook({
    rawBody: BODY,
    signatureHeader: header,
    secret: SECRET,
    nowSeconds: NOW,
  });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /window/);
});

check("FAILS CLOSED when no secret is configured", () => {
  const header = signPaddlePayload(BODY, SECRET, NOW);
  for (const secret of [undefined, null, "", "   "]) {
    const r = verifyPaddleWebhook({
      rawBody: BODY,
      signatureHeader: header,
      secret,
      nowSeconds: NOW,
    });
    assert.strictEqual(r.ok, false, `secret=${JSON.stringify(secret)}`);
  }
});

check("FAILS CLOSED when the signature header is absent", () => {
  for (const header of [undefined, null, ""]) {
    const r = verifyPaddleWebhook({
      rawBody: BODY,
      signatureHeader: header,
      secret: SECRET,
      nowSeconds: NOW,
    });
    assert.strictEqual(r.ok, false);
  }
});

check("returns false (does not throw) on malformed signatures", () => {
  const headers = [
    "garbage",
    "ts=;h1=",
    "h1=abc",
    `ts=${NOW}`,
    `ts=${NOW};h1=nothex!!`,
    `ts=notanumber;h1=abcdef`,
    `ts=${NOW};h1=ab`, // valid hex, wrong length — would throw in timingSafeEqual
  ];
  for (const h of headers) {
    const r = verifyPaddleWebhook({
      rawBody: BODY,
      signatureHeader: h,
      secret: SECRET,
      nowSeconds: NOW,
    });
    assert.strictEqual(r.ok, false, `header=${h}`);
  }
});

check("tolerates parameter order and extra parts", () => {
  const ts = String(NOW);
  const h1 = crypto
    .createHmac("sha256", SECRET)
    .update(`${ts}:${BODY}`)
    .digest("hex");
  const r = verifyPaddleWebhook({
    rawBody: BODY,
    signatureHeader: `h1=${h1};ts=${ts};foo=bar`,
    secret: SECRET,
    nowSeconds: NOW,
  });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
});

console.log(
  process.exitCode ? "\nFAILED" : `\nall ${passed} checks passed`
);
