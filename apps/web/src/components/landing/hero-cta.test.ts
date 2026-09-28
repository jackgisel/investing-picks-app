import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";
import {
  HERO_DASHBOARD_HREF,
  HERO_DASHBOARD_LABEL,
  HERO_MEMBERSHIP_HREF,
  HERO_MEMBERSHIP_LABEL,
  heroPrimaryCta,
} from "./hero-cta";

const MEMBERSHIP = {
  href: HERO_MEMBERSHIP_HREF,
  label: HERO_MEMBERSHIP_LABEL,
  checkoutGoal: DATAFAST_CHECKOUT_GOAL,
};

const DASHBOARD = {
  href: HERO_DASHBOARD_HREF,
  label: HERO_DASHBOARD_LABEL,
};

describe("heroPrimaryCta", () => {
  it("keeps the membership CTA for logged-out visitors", () => {
    expect(heroPrimaryCta(null)).toEqual(MEMBERSHIP);
    expect(heroPrimaryCta(undefined)).toEqual(MEMBERSHIP);
  });

  it.each([
    "inactive",
    "incomplete",
    "incomplete_expired",
    "canceled",
    "unpaid",
    "paused",
  ] as const)("keeps the membership CTA for unpaid status %s", (status) => {
    expect(heroPrimaryCta(status)).toEqual(MEMBERSHIP);
  });

  it.each(["active", "trialing", "past_due"] as const)(
    "sends paid status %s to the dashboard",
    (status) => {
      expect(heroPrimaryCta(status)).toEqual(DASHBOARD);
    },
  );

  it("does not attach the checkout goal to the dashboard CTA", () => {
    expect(heroPrimaryCta("active").checkoutGoal).toBeUndefined();
  });

  it("sends an admin without a subscription to the dashboard", () => {
    expect(heroPrimaryCta("inactive", true)).toEqual(DASHBOARD);
    expect(heroPrimaryCta(null, true)).toEqual(DASHBOARD);
  });

  it("uses the same dashboard href as the header control", () => {
    expect(HERO_DASHBOARD_HREF).toBe("/dashboard");
  });
});

describe("hero image preload", () => {
  const hero = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "hero.tsx"),
    "utf8",
  );

  it("preloads only the WebP for the current breakpoint", () => {
    expect(hero).toContain('href="/hero-moon-soft.webp"');
    expect(hero).toContain('media="(max-width: 1023px)"');
    expect(hero).toContain('href="/hero-moon.webp"');
    expect(hero).toContain('media="(min-width: 1024px)"');
    expect(hero).toContain('src="/hero-moon-soft.png"');
    const img = hero.slice(hero.indexOf("<img"), hero.indexOf("/>", hero.indexOf("<img")));
    expect(img).not.toContain("decoding=");
    expect(hero).not.toContain('href="/hero-moon.png"');
    expect(hero).not.toContain('src="/hero-moon.png"');
  });
});
