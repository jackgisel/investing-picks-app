import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAMPLE_RESEARCH_HREF, navSections } from "@/lib/site-nav";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "footer.tsx"), "utf8");

describe("footer sample research link", () => {
  it("builds the Outpick column from navSections so the dead anchor can be omitted", () => {
    expect(src).toMatch(/navSections\(\{ hasSampleResearch \}\)/);
    expect(
      navSections({ hasSampleResearch: false })
        .find((s) => s.id === "outpick")
        ?.groups.flatMap((g) => g.links)
        .map((l) => l.href),
    ).not.toContain(SAMPLE_RESEARCH_HREF);
  });
});
