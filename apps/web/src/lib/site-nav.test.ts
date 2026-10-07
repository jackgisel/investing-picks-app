import { describe, expect, it } from "vitest";
import {
  NAV_SECTIONS,
  SAMPLE_RESEARCH_HREF,
  navSections,
} from "./site-nav";

describe("navSections", () => {
  it("points each top-level label at the section hub", () => {
    expect(
      NAV_SECTIONS.map((s) => ({ id: s.id, href: s.href, label: s.label })),
    ).toEqual([
      { id: "research", href: "/blog", label: "Research" },
      { id: "tools", href: "/tools", label: "Free tools" },
      { id: "data", href: "/companies", label: "Data" },
      { id: "outpick", href: "/strategy", label: "Outpick" },
    ]);
  });

  it("omits the sample-research anchor unless a published sample exists", () => {
    const hidden = navSections({ hasSampleResearch: false })
      .flatMap((s) => s.groups.flatMap((g) => g.links))
      .map((l) => l.href);
    const shown = navSections({ hasSampleResearch: true })
      .flatMap((s) => s.groups.flatMap((g) => g.links))
      .map((l) => l.href);

    expect(hidden).not.toContain(SAMPLE_RESEARCH_HREF);
    expect(shown).toContain(SAMPLE_RESEARCH_HREF);
    expect(navSections().flatMap((s) => s.groups.flatMap((g) => g.links)).map((l) => l.href)).not.toContain(
      SAMPLE_RESEARCH_HREF,
    );
  });
});
