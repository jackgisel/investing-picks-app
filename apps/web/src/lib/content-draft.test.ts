import { describe, expect, it } from "vitest";
import {
  formatQuantRating,
  quantRatingExplainerUrl,
  QUANT_RATING_MAX,
} from "@/lib/content-draft";

describe("formatQuantRating", () => {
  it("pairs the score with the 1–5 scale", () => {
    expect(formatQuantRating(4.2)).toBe(`4.2 / ${QUANT_RATING_MAX}`);
    expect(formatQuantRating(5)).toBe(`5 / ${QUANT_RATING_MAX}`);
  });

  it("returns null when unscored", () => {
    expect(formatQuantRating(null)).toBeNull();
    expect(formatQuantRating(undefined)).toBeNull();
    expect(formatQuantRating(Number.NaN)).toBeNull();
  });
});

describe("quantRatingExplainerUrl", () => {
  it("deep-links the strategy page anchor", () => {
    expect(quantRatingExplainerUrl("https://outpick.xyz")).toBe(
      "https://outpick.xyz/dashboard/strategy#quant-rating",
    );
  });
});
