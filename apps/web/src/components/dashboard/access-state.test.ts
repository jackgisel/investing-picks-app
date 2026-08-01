import { describe, expect, it } from "vitest";
import { resolvePageAccessState } from "./access-state";

describe("resolvePageAccessState", () => {
  it("blocks anonymized content until the gated request resolves", () => {
    expect(resolvePageAccessState("loading", null)).toBe("loading");
  });

  it("surfaces entitlement gates from the authoritative request", () => {
    expect(resolvePageAccessState("unauthenticated", null)).toBe(
      "unauthenticated",
    );
    expect(resolvePageAccessState("subscription", null)).toBe("subscription");
  });

  it("fails closed when the entitlement request errors", () => {
    expect(resolvePageAccessState("error", null)).toBe("error");
  });

  it("allows successful empty and populated responses", () => {
    expect(resolvePageAccessState("empty", null)).toBeNull();
    expect(resolvePageAccessState(null, null)).toBeNull();
  });

  it("still honors a gate reported by the secondary request", () => {
    expect(resolvePageAccessState(null, "unauthenticated")).toBe(
      "unauthenticated",
    );
    expect(resolvePageAccessState("empty", "subscription")).toBe(
      "subscription",
    );
  });
});
