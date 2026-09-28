import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  cookieConsentRecord,
} from "@/lib/cookie-consent";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";
import { stubDatafastBrowser } from "./datafast-test-helpers";
import { billingUrlFromResponse, requestBillingUrl } from "./billing-client";

describe("billingUrlFromResponse", () => {
  it("returns the session URL", () => {
    expect(
      billingUrlFromResponse(
        200,
        '{"url":"https://checkout.stripe.test/session"}',
        "Checkout could not be started",
      ),
    ).toBe("https://checkout.stripe.test/session");
  });

  it("surfaces the server error message", () => {
    expect(() =>
      billingUrlFromResponse(
        503,
        '{"error":"Billing is temporarily unavailable"}',
        "Checkout could not be started",
      ),
    ).toThrow("Billing is temporarily unavailable");
  });

  it("does not surface a JSON parse error on an empty body", () => {
    // The /subscribe failure after magic-link sign-in: checkout threw,
    // production answered with an empty 500, and response.json() became
    // "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
    expect(() =>
      billingUrlFromResponse(500, "", "Checkout could not be started"),
    ).toThrow("Checkout could not be started");
  });

  it("does not surface a JSON parse error on HTML", () => {
    expect(() =>
      billingUrlFromResponse(
        502,
        "<html>Internal Server Error</html>",
        "Checkout could not be started",
      ),
    ).toThrow("Checkout could not be started");
  });
});

describe("requestBillingUrl", () => {
  let datafast = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires checkout_initiated only after checkout session creation succeeds", async () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(true),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => '{"url":"https://checkout.stripe.test/session"}',
      }),
    );

    const url = await requestBillingUrl("/api/billing/checkout");

    expect(url).toBe("https://checkout.stripe.test/session");
    expect(datafast).toHaveBeenCalledWith(DATAFAST_CHECKOUT_GOAL);
  });

  it("does not fire checkout_initiated when checkout creation fails", async () => {
    ({ datafast } = stubDatafastBrowser());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 503,
        text: async () => '{"error":"Billing is temporarily unavailable"}',
      }),
    );

    await expect(requestBillingUrl("/api/billing/checkout")).rejects.toThrow(
      "Billing is temporarily unavailable",
    );
    expect(datafast).not.toHaveBeenCalled();
  });
});
