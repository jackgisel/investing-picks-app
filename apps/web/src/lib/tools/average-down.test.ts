import { describe, expect, it } from "vitest";
import {
  AVERAGE_DOWN_DEFAULTS,
  averageDown,
  combineLots,
  hasAverageDownQuery,
  parseAverageDownQuery,
  plannedAddShares,
  serializeAverageDownQuery,
  sharesToHitAverage,
} from "./average-down";

describe("combineLots", () => {
  it("matches a single lot of 100 shares at $60", () => {
    const r = combineLots([{ shares: 100, price: 60 }]);
    expect(r?.shares).toBe(100);
    expect(r?.invested).toBe(6000);
    expect(r?.avgCost).toBe(60);
  });

  it("blends two lots into one average", () => {
    const r = combineLots([
      { shares: 50, price: 80 },
      { shares: 50, price: 40 },
    ]);
    expect(r?.shares).toBe(100);
    expect(r?.avgCost).toBe(60);
  });

  it("ignores empty and invalid rows", () => {
    expect(combineLots([])).toBeNull();
    expect(combineLots([{ shares: 0, price: 60 }])).toBeNull();
    expect(
      combineLots([
        { shares: 0, price: 10 },
        { shares: 10, price: 20 },
      ])?.avgCost,
    ).toBe(20);
  });
});

describe("plannedAddShares", () => {
  it("passes shares through and converts dollars at the current price", () => {
    expect(plannedAddShares(83.333, "shares", 36)).toBeCloseTo(83.333, 6);
    expect(plannedAddShares(3000, "dollars", 36)).toBeCloseTo(3000 / 36, 10);
  });

  it("rejects a zero or negative price", () => {
    expect(plannedAddShares(3000, "dollars", 0)).toBeNull();
    expect(plannedAddShares(10, "shares", -1)).toBeNull();
  });
});

describe("averageDown", () => {
  it("matches the hypothetical 100 shares at $60, now $36, add $3,000", () => {
    const addShares = plannedAddShares(3000, "dollars", 36);
    expect(addShares).not.toBeNull();
    const r = averageDown({
      shares: 100,
      avgCost: 60,
      price: 36,
      addShares: addShares!,
      portfolioValue: 100_000,
    });
    expect(r).not.toBeNull();
    expect(r!.newShares).toBeCloseTo(183.333333, 4);
    expect(r!.newInvested).toBeCloseTo(9000, 6);
    expect(r!.newAvgCost).toBeCloseTo(49.090909, 4);
    expect(r!.breakevenBeforePct).toBeCloseTo(66.666666, 4);
    expect(r!.breakevenAfterPct).toBeCloseTo(36.363636, 4);
    expect(r!.unrealizedPl).toBeCloseTo(-2400, 6);
    expect(r!.weightBeforePct).toBeCloseTo(3.6, 6);
    expect(r!.weightAfterPct).toBeCloseTo((6600 / 103000) * 100, 6);
    expect(r!.hit30BeforePts).toBeCloseTo(1.08, 6);
    expect(r!.hit50BeforePts).toBeCloseTo(1.8, 6);
    expect(r!.hit50AfterPts).toBeCloseTo((6600 / 103000) * 100 * 0.5, 6);
  });

  it("leaves the average unchanged when the add is zero", () => {
    const r = averageDown({
      shares: 100,
      avgCost: 50,
      price: 40,
      addShares: 0,
    });
    expect(r?.newShares).toBe(100);
    expect(r?.newAvgCost).toBe(50);
    expect(r?.weightBeforePct).toBeNull();
  });

  it("treats zero current shares plus an add as a fresh buy at the current price", () => {
    const r = averageDown({
      shares: 0,
      avgCost: 0,
      price: 36,
      addShares: 10,
    });
    expect(r?.newShares).toBe(10);
    expect(r?.newAvgCost).toBe(36);
    expect(r?.breakevenBeforePct).toBeNull();
    expect(r?.unrealizedPl).toBeNull();
    expect(r?.breakevenAfterPct).toBe(0);
  });

  it("returns null for zero shares and no add, or a non-positive price", () => {
    expect(
      averageDown({ shares: 0, avgCost: 60, price: 36, addShares: 0 }),
    ).toBeNull();
    expect(
      averageDown({ shares: 100, avgCost: 60, price: 0, addShares: 10 }),
    ).toBeNull();
    expect(
      averageDown({ shares: -1, avgCost: 60, price: 36, addShares: 10 }),
    ).toBeNull();
  });

  it("omits weights unless a positive portfolio value is typed", () => {
    const r = averageDown({
      shares: 100,
      avgCost: 60,
      price: 36,
      addShares: 10,
      portfolioValue: 0,
    });
    expect(r?.weightBeforePct).toBeNull();
    expect(r?.weightAfterPct).toBeNull();
  });
});

describe("sharesToHitAverage", () => {
  it("solves how many shares bring $60 down toward $50 at a $36 price", () => {
    const r = sharesToHitAverage({
      shares: 100,
      avgCost: 60,
      price: 36,
      targetAvg: 50,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.shares).toBeCloseTo(1000 / 14, 8);
      expect(r.dollars).toBeCloseTo((1000 / 14) * 36, 6);
      const check = averageDown({
        shares: 100,
        avgCost: 60,
        price: 36,
        addShares: r.shares,
      });
      expect(check?.newAvgCost).toBeCloseTo(50, 8);
    }
  });

  it("rejects a target at or below the current price", () => {
    expect(
      sharesToHitAverage({
        shares: 100,
        avgCost: 60,
        price: 36,
        targetAvg: 36,
      }),
    ).toEqual({ ok: false, reason: "target_at_or_below_price" });
    expect(
      sharesToHitAverage({
        shares: 100,
        avgCost: 60,
        price: 36,
        targetAvg: 30,
      }),
    ).toEqual({ ok: false, reason: "target_at_or_below_price" });
  });

  it("rejects a target that is not below the current average", () => {
    expect(
      sharesToHitAverage({
        shares: 100,
        avgCost: 60,
        price: 36,
        targetAvg: 60,
      }),
    ).toEqual({ ok: false, reason: "target_not_below_average" });
    expect(
      sharesToHitAverage({
        shares: 100,
        avgCost: 60,
        price: 36,
        targetAvg: 70,
      }),
    ).toEqual({ ok: false, reason: "target_not_below_average" });
  });

  it("rejects averaging down when the price is not below the average", () => {
    expect(
      sharesToHitAverage({
        shares: 100,
        avgCost: 60,
        price: 60,
        targetAvg: 50,
      }),
    ).toEqual({ ok: false, reason: "price_not_below_average" });
    expect(
      sharesToHitAverage({
        shares: 100,
        avgCost: 60,
        price: 70,
        targetAvg: 50,
      }),
    ).toEqual({ ok: false, reason: "price_not_below_average" });
  });

  it("rejects zero shares and invalid numbers", () => {
    expect(
      sharesToHitAverage({
        shares: 0,
        avgCost: 60,
        price: 36,
        targetAvg: 50,
      }),
    ).toEqual({ ok: false, reason: "no_shares" });
    expect(
      sharesToHitAverage({
        shares: Number.NaN,
        avgCost: 60,
        price: 36,
        targetAvg: 50,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("average-down query string", () => {
  it("round-trips simple inputs including optional portfolio and target", () => {
    const qs = serializeAverageDownQuery({
      ...AVERAGE_DOWN_DEFAULTS,
      portfolio: "100000",
      targetAvg: "50",
    });
    const parsed = parseAverageDownQuery(Object.fromEntries(new URLSearchParams(qs)));
    expect(parsed.positionMode).toBe("simple");
    expect(parsed.shares).toBe("100");
    expect(parsed.avgCost).toBe("60");
    expect(parsed.price).toBe("36");
    expect(parsed.addMode).toBe("dollars");
    expect(parsed.add).toBe("3000");
    expect(parsed.portfolio).toBe("100000");
    expect(parsed.targetAvg).toBe("50");
  });

  it("round-trips a list of buys", () => {
    const qs = serializeAverageDownQuery({
      ...AVERAGE_DOWN_DEFAULTS,
      positionMode: "lots",
      lots: [
        { shares: "50", price: "80" },
        { shares: "50", price: "40.5" },
      ],
    });
    expect(qs).toContain("lots=50x80%2C50x40.5");
    const parsed = parseAverageDownQuery(Object.fromEntries(new URLSearchParams(qs)));
    expect(parsed.positionMode).toBe("lots");
    expect(parsed.lots).toEqual([
      { shares: "50", price: "80" },
      { shares: "50", price: "40.5" },
    ]);
  });

  it("uses defaults when the query is empty", () => {
    expect(hasAverageDownQuery({})).toBe(false);
    expect(parseAverageDownQuery({})).toEqual(AVERAGE_DOWN_DEFAULTS);
  });
});
