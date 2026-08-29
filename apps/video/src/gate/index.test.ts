import { describe, expect, it } from "vitest";
import pack from "../__fixtures__/pack.sample.json";
import type { Pack, Script } from "@/types";
import { runGate } from "./index";

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

describe("runGate", () => {
  it("passes a clean script end to end", () => {
    const result = runGate(cleanScript(), typedPack);
    expect(result.ok).toBe(true);
    expect(result.leaks).toEqual([]);
    expect(result.unsupportedFigures).toEqual([]);
    expect(result.forbiddenPhrases).toEqual([]);
  });

  it("fails when any one of the three checks fails", () => {
    const script = cleanScript();
    script.scenes[0]!.narration = "LLY is the new position this week.";
    const result = runGate(script, typedPack);
    expect(result.ok).toBe(false);
    expect(result.leaks.length).toBeGreaterThan(0);
  });
});
