import { describe, expect, it } from "vitest";
import {
  isStatus,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  STATUSES,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  validateFeatureRequest,
} from "./feature-requests";

/** Narrows the union so the tests can read `.title` without a cast. */
function ok(result: ReturnType<typeof validateFeatureRequest>) {
  if ("error" in result) throw new Error(`expected success, got ${result.error}`);
  return result;
}

describe("validateFeatureRequest", () => {
  it("accepts a title on its own", () => {
    const r = ok(validateFeatureRequest("Export positions to CSV", undefined));
    expect(r.title).toBe("Export positions to CSV");
    expect(r.body).toBe("");
  });

  it("trims both fields", () => {
    const r = ok(validateFeatureRequest("  Sector filter  ", "  please  "));
    expect(r.title).toBe("Sector filter");
    expect(r.body).toBe("please");
  });

  // The whole reason the emptiness check runs after the trim.
  it("rejects a title that is only whitespace", () => {
    expect(validateFeatureRequest("   \n\t ", "real body")).toEqual({
      error: "A title is required.",
    });
  });

  it("rejects a missing or non-string title", () => {
    expect(validateFeatureRequest(undefined, "")).toHaveProperty("error");
    expect(validateFeatureRequest(42, "")).toHaveProperty("error");
    expect(validateFeatureRequest(null, "")).toHaveProperty("error");
  });

  it("enforces the title cap on the trimmed value", () => {
    expect(
      validateFeatureRequest("a".repeat(MAX_TITLE_LENGTH), ""),
    ).not.toHaveProperty("error");
    expect(
      validateFeatureRequest("a".repeat(MAX_TITLE_LENGTH + 1), ""),
    ).toHaveProperty("error");
    // Padding that trims away must not count against the cap.
    expect(
      validateFeatureRequest(`  ${"a".repeat(MAX_TITLE_LENGTH)}  `, ""),
    ).not.toHaveProperty("error");
  });

  it("enforces the body cap", () => {
    expect(
      validateFeatureRequest("t", "b".repeat(MAX_BODY_LENGTH)),
    ).not.toHaveProperty("error");
    expect(
      validateFeatureRequest("t", "b".repeat(MAX_BODY_LENGTH + 1)),
    ).toHaveProperty("error");
  });

  it("treats an absent body as empty but a wrong type as an error", () => {
    expect(ok(validateFeatureRequest("t", null)).body).toBe("");
    expect(ok(validateFeatureRequest("t", "   ")).body).toBe("");
    expect(validateFeatureRequest("t", 42)).toHaveProperty("error");
  });
});

describe("isStatus", () => {
  it("accepts every declared status", () => {
    for (const s of STATUSES) expect(isStatus(s)).toBe(true);
  });

  // This guards a CHECK constraint; a miss here is a 500 from Postgres.
  it("rejects anything else", () => {
    expect(isStatus("OPEN")).toBe(false);
    expect(isStatus("in-progress")).toBe(false);
    expect(isStatus("")).toBe(false);
    expect(isStatus(undefined)).toBe(false);
    expect(isStatus(0)).toBe(false);
  });
});

describe("status presentation", () => {
  it("has a label and a badge class for every status", () => {
    for (const s of STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_BADGE_CLASS[s]).toBeTruthy();
    }
  });
});
