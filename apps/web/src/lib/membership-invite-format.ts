import { SITE_URL } from "@/lib/constants";

/**
 * One named complimentary grant that should exist without a dashboard click.
 * Checkout applies the 100% coupon to this address; the first web boot with
 * Resend configured mails the invite.
 */
export const BOOTSTRAP_MEMBERSHIP_INVITES: ReadonlyArray<{
  email: string;
  name: string;
  note: string;
}> = [
  {
    email: "senecafuller@gmail.com",
    name: "Seneca",
    note: "Complimentary membership",
  },
];

export function normalizeInviteEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function membershipInviteUrl(email: string): string {
  const url = new URL("/login", SITE_URL);
  // Sign-in grants the membership (lib/complimentary-grant.ts), so the
  // invitee lands on the member welcome rather than a billing page.
  url.searchParams.set("next", "/welcome");
  url.searchParams.set("email", email);
  return url.toString();
}
