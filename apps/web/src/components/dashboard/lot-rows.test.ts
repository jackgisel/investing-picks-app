import { describe, expect, it } from "vitest";
import type { Holding } from "@/lib/hooks/use-strategy";
import { asLotRows, holdingRowKey } from "./positions-model";

const sezl: Holding = {
  ticker: "SEZL",
  entry_date: "2026-04-10",
  pnl_pct: 34.5,
  weight_pct: 15,
  lots: [
    { lot: 1, kind: "entry", entry_date: "2026-04-10", share: 2 / 3, pnl_pct: 80 },
    { lot: 2, kind: "add", entry_date: "2026-09-04", share: 1 / 3, pnl_pct: -10 },
  ],
};

describe("asLotRows", () => {
  it("splits a double buy into one row per buy", () => {
    const rows = asLotRows([sezl]);
    expect(rows.map((r) => [r.entry_date, r.pnl_pct, r.lot_kind])).toEqual([
      ["2026-04-10", 80, "entry"],
      ["2026-09-04", -10, "add"],
    ]);
    expect(rows[0].weight_pct).toBeCloseTo(10);
    expect(rows[1].weight_pct).toBeCloseTo(5);
  });

  it("leaves a single-buy holding alone", () => {
    const one: Holding = { ticker: "WT", entry_date: "2026-05-01", pnl_pct: 45, lots: [
      { lot: 1, kind: "entry", entry_date: "2026-05-01", share: 1, pnl_pct: 45 },
    ] };
    expect(asLotRows([one])).toEqual([one]);
  });

  it("keys rows uniquely when one ticker spans two", () => {
    const keys = asLotRows([sezl]).map(holdingRowKey);
    expect(new Set(keys).size).toBe(2);
  });
});
