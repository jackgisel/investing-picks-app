import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP_MEMBERSHIP_INVITES,
  membershipInviteUrl,
  normalizeInviteEmail,
} from "./membership-invite-format";
import { isComplimentaryAccount } from "./stripe-checkout";

describe("normalizeInviteEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeInviteEmail("  SenecaFuller@Gmail.com ")).toBe(
      "senecafuller@gmail.com",
    );
  });

  it("rejects missing or malformed addresses", () => {
    expect(normalizeInviteEmail("")).toBeNull();
    expect(normalizeInviteEmail("not-an-email")).toBeNull();
    expect(normalizeInviteEmail("a@b")).toBeNull();
  });
});

describe("membershipInviteUrl", () => {
  it("prefills login and sends the invitee to checkout", () => {
    expect(membershipInviteUrl("senecafuller@gmail.com")).toBe(
      "https://outpick.xyz/login?next=%2Fsubscribe&email=senecafuller%40gmail.com",
    );
  });
});

describe("bootstrap complimentary invite", () => {
  it("grants Seneca Fuller complimentary checkout", () => {
    const emails = BOOTSTRAP_MEMBERSHIP_INVITES.map((invite) => invite.email);
    expect(emails).toContain("senecafuller@gmail.com");
    expect(
      isComplimentaryAccount(
        "senecafuller@gmail.com",
        emails.join(","),
      ),
    ).toBe(true);
  });
});
