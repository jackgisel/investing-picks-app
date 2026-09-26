import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PRICING_DELIVERABLES,
  PRICING_FAQ,
  PRICING_FOR,
  PRICING_NOT_FOR,
  pricingFaqJsonLd,
} from "./pricing";
import { DATAFAST_CHECKOUT_GOAL } from "@/lib/datafast";
import { PRICING } from "@/lib/constants";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");

describe("pricing offer copy", () => {
  it("keeps the four membership deliverables", () => {
    expect(PRICING_DELIVERABLES).toHaveLength(4);
    expect(PRICING_DELIVERABLES.map((d) => d.title)).toEqual([
      "A researched pick every two weeks",
      "The live example portfolio",
      "The scoreboard vs the S&P 500",
      "Email when a new pick lands",
    ]);
  });

  it("answers 4–6 buyer objections without a return guarantee", () => {
    expect(PRICING_FAQ.length).toBeGreaterThanOrEqual(4);
    expect(PRICING_FAQ.length).toBeLessThanOrEqual(6);

    const blob = PRICING_FAQ.map((item) => `${item.q} ${item.a}`).join("\n");
    expect(blob).toMatch(/signal service/i);
    expect(blob).toMatch(/Seeking Alpha|free tools/i);
    expect(blob).toMatch(/included/i);
    expect(blob).toMatch(/Cancel/i);
    expect(blob).toMatch(/track record/i);
    expect(PRICING_FAQ.map((item) => item.a).join(" ")).not.toMatch(
      /we guarantee/i,
    );
    expect(blob).not.toMatch(/\bCAGR\b/);
  });

  it("states who the membership is for and is not for", () => {
    expect(PRICING_FOR.length).toBeGreaterThanOrEqual(2);
    expect(PRICING_NOT_FOR.length).toBeGreaterThanOrEqual(2);
    expect(PRICING_NOT_FOR.join(" ")).toMatch(/alert/i);
  });

  it("keeps FAQPage JSON-LD in lockstep with visible answers", () => {
    const jsonLd = pricingFaqJsonLd();
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity).toHaveLength(PRICING_FAQ.length);
    for (const [i, item] of PRICING_FAQ.entries()) {
      expect(jsonLd.mainEntity[i]?.name).toBe(item.q);
      expect(jsonLd.mainEntity[i]?.acceptedAnswer.text).toBe(item.a);
    }
  });
});

describe("pricing page wiring", () => {
  const page = readFileSync(
    join(webRoot, "src/components/pricing/pricing-page.tsx"),
    "utf8",
  );
  const route = readFileSync(join(webRoot, "src/app/pricing/page.tsx"), "utf8");

  it("preserves Stripe checkout and Datafast checkout_started", () => {
    expect(page).toContain('href="/subscribe"');
    expect(page).toContain("DATAFAST_CHECKOUT_GOAL");
    expect(page).toContain("Subscribe · $");
    expect(DATAFAST_CHECKOUT_GOAL).toBe("checkout_started");
  });

  it("points proof and fit copy at existing trust pages", () => {
    expect(page).toContain('href="/track-record"');
    expect(page).toContain('href="/what-we-are-not"');
    expect(page).toContain('href="/#live-picks"');
  });

  it("surfaces the current price in the primary CTA", () => {
    expect(page).toContain("PRICING.foundersAnnual");
    expect(PRICING.foundersAnnual).toBe(250);
    expect(page).toContain("/ year");
  });

  it("uses a decision-page title instead of Pricing | Outpick", () => {
    expect(route).toContain("for value-based stock research");
    expect(route).not.toMatch(/title:\s*"Pricing"/);
    expect(route).toContain("pricingFaqJsonLd");
    expect(route).toContain('canonical: "/pricing"');
  });
});
