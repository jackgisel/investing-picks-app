import { describe, expect, it } from "vitest";
import pack from "../__fixtures__/pack.sample.json";
import type { Pack, Script } from "@/types";
import { findLeaks } from "./leaks";

const typedPack = pack as unknown as Pack;
const redaction = typedPack.redaction; // embargoes LLY / "Eli Lilly and Company"

/** A script that never mentions the embargoed pick — should pass the gate untouched. */
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
          "The book fell 0.45% on the week while the S&P 500 fell 1.37%. That is a good week in a bad tape.",
        slide: {
          type: "title",
          title: "Weekly review",
          subtitle: "The book fell 0.45%",
          periodLabel: typedPack.periodLabel,
        },
      },
      {
        id: "scene-book",
        chapter: "The book",
        accent: "lilac",
        narration:
          "One new position this week, which we're holding back until members have had it. The rest of the book stayed put.",
        slide: { type: "holdings", heading: "Open positions", caption: "One held back" },
      },
    ],
  };
}

describe("findLeaks", () => {
  it("passes a clean script that never names the embargoed pick", () => {
    expect(findLeaks(cleanScript(), redaction)).toEqual([]);
  });

  it("fails a script that names the embargoed ticker in narration", () => {
    const script = cleanScript();
    script.scenes[1]!.narration = "The new position is LLY, bought this week.";
    const findings = findLeaks(script, redaction);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.term === "LLY" && f.sceneId === "scene-book")).toBe(true);
  });

  it("fails a script that names the embargoed ticker only on a slide, not in narration", () => {
    const script = cleanScript();
    script.scenes[1]!.slide = { type: "holdings", heading: "Open positions", caption: "New: LLY" };
    const findings = findLeaks(script, redaction);
    expect(findings.some((f) => f.field === "slide.caption")).toBe(true);
  });

  it("fails a script that names the embargoed company by its distinctive token (\"Lilly\")", () => {
    const script = cleanScript();
    script.scenes[1]!.narration =
      "One new position this week: Lilly, which we're introducing before the usual holding period.";
    const findings = findLeaks(script, redaction);
    expect(findings.some((f) => f.term.toLowerCase() === "lilly")).toBe(true);
  });

  it("does not false-positive on a distinctive token embedded inside another word", () => {
    const script = cleanScript();
    script.scenes[1]!.narration = "Lillystreet Capital was not part of this week's move.";
    expect(findLeaks(script, redaction)).toEqual([]);
  });

  it("does not flag the short, common word from the company name (\"Eli\")", () => {
    const script = cleanScript();
    script.scenes[1]!.narration = "Eli, our host this week, walks through the book.";
    expect(findLeaks(script, redaction)).toEqual([]);
  });
});
