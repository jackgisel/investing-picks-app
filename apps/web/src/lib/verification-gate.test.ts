import { afterEach, describe, expect, it } from "vitest";
import { requireEmailVerification } from "@/lib/auth";

/**
 * One setting must govern both sign-in and checkout.
 *
 * The bug: `/api/billing/checkout` demanded `emailVerified` unconditionally
 * while this function decided whether anyone was ever ASKED to verify. With
 * verification off — explicitly, or because RESEND_API_KEY is absent so
 * `sendVerifyEmail` no-ops — no account's `emailVerified` ever becomes true,
 * and checkout is unreachable for the entire userbase with nothing the user
 * can do about it. Two settings, one requirement.
 *
 * These pin the resolver. The route now calls it rather than hardcoding the
 * requirement, so a build where these hold is a build where "may sign in
 * unverified" and "may subscribe unverified" cannot disagree.
 */

const original = {
  explicit: process.env.REQUIRE_EMAIL_VERIFICATION,
  resend: process.env.RESEND_API_KEY,
};

function setEnv(explicit?: string, resend?: string) {
  if (explicit === undefined) delete process.env.REQUIRE_EMAIL_VERIFICATION;
  else process.env.REQUIRE_EMAIL_VERIFICATION = explicit;
  if (resend === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = resend;
}

afterEach(() => {
  setEnv(original.explicit, original.resend);
});

describe("requireEmailVerification", () => {
  it("is off when no mailer is configured", () => {
    // The trap. Without this being false, checkout would demand a verification
    // that nothing in the deployment is able to send.
    setEnv(undefined, undefined);
    expect(requireEmailVerification()).toBe(false);
  });

  it("switches itself on once a mailer exists", () => {
    setEnv(undefined, "re_live_key");
    expect(requireEmailVerification()).toBe(true);
  });

  it("honours an explicit override in both directions", () => {
    setEnv("false", "re_live_key");
    expect(requireEmailVerification()).toBe(false);

    setEnv("true", undefined);
    expect(requireEmailVerification()).toBe(true);
  });

  it("treats a non-'true' explicit value as off", () => {
    setEnv("yes", "re_live_key");
    expect(requireEmailVerification()).toBe(false);
  });

  it("is case-insensitive on the explicit value", () => {
    setEnv("TRUE", undefined);
    expect(requireEmailVerification()).toBe(true);
  });

  it("ignores an empty string and falls back to the mailer", () => {
    // An unset variable and one set to "" arrive identically in some
    // deployment tooling; "" must not read as an explicit "not true".
    setEnv("", "re_live_key");
    expect(requireEmailVerification()).toBe(true);
  });
});
