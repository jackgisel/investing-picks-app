import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Conversion landmines: leading with "AI research desk" on a Graham/Buffett
 * product loses the buyer. Internal pipeline comments are out of scope; these
 * files are what a visitor or a subscriber actually reads.
 */
const USER_FACING = [
  "src/components/pricing/pricing-page.tsx",
  "src/content/pricing.ts",
  "src/app/pricing/page.tsx",
  "src/lib/constants.ts",
  "src/content/faq.ts",
  "src/app/welcome/welcome-experience.tsx",
] as const;

const LANDMINES = [
  /AI research desk/i,
  /drafted by our AI/i,
  /researched by our AI/i,
  /team of AI agents/i,
  /AI agent team/i,
];

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");

describe("user-facing copy does not lead with AI drafting", () => {
  it.each(USER_FACING)("%s", (rel) => {
    const text = readFileSync(join(webRoot, rel), "utf8");
    for (const re of LANDMINES) {
      expect(text, `${rel} matched ${re}`).not.toMatch(re);
    }
  });
});

/**
 * Marketing pages and the components they render. Dashes read as machine
 * writing to the people this copy is trying to convert, so the house rule is
 * none at all. A lone "—" as an empty-value placeholder is not prose and is
 * allowed; comments are not copy and are stripped before checking.
 */
const MARKETING = [
  "src/app/layout.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/faq/page.tsx",
  "src/app/login/page.tsx",
  "src/app/market-note/page.tsx",
  "src/app/market-note/unsubscribe/page.tsx",
  "src/app/market-note/unsubscribe/unsubscribe-confirm.tsx",
  "src/app/pricing/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/research/[slug]/page.tsx",
  "src/app/strategy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/track-record/page.tsx",
  "src/app/welcome/welcome-experience.tsx",
  "src/app/what-we-are-not/page.tsx",
  "src/components/landing/backtest-holdings.tsx",
  "src/components/landing/disclaimer.tsx",
  "src/components/landing/hero.tsx",
  "src/components/landing/how-it-works-diagrams.tsx",
  "src/components/landing/live-picks.tsx",
  "src/components/landing/market-note-band.tsx",
  "src/components/landing/philosophy.tsx",
  "src/components/landing/pricing.tsx",
  "src/components/landing/sample-research.tsx",
  "src/components/landing/track-record.tsx",
  "src/components/landing/what-how.tsx",
  "src/components/landing/what-we-are-not.tsx",
  "src/components/layout/cookie-banner.tsx",
  "src/components/layout/footer.tsx",
  "src/components/marketing/comparison-table.tsx",
  "src/components/marketing/market-note-signup.tsx",
  "src/components/pricing/pricing-page.tsx",
  "src/content/faq.ts",
  "src/content/market-note-sample.tsx",
  "src/content/pricing.ts",
  "src/lib/constants.ts",
] as const;

function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

describe("marketing copy uses no dashes", () => {
  it.each(MARKETING)("%s", (rel) => {
    const copy = stripComments(readFileSync(join(webRoot, rel), "utf8"))
      .replaceAll('"—"', "")
      .replaceAll(">—<", "");
    expect(copy, `${rel} contains a dash`).not.toMatch(/—|–| -- /);
  });
});
