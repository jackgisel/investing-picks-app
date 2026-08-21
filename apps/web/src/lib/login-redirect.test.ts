import { describe, expect, it } from "vitest";
import {
  isSafeCallbackPath,
  resolveCallbackPath,
} from "./login-redirect";

describe("isSafeCallbackPath", () => {
  it("allows the known post-auth landings", () => {
    expect(isSafeCallbackPath("/subscribe")).toBe(true);
    expect(isSafeCallbackPath("/welcome")).toBe(true);
    expect(isSafeCallbackPath("/dashboard")).toBe(true);
    expect(isSafeCallbackPath("/dashboard/insights")).toBe(true);
    expect(isSafeCallbackPath("/dashboard/insights/crs")).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isSafeCallbackPath("//evil.example")).toBe(false);
    expect(isSafeCallbackPath("/\\evil")).toBe(false);
    expect(isSafeCallbackPath("https://evil.example")).toBe(false);
    expect(isSafeCallbackPath("/dashboard/../login")).toBe(false);
    expect(isSafeCallbackPath("/blog")).toBe(false);
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
});
