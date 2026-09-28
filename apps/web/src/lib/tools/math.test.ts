import { describe, expect, it } from "vitest";
import {
  altmanZone,
  concentratedPortfolioImpact,
  intrinsicValueGrid,
  intrinsicValuePerShare,
  ownerEarnings,
  portfolioLossImpact,
  profitMarginStack,
} from "./math";

describe("concentratedPortfolioImpact", () => {
  it("matches equal weight example from the plan", () => {
    const r = concentratedPortfolioImpact({ count: 10, movePct: -50 });
    expect(r.equalWeightPct).toBeCloseTo(10, 6);
    expect(r.equalImpactPts).toBeCloseTo(-5, 6);
  });

  it("matches top heavy example from the plan", () => {
    const r = concentratedPortfolioImpact({
      count: 10,
      movePct: -50,
      largestWeightPct: 25,
    });
    expect(r.topHeavyImpactPts).toBeCloseTo(-12.5, 6);
    expect(r.otherWeightPct).toBeCloseTo(75 / 9, 4);
  });
});

describe("profitMarginStack", () => {
  it("matches the plan illustration", () => {
    const r = profitMarginStack({
      revenue: 100,
      grossMarginPct: 60,
      operatingMarginPct: 25,
      netMarginPct: 18,
    });
    expect(r.grossProfit).toBe(60);
    expect(r.operatingProfit).toBe(25);
    expect(r.netIncome).toBe(18);
    expect(r.grossToNetGapPts).toBe(42);
  });
});

describe("ownerEarnings", () => {
  it("matches the plan illustration", () => {
    const r = ownerEarnings({
      reportedFcf: 100,
      sbcAddBack: 15,
      maintenanceCapex: 20,
    });
    expect(r.ownerEarnings).toBe(95);
    expect(r.yieldOnTypedPct).toBeNull();
  });
});

describe("portfolioLossImpact", () => {
  it("matches the plan illustration", () => {
    expect(portfolioLossImpact({ weightPct: 8, declinePct: 50 })).toBe(4);
  });
});

describe("intrinsicValuePerShare", () => {
  it("matches the plan center cell illustration", () => {
    const v = intrinsicValuePerShare({
      trailingFcf: 8,
      shares: 1,
      netDebt: 0,
      nearTermGrowthPct: 5,
      discountRatePct: 9,
      terminalGrowthPct: 2,
    });
    expect(v).toBeCloseTo(132.5, 1);
  });

  it("refuses terminal growth at or above the discount rate", () => {
    expect(
      intrinsicValuePerShare({
        trailingFcf: 8,
        shares: 1,
        netDebt: 0,
        nearTermGrowthPct: 5,
        discountRatePct: 9,
        terminalGrowthPct: 9,
      }),
    ).toBeNull();
  });
});

describe("intrinsicValueGrid", () => {
  it("returns nine cells centered on the typed rates", () => {
    const cells = intrinsicValueGrid({
      trailingFcf: 8,
      shares: 1,
      netDebt: 0,
      nearTermGrowthPct: 5,
      discountRatePct: 9,
      terminalGrowthPct: 2,
    });
    expect(cells).toHaveLength(9);
    const center = cells.find((c) => c.growthPct === 5 && c.discountPct === 9);
    expect(center?.valuePerShare).toBeCloseTo(132.5, 1);
  });
});

describe("altmanZone", () => {
  it("uses Altman published cutoffs", () => {
    expect(altmanZone(3.1)).toMatch(/Above 2.99/);
    expect(altmanZone(2.5)).toMatch(/1.81 to 2.99/);
    expect(altmanZone(1.2)).toMatch(/Below 1.81/);
  });
});
