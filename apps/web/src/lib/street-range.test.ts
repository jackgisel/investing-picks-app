import { describe, expect, it } from "vitest";
import {
  formatStreetPct,
  formatStreetPrice,
  streetRangeFromFundamentals,
} from "@/lib/street-range";

describe("streetRangeFromFundamentals", () => {
  it("returns null when the band is incomplete", () => {
    expect(
      streetRangeFromFundamentals({
        mark: 190,
        price_target_low: 210,
        price_target_mean: null,
        price_target_high: 250,
      }),
    ).toBeNull();
  });

  it("builds upside/downside vs mark", () => {
    const range = streetRangeFromFundamentals({
      mark: 190,
      price_target_low: 210,
      price_target_mean: 230,
      price_target_high: 250,
      price_target_analyst_count: 24,
    });
    expect(range).not.toBeNull();
    expect(range!.upsideToMeanPct).toBeCloseTo(((230 - 190) / 190) * 100, 5);
    expect(range!.downsideToLowPct).toBeCloseTo(((210 - 190) / 190) * 100, 5);
    expect(formatStreetPrice(range!.mean)).toMatch(/\$230/);
    expect(formatStreetPct(range!.upsideToMeanPct!)).toMatch(/^\+/);
  });

  it("rejects an inverted band", () => {
    expect(
      streetRangeFromFundamentals({
        mark: 10,
        price_target_low: 30,
        price_target_mean: 20,
        price_target_high: 40,
      }),
    ).toBeNull();
  });
});
