import { describe, expect, it } from "vitest";
import type { MonthReturn, ScorecardPick } from "@/lib/hooks/use-track-record";
import {
  daysHeld,
  formatMonth,
  monthGrid,
  monthStats,
  scorecardStats,
} from "./track-record";

function pick(over: Partial<ScorecardPick>): ScorecardPick {
  return {
    ticker: "AAA",
    status: "active",
    entry_date: "2026-04-01",
    exit_date: null,
    return_pct: 0,
    spy_pct: 0,
    excess_pct: 0,
    ...over,
  };
}

function month(m: string, picks: number | null, spy: number | null): MonthReturn {
  return { month: m, picks_pct: picks, spy_pct: spy, partial: false };
}

describe("scorecardStats", () => {
  const stats = scorecardStats([
    pick({ ticker: "A", return_pct: 120, excess_pct: 100 }),
    pick({ ticker: "B", return_pct: 10, excess_pct: -2 }),
    pick({ ticker: "C", status: "closed", return_pct: -8, excess_pct: -12 }),
    pick({ ticker: "D", status: "closed", return_pct: 30, excess_pct: 25 }),
    pick({ ticker: "E", return_pct: null, spy_pct: null, excess_pct: null }),
  ]);

  it("counts picks ahead of the S&P, excluding unknowns", () => {
    expect(stats.beatSpy).toEqual({ n: 2, of: 4, pct: 50 });
  });

  it("rates closed picks only for the win rate", () => {
    expect(stats.closedWins).toEqual({ n: 1, of: 2, pct: 50 });
    expect(stats.open).toBe(3);
    expect(stats.closed).toBe(2);
  });

  it("finds the median, best, worst and doublers", () => {
    expect(stats.medianReturnPct).toBe(20);
    expect(stats.medianExcessPct).toBe(11.5);
    expect(stats.best?.ticker).toBe("A");
    expect(stats.worst?.ticker).toBe("C");
    expect(stats.doubled).toBe(1);
  });

  it("returns no ratios for an empty record rather than 0%", () => {
    const empty = scorecardStats([]);
    expect(empty.beatSpy.pct).toBeNull();
    expect(empty.medianReturnPct).toBeNull();
    expect(empty.best).toBeNull();
  });

  it("does not name the same pick best and worst", () => {
    expect(scorecardStats([pick({ return_pct: 5 })]).worst).toBeNull();
  });
});

describe("monthStats", () => {
  it("counts months ahead of the S&P and up months", () => {
    const s = monthStats([
      month("2026-04", 5, 2),
      month("2026-05", -1, 1),
      month("2026-06", 3, null),
    ]);
    expect(s.beatSpy).toEqual({ n: 1, of: 2, pct: 50 });
    expect(s.positive).toEqual({ n: 2, of: 3, pct: (2 / 3) * 100 });
    expect(s.best?.month).toBe("2026-04");
    expect(s.worst?.month).toBe("2026-05");
  });
});

describe("monthGrid", () => {
  it("places months by calendar slot, newest year first", () => {
    const grid = monthGrid([month("2025-12", 1, 1), month("2026-02", 2, 2)]);
    expect(grid.map((r) => r.year)).toEqual([2026, 2025]);
    expect(grid[0].cells[1]?.month).toBe("2026-02");
    expect(grid[0].cells[0]).toBeNull();
    expect(grid[1].cells[11]?.month).toBe("2025-12");
  });
});

describe("formatMonth / daysHeld", () => {
  it("formats a month label", () => {
    expect(formatMonth("2026-05")).toBe("May 2026");
  });

  it("measures open picks to as-of and closed picks to exit", () => {
    expect(daysHeld({ entry_date: "2026-04-01", exit_date: null }, "2026-04-11")).toBe(10);
    expect(
      daysHeld({ entry_date: "2026-04-01", exit_date: "2026-04-03" }, "2026-09-01"),
    ).toBe(2);
    expect(daysHeld({ entry_date: null, exit_date: null }, "2026-09-01")).toBeNull();
  });
});
