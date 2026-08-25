import { describe, expect, it } from "vitest";
import type {
  PeriodPositionRow,
  PeriodSummary,
} from "./hooks/use-period-returns";
import {
  coverageNote,
  partialNote,
  periodCaption,
  sleeveNote,
  sortByPeriod,
} from "./period-returns";

function row(
  ticker: string,
  returns: { day?: number | null; week?: number | null; month?: number | null },
  partial: { day?: boolean; week?: boolean; month?: boolean } = {},
): PeriodPositionRow {
  const cell = (p: "day" | "week" | "month") => ({
    return_pct: returns[p] ?? null,
    from_date: "2026-08-21",
    partial: partial[p] ?? false,
  });
  return {
    ticker,
    entry_date: "2026-07-01",
    sector: "Tech",
    periods: { day: cell("day"), week: cell("week"), month: cell("month") },
  };
}

function summary(over: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    id: "week",
    label: "Week to date",
    from_date: "2026-08-21",
    book_return_pct: 1.2,
    spy_return_pct: 0.4,
    open_picks_return_pct: 2.1,
    open_picks_positions: 7,
    open_picks_excluded_new: 0,
    ...over,
  };
}

describe("periodCaption", () => {
  it("names the session the period is measured from", () => {
    // Friday's close, not Monday's open — the reader cannot infer that from
    // the percentage alone.
    expect(periodCaption(summary())).toBe("since Fri, Aug 21 close");
  });

  it("says so when there is no prior session to measure from", () => {
    expect(periodCaption(summary({ from_date: null }))).toBe("No prior session");
    expect(periodCaption(undefined)).toBe("No prior session");
  });
});

describe("partialNote", () => {
  it("is null for a position held for the whole window", () => {
    expect(partialNote(row("AAA", { week: 5 }), "week")).toBeNull();
  });

  it("names the entry date when the window opened before we owned it", () => {
    const r = row("BBB", { week: 5 }, { week: true });
    expect(partialNote(r, "week")).toBe("since entry Fri, Aug 21");
  });
});

describe("sleeveNote / coverageNote", () => {
  it("stays silent when the sleeve covers every pick", () => {
    expect(sleeveNote(summary())).toBeNull();
    expect(coverageNote(summary())).toBeNull();
  });

  it("qualifies a sleeve that left new picks out", () => {
    const s = summary({ open_picks_positions: 7, open_picks_excluded_new: 2 });
    expect(sleeveNote(s)).toBe("2 newer picks excluded");
    expect(coverageNote(s)).toBe("7 of 9 picks");
  });

  it("uses the singular for one exclusion", () => {
    expect(sleeveNote(summary({ open_picks_excluded_new: 1 }))).toBe(
      "1 newer pick excluded",
    );
  });
});

describe("sortByPeriod", () => {
  const rows = [
    row("FLAT", { day: 0 }),
    row("UP", { day: 4 }),
    row("UNKNOWN", { day: null }),
    row("DOWN", { day: -3 }),
  ];

  it("sorts descending with unknowns last", () => {
    expect(sortByPeriod(rows, "day").map((r) => r.ticker)).toEqual([
      "UP",
      "FLAT",
      "DOWN",
      "UNKNOWN",
    ]);
  });

  it("keeps unknowns last when the direction flips", () => {
    // An unknown is not the worst performer either — flipping the sort must
    // not promote it to the top of the losers.
    expect(sortByPeriod(rows, "day", "asc").map((r) => r.ticker)).toEqual([
      "DOWN",
      "FLAT",
      "UP",
      "UNKNOWN",
    ]);
  });

  it("sorts each period independently", () => {
    const mixed = [row("A", { day: 1, month: -9 }), row("B", { day: -1, month: 9 })];
    expect(sortByPeriod(mixed, "day").map((r) => r.ticker)).toEqual(["A", "B"]);
    expect(sortByPeriod(mixed, "month").map((r) => r.ticker)).toEqual(["B", "A"]);
  });
});
