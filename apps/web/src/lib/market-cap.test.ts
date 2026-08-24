import { describe, expect, it } from "vitest";
import { formatCompactUsd, marketCapTier } from "./market-cap";

describe("formatCompactUsd", () => {
  it("scales through M, B and T", () => {
    expect(formatCompactUsd(4.2e6)).toBe("$4.2M");
    expect(formatCompactUsd(4.2e8)).toBe("$420M");
    expect(formatCompactUsd(4.2e9)).toBe("$4.20B");
    expect(formatCompactUsd(6.9e11)).toBe("$690.0B");
    expect(formatCompactUsd(4.4e12)).toBe("$4.40T");
  });

  it("renders unknown as an em dash rather than zero", () => {
    expect(formatCompactUsd(null)).toBe("—");
    expect(formatCompactUsd(undefined)).toBe("—");
    expect(formatCompactUsd(Number.NaN)).toBe("—");
  });
});

describe("marketCapTier", () => {
  it("uses the standard boundaries, inclusive at the floor", () => {
    expect(marketCapTier(2.5e11)).toBe("Mega");
    expect(marketCapTier(2e11)).toBe("Mega");
    expect(marketCapTier(1.99e11)).toBe("Large");
    expect(marketCapTier(1e10)).toBe("Large");
    expect(marketCapTier(9.9e9)).toBe("Mid");
    expect(marketCapTier(2e9)).toBe("Mid");
    expect(marketCapTier(1.9e9)).toBe("Small");
    expect(marketCapTier(2.5e8)).toBe("Small");
    expect(marketCapTier(2.4e8)).toBe("Micro");
  });

  it("has no tier for an unknown or nonsensical cap", () => {
    expect(marketCapTier(null)).toBeNull();
    expect(marketCapTier(undefined)).toBeNull();
    expect(marketCapTier(0)).toBeNull();
  });
});
