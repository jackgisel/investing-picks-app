import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GOOGLE_ADS_ID,
  DEFAULT_GOOGLE_ADS_SEND_TO,
  GOOGLE_ADS_FALLBACK_VALUE,
  conversionValueFromAmountTotal,
  googleAdsConversionFromSession,
  googleAdsConversionParams,
  googleAdsConversionSendTo,
  googleAdsConversionStorageKey,
  googleAdsMeasurementId,
  parseCheckoutSessionId,
  transactionIdFromSession,
} from "./google-ads";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");

const paidSession = {
  id: "cs_test_abc123",
  status: "complete",
  payment_status: "paid",
  amount_total: 19_900,
  client_reference_id: "user_1",
  metadata: { outpick_user_id: "user_1" },
  payment_intent: null,
};

describe("Google Ads public config", () => {
  const previousId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const previousSendTo = process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO;

  afterEach(() => {
    if (previousId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    else process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = previousId;
    if (previousSendTo === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO = previousSendTo;
    }
  });

  it("defaults to the production measurement id and send_to", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO;
    expect(googleAdsMeasurementId()).toBe(DEFAULT_GOOGLE_ADS_ID);
    expect(googleAdsConversionSendTo()).toBe(DEFAULT_GOOGLE_ADS_SEND_TO);
  });

  it("treats an empty env value as the production default", () => {
    expect(googleAdsMeasurementId("")).toBe(DEFAULT_GOOGLE_ADS_ID);
    expect(googleAdsConversionSendTo("   ")).toBe(DEFAULT_GOOGLE_ADS_SEND_TO);
  });

  it("disables the tag when the measurement id is off", () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "off";
    expect(googleAdsMeasurementId()).toBeNull();
    expect(googleAdsConversionSendTo()).toBeNull();
  });

  it("rejects malformed ids rather than injecting them", () => {
    expect(googleAdsMeasurementId("G-XXXX")).toBeNull();
    expect(googleAdsConversionSendTo("AW-1")).toBeNull();
  });
});

describe("Checkout conversion payload", () => {
  it("parses live and test Checkout Session ids", () => {
    expect(parseCheckoutSessionId(" cs_test_abc123 ")).toBe("cs_test_abc123");
    expect(parseCheckoutSessionId("cs_live_xyz")).toBe("cs_live_xyz");
    expect(parseCheckoutSessionId("cs_abc")).toBe("cs_abc");
    expect(parseCheckoutSessionId("session_1")).toBeNull();
    expect(parseCheckoutSessionId("cs_test_abc-123")).toBeNull();
  });

  it("uses Stripe amount_total in dollars and falls back only when missing", () => {
    expect(conversionValueFromAmountTotal(25_000)).toBe(250);
    expect(conversionValueFromAmountTotal(1_00)).toBe(1);
    expect(conversionValueFromAmountTotal(0)).toBe(0);
    expect(conversionValueFromAmountTotal(null)).toBe(GOOGLE_ADS_FALLBACK_VALUE);
    expect(conversionValueFromAmountTotal(undefined)).toBe(
      GOOGLE_ADS_FALLBACK_VALUE,
    );
  });

  it("uses the Checkout Session id, falling back to a Payment Intent id", () => {
    expect(transactionIdFromSession(paidSession)).toBe("cs_test_abc123");
    expect(
      transactionIdFromSession({
        ...paidSession,
        payment_intent: "pi_abc",
      }),
    ).toBe("cs_test_abc123");
    expect(
      transactionIdFromSession({
        id: "",
        payment_intent: "pi_abc",
      }),
    ).toBe("pi_abc");
    expect(
      transactionIdFromSession({
        id: "",
        payment_intent: { id: "pi_expanded" },
      }),
    ).toBe("pi_expanded");
  });

  it("builds a conversion only for this user's successful Checkout Session", () => {
    expect(
      googleAdsConversionFromSession(paidSession, "user_1", DEFAULT_GOOGLE_ADS_SEND_TO),
    ).toEqual({
      sendTo: DEFAULT_GOOGLE_ADS_SEND_TO,
      value: 199,
      currency: "USD",
      transactionId: "cs_test_abc123",
    });
    expect(
      googleAdsConversionFromSession(paidSession, "user_other", DEFAULT_GOOGLE_ADS_SEND_TO),
    ).toBeNull();
    expect(
      googleAdsConversionFromSession(
        { ...paidSession, status: "open" },
        "user_1",
        DEFAULT_GOOGLE_ADS_SEND_TO,
      ),
    ).toBeNull();
    expect(
      googleAdsConversionFromSession(
        { ...paidSession, amount_total: null },
        "user_1",
        DEFAULT_GOOGLE_ADS_SEND_TO,
      ),
    ).toMatchObject({ value: GOOGLE_ADS_FALLBACK_VALUE });
    expect(
      googleAdsConversionFromSession(
        {
          ...paidSession,
          payment_status: "no_payment_required",
          amount_total: 0,
        },
        "user_1",
        DEFAULT_GOOGLE_ADS_SEND_TO,
      ),
    ).toMatchObject({ value: 0, transactionId: "cs_test_abc123" });
  });

  it("keeps the gtag conversion parameter names Google Ads expects", () => {
    expect(
      googleAdsConversionParams({
        sendTo: DEFAULT_GOOGLE_ADS_SEND_TO,
        value: 250,
        currency: "USD",
        transactionId: "cs_test_abc123",
      }),
    ).toEqual({
      send_to: DEFAULT_GOOGLE_ADS_SEND_TO,
      value: 250,
      currency: "USD",
      transaction_id: "cs_test_abc123",
    });
    expect(googleAdsConversionStorageKey("cs_test_abc123")).toBe(
      "outpick:google-ads-conversion:cs_test_abc123",
    );
  });
});

describe("Google Ads is loaded once from the root layout", () => {
  it("puts the Google tag in <head> as real script tags", () => {
    const layout = readFileSync(join(webRoot, "src/app/layout.tsx"), "utf8");
    const script = readFileSync(
      join(webRoot, "src/components/layout/google-ads-script.tsx"),
      "utf8",
    );
    const welcome = readFileSync(join(webRoot, "src/app/welcome/page.tsx"), "utf8");
    const thankYou = readFileSync(
      join(webRoot, "src/app/welcome/welcome-experience.tsx"),
      "utf8",
    );
    const conversion = readFileSync(
      join(webRoot, "src/components/layout/google-ads-conversion.tsx"),
      "utf8",
    );
    const head = layout.slice(
      layout.indexOf("<head>"),
      layout.indexOf("</head>"),
    );
    expect(head).toContain("<GoogleAdsScript />");
    expect(layout.slice(layout.indexOf("<body"))).not.toContain(
      "<GoogleAdsScript />",
    );
    expect(script).toContain(
      "https://www.googletagmanager.com/gtag/js?id=${id}",
    );
    expect(script).not.toContain('from "next/script"');
    expect(script).not.toContain("afterInteractive");
    expect(conversion).toContain("gtag('event', 'conversion'");
    expect(welcome).toContain("GoogleAdsConversion");
    expect(welcome).toContain("welcomeLoginNext");
    expect(welcome).not.toContain("GoogleAdsScript");
    expect(thankYou).not.toContain("gtag");
    expect(thankYou).not.toContain("googletagmanager");
  });
});
