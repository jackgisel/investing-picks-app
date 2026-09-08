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
