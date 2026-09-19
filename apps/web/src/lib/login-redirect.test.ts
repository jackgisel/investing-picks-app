import { describe, expect, it } from "vitest";
import {
  isSafeCallbackPath,
  resolveCallbackPath,
  welcomeLoginNext,
} from "./login-redirect";

describe("isSafeCallbackPath", () => {
  it("allows the known post-auth landings", () => {
    expect(isSafeCallbackPath("/subscribe")).toBe(true);
    expect(isSafeCallbackPath("/welcome")).toBe(true);
    expect(isSafeCallbackPath("/dashboard")).toBe(true);
    expect(isSafeCallbackPath("/dashboard/insights")).toBe(true);
    expect(isSafeCallbackPath("/dashboard/insights/crs")).toBe(true);
  });

  it("keeps a successful Checkout return on /welcome", () => {
    expect(
      isSafeCallbackPath(
        "/welcome?checkout=success&session_id=cs_test_abc123",
      ),
    ).toBe(true);
    expect(
      isSafeCallbackPath(
        "/welcome?checkout=success&session_id=cs_live_xyz",
      ),
    ).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isSafeCallbackPath("//evil.example")).toBe(false);
    expect(isSafeCallbackPath("/\\evil")).toBe(false);
    expect(isSafeCallbackPath("https://evil.example")).toBe(false);
    expect(isSafeCallbackPath("/dashboard/../login")).toBe(false);
    expect(isSafeCallbackPath("/blog")).toBe(false);
    expect(isSafeCallbackPath("/welcome?next=/dashboard")).toBe(false);
    expect(isSafeCallbackPath("/welcome?checkout=fail")).toBe(false);
    expect(
      isSafeCallbackPath("/welcome?checkout=success&session_id=nope"),
    ).toBe(false);
    expect(isSafeCallbackPath("/subscribe?next=/welcome")).toBe(false);
  });
});

describe("resolveCallbackPath", () => {
  it("falls back to subscribe", () => {
    expect(resolveCallbackPath(null)).toBe("/subscribe");
    expect(resolveCallbackPath("/blog")).toBe("/subscribe");
  });

  it("keeps a safe dashboard path", () => {
    expect(resolveCallbackPath("/dashboard/insights/crs")).toBe(
      "/dashboard/insights/crs",
    );
  });

  it("keeps a Checkout thank-you next path", () => {
    expect(
      resolveCallbackPath(
        "/welcome?checkout=success&session_id=cs_test_abc123",
      ),
    ).toBe("/welcome?checkout=success&session_id=cs_test_abc123");
  });
});

describe("welcomeLoginNext", () => {
  it("preserves a valid Checkout session on the login bounce", () => {
    expect(
      welcomeLoginNext({
        checkout: "success",
        session_id: "cs_test_abc123",
      }),
    ).toBe("/welcome?checkout=success&session_id=cs_test_abc123");
  });

  it("drops junk query values", () => {
    expect(welcomeLoginNext({ checkout: "success" })).toBe("/welcome");
    expect(
      welcomeLoginNext({ checkout: "success", session_id: "nope" }),
    ).toBe("/welcome");
  });
});
