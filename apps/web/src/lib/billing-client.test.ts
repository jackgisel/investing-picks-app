import { describe, expect, it } from "vitest";
import { billingUrlFromResponse } from "./billing-client";

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
