import { describe, expect, it } from "vitest";
import type { Redaction, Script } from "@/types";
import { findLeaks } from "@/gate/leaks";
import { redactProse } from "@/pack/redact";

/**
 * `redact.ts` and `leaks.ts` both call `embargoTerms` now, so in principle
 * they cannot disagree about what a mention is — but that guarantee is only
 * as good as this test that actually exercises it. For every sentence below,
 * two things must both hold: whatever `redactProse` leaves behind must be
 * something `findLeaks` reports clean, and whatever `findLeaks` flags in the
 * original must be something `redactProse` actually changed. A future edit
 * that special-cases one side without the other — the exact failure mode
 * this module exists to prevent — should break this test.
 */

function neutralScript(narration: string): Script {
  return {
    schemaVersion: 1,
    episodeId: "agreement-test",
    title: "Weekly review",
    subtitle: "August 2026",
    scenes: [
      {
        id: "scene",
        chapter: "the book",
        accent: "mint",
        narration,
        slide: { type: "title", title: "Weekly review", subtitle: "A steady week", periodLabel: "August 2026" },
      },
    ],
  };
}

function redactionFor(tickers: string[], names: string[]): Redaction {
  return {
    embargoDays: 14,
    tickers,
    names,
    reasons: tickers.map((ticker) => ({ ticker, reason: "recent_entry" as const, entryDate: null })),
  };
}

interface Case {
  label: string;
  redaction: Redaction;
  sentences: string[];
}

const CASES: Case[] = [
  {
    label: "multi-word name with a corporate suffix and a too-short first word",
    redaction: redactionFor(["LLY"], ["Eli Lilly and Company"]),
    sentences: [
      "One new position this week, Eli Lilly and Company, joins the book.",
      "LLY was the ticker for the new buy this week.",
      "Lilly's stock climbed on the announcement.",
      "Eli, our host this week, walks through the numbers.",
      "Lillystreet Capital was untouched by the move.",
      "The book fell 0.45% on the week.",
    ],
  },
  {
    label: "a ticker that is also a common English word",
    redaction: redactionFor(["ALL"], ["Allstate Corporation"]),
    sentences: [
      "The book is all about steady compounding, and ALL was the new buy.",
      "Allstate Corporation reported strong earnings this quarter.",
      "The rest of the book stayed put this week.",
    ],
  },
  {
    label: "a name whose distinctive token is short and filtered out",
    redaction: redactionFor(["GEV"], ["GE Vernova Inc."]),
    sentences: [
      "GEV was the new position added to the book.",
      "Vernova reported a strong quarter after the spinoff.",
      "GE, the parent, was not part of the move.",
      "The book stayed diversified across sectors.",
    ],
  },
  {
    label: "possessive form of a distinctive token",
    redaction: redactionFor(["SEZL"], ["Sezzle Inc."]),
    sentences: [
      "Sezzle's rating improved again this week.",
      "The standing SEZL position kept compounding.",
      "The book added no new names this week.",
    ],
  },
];

describe("pack/redact and gate/leaks agree on what counts as a mention", () => {
  for (const { label, redaction, sentences } of CASES) {
    describe(label, () => {
      for (const sentence of sentences) {
        it(`"${sentence}"`, () => {
          const originalFindings = findLeaks(neutralScript(sentence), redaction);
          const redacted = redactProse(sentence, redaction);
          const redactedFindings = findLeaks(neutralScript(redacted), redaction);

          // Whatever redactProse leaves behind, findLeaks must report clean.
          expect(redactedFindings).toEqual([]);

          // Whatever findLeaks flagged in the original, redactProse must have
          // changed — and if findLeaks found nothing, redactProse must be a
          // no-op, since both now derive their terms from the same function.
          if (originalFindings.length > 0) {
            expect(redacted).not.toBe(sentence);
          } else {
            expect(redacted).toBe(sentence);
          }
        });
      }
    });
  }

  it("at least one sentence per case actually triggers the rule, so the checks above are not vacuous", () => {
    for (const { redaction, sentences } of CASES) {
      const anyFlagged = sentences.some((sentence) => findLeaks(neutralScript(sentence), redaction).length > 0);
      expect(anyFlagged).toBe(true);
    }
  });
});
