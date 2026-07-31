import { beforeAll, describe, expect, it } from "vitest";
import { pickAlertToken, verifyPickAlertToken } from "@/lib/pick-alerts";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-for-pick-alert-tokens";
});

describe("pick alert unsubscribe tokens", () => {
  it("round-trips a user id", () => {
    const token = pickAlertToken("user_abc123");
    expect(verifyPickAlertToken(token)).toBe("user_abc123");
  });

  it("survives a user id containing the delimiter", () => {
    // The id is base64url-encoded precisely so a '.' in it cannot be mistaken
    // for the signature separator.
    const id = "user.with.dots";
    expect(verifyPickAlertToken(pickAlertToken(id))).toBe(id);
  });

  it("rejects a tampered signature", () => {
    const token = pickAlertToken("user_abc123");
    const [body, sig] = token.split(".");
    const flipped = sig[0] === "A" ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
    expect(verifyPickAlertToken(`${body}.${flipped}`)).toBeNull();
  });

  it("rejects a token signed for a different user", () => {
    const other = pickAlertToken("user_other");
    const body = Buffer.from("user_abc123").toString("base64url");
    expect(verifyPickAlertToken(`${body}.${other.split(".")[1]}`)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    // timingSafeEqual throws on a length mismatch, which is exactly what a
    // forged token looks like — the length guard has to come first.
    for (const bad of ["", ".", "nodot", ".sig", "a.b", "a".repeat(200)]) {
      expect(verifyPickAlertToken(bad)).toBeNull();
    }
  });
});
