import { describe, expect, it } from "vitest";
import pack from "../__fixtures__/pack.sample.json";
import type { Pack, Script } from "@/types";
import { findUnsupportedFigures } from "./figures";

const typedPack = pack as unknown as Pack;

function cleanScript(): Script {
  return {
    schemaVersion: 1,
    episodeId: typedPack.episodeId,
    title: "The book held up in a soft week",
    subtitle: typedPack.periodLabel,
    scenes: [
      {
        id: "scene-week",
        chapter: "The week",
        accent: "mint",
        narration:
          // 0.45 and 1.37 are pack.facts.week.{bookChangePct,spyChangePct}; 11 is an
          // ordinal-range count and does not need to trace to anything.
          "The book fell 0.45% on the week while the S&P 500 fell 1.37%, across 11 open positions.",
        slide: {
          type: "title",
          title: "Weekly review",
          subtitle: "The book fell 0.45%",
          periodLabel: typedPack.periodLabel,
        },
      },
      {
        id: "scene-holding",
        chapter: "The book",
        accent: "lilac",
        // SOFI's quantRating is 1.743 in the pack; 1.74 is within the 0.05 rounding tolerance.
        narration: "SoFi is up 15.8% but carries a 1.74 quant rating and a sell signal.",
        slide: { type: "holdings", heading: "Open positions" },
      },
    ],
  };
}

describe("findUnsupportedFigures", () => {
  it("passes a clean script whose figures all trace to the pack", () => {
    expect(findUnsupportedFigures(cleanScript(), typedPack)).toEqual([]);
  });

  it("accepts a figure rounded within the 0.05 tolerance", () => {
    // Already covered by cleanScript's 1.74 vs 1.743, asserted again explicitly.
    const script = cleanScript();
    script.scenes[1]!.narration = "SoFi carries a quant rating of 1.7.";
    expect(findUnsupportedFigures(script, typedPack)).toEqual([]);
  });

  it("fails a script that quotes a figure absent from the pack", () => {
    const script = cleanScript();
    // 77.7 sits well outside the range of every number in the fixture pack
    // (chart returns, P&L, ratings, sector shares all fall between roughly
    // -8 and 100 but never land within 0.05 of 77.7), so this is a clean,
    // unambiguous miss rather than an accidental near-collision.
    script.scenes[0]!.narration = "The book fell 0.45% while our picks returned 77.7% this week alone.";
    const findings = findUnsupportedFigures(script, typedPack);
    expect(findings.some((f) => f.token === "77.7%")).toBe(true);
  });

  it("fails when a figure is outside the rounding tolerance, not just wrong", () => {
    const script = cleanScript();
    // The pack's SOFI quant rating is 1.743; 88.8 is nowhere near it or any
    // other number in the fixture, well outside the 0.05 tolerance.
    script.scenes[1]!.narration = "SoFi carries a quant rating of 88.8.";
    const findings = findUnsupportedFigures(script, typedPack);
    expect(findings.some((f) => f.value === 88.8)).toBe(true);
  });

  it("ignores small integers as plausibly ordinal language", () => {
    const script = cleanScript();
    script.scenes[0]!.narration = "6 of 11 positions are in financial services.";
    expect(findUnsupportedFigures(script, typedPack)).toEqual([]);
  });

  it("ignores a bare four-digit year", () => {
    const script = cleanScript();
    script.scenes[0]!.narration = "Since inception in 2026, the book has stayed concentrated.";
    expect(findUnsupportedFigures(script, typedPack)).toEqual([]);
  });
});
