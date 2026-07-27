import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_NAME,
  MAX_COMMENT_LENGTH,
  isSubjectType,
  resolveDisplayName,
  validateBody,
} from "./comments";
import {
  MAX_DISPLAY_NAME,
  avatarToneIndex,
  initialsFor,
  validateDisplayName,
} from "./profile";

describe("isSubjectType", () => {
  // A typo here opens a second, invisible thread on the same page — the
  // comments post fine and simply never appear again.
  it("accepts only the two real thread types", () => {
    expect(isSubjectType("blog")).toBe(true);
    expect(isSubjectType("insight")).toBe(true);
    expect(isSubjectType("insights")).toBe(false);
    expect(isSubjectType("Blog")).toBe(false);
    expect(isSubjectType(null)).toBe(false);
    expect(isSubjectType(undefined)).toBe(false);
  });
});

describe("validateBody", () => {
  it("rejects whitespace-only comments rather than posting a blank row", () => {
    expect(validateBody("   \n\t ")).toEqual({ error: "Comment cannot be empty." });
  });

  it("trims before storing so the rendered body has no leading blank lines", () => {
    expect(validateBody("  hello  ")).toEqual({ body: "hello" });
  });

  it("rejects a non-string body", () => {
    expect(validateBody(undefined)).toHaveProperty("error");
    expect(validateBody(42)).toHaveProperty("error");
    expect(validateBody({ body: "x" })).toHaveProperty("error");
  });

  it("measures length after trimming, so padding cannot smuggle past the cap", () => {
    const atCap = "a".repeat(MAX_COMMENT_LENGTH);
    expect(validateBody(`  ${atCap}  `)).toEqual({ body: atCap });
    expect(validateBody("a".repeat(MAX_COMMENT_LENGTH + 1))).toHaveProperty("error");
  });
});

describe("resolveDisplayName", () => {
  it("falls back for a null or blank name instead of rendering nothing", () => {
    expect(resolveDisplayName(null)).toBe(ANONYMOUS_NAME);
    expect(resolveDisplayName("   ")).toBe(ANONYMOUS_NAME);
  });

  it("keeps a real name", () => {
    expect(resolveDisplayName("Jack")).toBe("Jack");
  });
});

describe("validateDisplayName", () => {
  it("collapses internal whitespace so names cannot be stretched across a thread", () => {
    expect(validateDisplayName("J     G")).toEqual({ displayName: "J G" });
  });

  it("rejects markup and URLs", () => {
    expect(validateDisplayName("<b>hi</b>")).toHaveProperty("error");
    expect(validateDisplayName("http://spam.example")).toHaveProperty("error");
  });

  it("accepts non-Latin names", () => {
    expect(validateDisplayName("上田さん")).toEqual({ displayName: "上田さん" });
    expect(validateDisplayName("Zoë O'Neill")).toEqual({ displayName: "Zoë O'Neill" });
  });

  it("enforces the length bounds on the trimmed value", () => {
    expect(validateDisplayName(" a ")).toHaveProperty("error");
    expect(validateDisplayName("a".repeat(MAX_DISPLAY_NAME + 1))).toHaveProperty(
      "error",
    );
  });

  it("rejects a non-string", () => {
    expect(validateDisplayName(null)).toHaveProperty("error");
  });
});

describe("initialsFor", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFor("Jack Gisel")).toBe("JG");
    expect(initialsFor("Jack Robert Gisel")).toBe("JR");
  });

  it("handles a single word", () => {
    expect(initialsFor("Jack")).toBe("J");
  });

  // Naive `charAt(0)` splits a surrogate pair and yields a replacement glyph.
  it("does not split an astral character", () => {
    expect(initialsFor("𝒥ack")).toBe("𝒥".toLocaleUpperCase());
  });

  it("never returns an empty string", () => {
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("avatarToneIndex", () => {
  it("is stable for the same id, so a member keeps one colour", () => {
    expect(avatarToneIndex("user_abc", 6)).toBe(avatarToneIndex("user_abc", 6));
  });

  it("stays inside the palette", () => {
    for (const id of ["a", "user_1", "zzzzzzzzzzzzz", ""]) {
      const i = avatarToneIndex(id, 6);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(6);
    }
  });
});
