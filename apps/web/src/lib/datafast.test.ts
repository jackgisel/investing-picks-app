import { afterEach, describe, expect, it, vi } from "vitest";
import { stubDatafastBrowser } from "./datafast-test-helpers";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  cookieConsentRecord,
} from "@/lib/cookie-consent";
import {
  DATAFAST_CHECKOUT_GOAL,
  DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL,
  DATAFAST_SIGNUP_GOAL,
  DATAFAST_VIEW_PRICING_GOAL,
  datafastCheckoutMetadata,
  datafastDomain,
  sanitizeDatafastId,
  trackDatafastGoal,
} from "./datafast";

describe("DataFast identifiers", () => {
  it("uses the public site hostname", () => {
    expect(datafastDomain()).toBe("outpick.xyz");
  });

  it("rejects empty, oversized, or punctuated cookie values", () => {
    expect(sanitizeDatafastId(undefined)).toBeUndefined();
    expect(sanitizeDatafastId("  ")).toBeUndefined();
    expect(sanitizeDatafastId("vis id")).toBeUndefined();
    expect(sanitizeDatafastId("a".repeat(129))).toBeUndefined();
    expect(sanitizeDatafastId("vis_1-abc")).toBe("vis_1-abc");
  });

  it("omits missing cookies from Checkout metadata", () => {
    expect(datafastCheckoutMetadata({})).toEqual({});
    expect(
      datafastCheckoutMetadata({ visitorId: "  ", sessionId: "bad value" }),
    ).toEqual({});
  });

  it("forwards only sanitized visitor and session ids", () => {
    expect(
      datafastCheckoutMetadata({
        visitorId: " vis_abc ",
        sessionId: "ses_123",
      }),
    ).toEqual({
      datafast_visitor_id: "vis_abc",
      datafast_session_id: "ses_123",
    });
  });
});

describe("trackDatafastGoal", () => {
  let datafast = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records signup when analytics cookies are accepted", () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(true),
    );

    trackDatafastGoal(DATAFAST_SIGNUP_GOAL);

    expect(datafast).toHaveBeenCalledWith(DATAFAST_SIGNUP_GOAL);
  });

  it("records newsletter_subscribe with optional params", () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(true),
    );

    trackDatafastGoal(DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL, {
      source: "landing-hero",
    });

    expect(datafast).toHaveBeenCalledWith(DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL, {
      source: "landing-hero",
    });
  });

  it("records checkout_initiated and view_pricing goals", () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(true),
    );

    trackDatafastGoal(DATAFAST_CHECKOUT_GOAL);
    trackDatafastGoal(DATAFAST_VIEW_PRICING_GOAL);

    expect(datafast).toHaveBeenCalledWith(DATAFAST_CHECKOUT_GOAL);
    expect(datafast).toHaveBeenCalledWith(DATAFAST_VIEW_PRICING_GOAL);
  });

  it("does not call DataFast when consent was declined", () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(false),
    );

    trackDatafastGoal(DATAFAST_SIGNUP_GOAL);

    expect(datafast).not.toHaveBeenCalled();
  });

  it("does not throw when the script is missing", () => {
    const { storage } = stubDatafastBrowser();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(true),
    );

    expect(() => trackDatafastGoal(DATAFAST_SIGNUP_GOAL)).not.toThrow();
  });
});
