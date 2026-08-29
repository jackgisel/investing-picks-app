import { describe, expect, it } from "vitest";
import pack from "../__fixtures__/pack.sample.json";
import type { Pack, Script } from "@/types";
import { findForbiddenPhrases } from "./phrases";

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
        narration: "The book fell 0.45% on the week while the S&P 500 fell 1.37%.",
        slide: {
          type: "title",
          title: "Weekly review",
          subtitle: "The book fell 0.45%",
          periodLabel: typedPack.periodLabel,
        },
      },
    ],
  };
}

describe("findForbiddenPhrases", () => {
  it("passes a clean script with no hype language", () => {
    expect(findForbiddenPhrases(cleanScript())).toEqual([]);
  });

  it("fails a script containing a forbidden phrase in narration", () => {
    const script = cleanScript();
    script.scenes[0]!.narration = "This could 10x if the next evaluation goes well.";
    const findings = findForbiddenPhrases(script);
    expect(findings.some((f) => f.phrase === "This could 10x")).toBe(true);
  });

  it("matches a forbidden phrase case-insensitively", () => {
    const script = cleanScript();
    script.scenes[0]!.narration = "guaranteed to keep beating the index, some would say.";
    const findings = findForbiddenPhrases(script);
    expect(findings.some((f) => f.phrase === "Guaranteed")).toBe(true);
  });

  it("fails a script with a forbidden phrase only on a slide", () => {
    const script = cleanScript();
    script.scenes[0]!.slide = { type: "quote", text: "To the moon from here." };
    const findings = findForbiddenPhrases(script);
    expect(findings.some((f) => f.field === "slide.text")).toBe(true);
  });
});
