import { describe, expect, it } from "vitest";
import {
  datafastCheckoutMetadata,
  datafastDomain,
  sanitizeDatafastId,
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
