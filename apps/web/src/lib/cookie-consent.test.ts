import { describe, expect, it } from "vitest";
import { parseCookieConsent } from "./cookie-consent";

describe("parseCookieConsent", () => {
  it("returns null for missing or invalid storage", () => {
    expect(parseCookieConsent(null)).toBeNull();
    expect(parseCookieConsent("")).toBeNull();
    expect(parseCookieConsent("{")).toBeNull();
    expect(parseCookieConsent(JSON.stringify({ accepted: "yes" }))).toBeNull();
  });

  it("reads an explicit accept or decline", () => {
    expect(
      parseCookieConsent(
        JSON.stringify({ accepted: true, timestamp: "2026-09-01T00:00:00.000Z" }),
      ),
    ).toEqual({ accepted: true, timestamp: "2026-09-01T00:00:00.000Z" });
    expect(parseCookieConsent(JSON.stringify({ accepted: false }))).toEqual({
      accepted: false,
      timestamp: "",
    });
  });
});
