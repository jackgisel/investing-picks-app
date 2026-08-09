import { describe, expect, it } from "vitest";
import {
  movesInWeek,
  periodLabel,
  weekChangePct,
} from "@/lib/weekly-summary";
import { isoWeekKey } from "@/lib/email-dispatch";

/**
 * The digest's arithmetic and its dedupe key. The fan-out itself is the same
 * chunked loop the pick announcement uses and is covered there.
 */

describe("weekChangePct", () => {
  // The series carries SINCE-INCEPTION returns, so the week's move is the
  // difference between two points on it — not the last point, which is the
  // whole run. Getting this wrong publishes the lifetime return as "this week".
  it("is the change between the points, not the latest point", () => {
    const change = weekChangePct([
      { date: "2026-08-01", return_pct: 20 },
      { date: "2026-08-08", return_pct: 32 },
    ]);
    // 1.32 / 1.20 - 1 = 10%
    expect(change).toBeCloseTo(10, 4);
  });

  it("compares against the last point at or before the cutoff", () => {
    const change = weekChangePct([
      { date: "2026-07-20", return_pct: 5 },
      { date: "2026-08-01", return_pct: 20 },
      { date: "2026-08-05", return_pct: 25 },
      { date: "2026-08-08", return_pct: 32 },
    ]);
    // 2026-08-01 is the last point on or before 2026-08-01 (08-08 minus 7).
    expect(change).toBeCloseTo(10, 4);
  });

  it("returns null when nothing is a week old", () => {
    // A four-day-old book has no "this week" figure that means what the label
    // says, and inventing one from the whole run is the bug this guards.
    expect(
      weekChangePct([
        { date: "2026-08-06", return_pct: 1 },
        { date: "2026-08-08", return_pct: 4 },
      ]),
    ).toBeNull();
  });

  it("handles a losing week", () => {
    const change = weekChangePct([
      { date: "2026-08-01", return_pct: 20 },
      { date: "2026-08-08", return_pct: 8 },
    ]);
    // 1.08 / 1.20 - 1 = -10%
    expect(change).toBeCloseTo(-10, 4);
  });

  it("is null on a series too short to compare", () => {
    expect(weekChangePct([])).toBeNull();
    expect(weekChangePct([{ date: "2026-08-08", return_pct: 4 }])).toBeNull();
  });
});

describe("movesInWeek", () => {
  const weekEnd = new Date("2026-08-09T00:00:00Z");

  it("keeps trades inside the seven-day window", () => {
    const moves = movesInWeek(
      [
        { ticker: "wdc", side: "buy", date: "2026-08-05" },
        { ticker: "AMD", side: "sell", date: "2026-08-03" },
      ],
      weekEnd,
    );
    expect(moves.map((m) => m.ticker)).toEqual(["WDC", "AMD"]);
  });

  it("drops trades outside it", () => {
    expect(
      movesInWeek([{ ticker: "OLD", side: "buy", date: "2026-07-01" }], weekEnd),
    ).toEqual([]);
  });

  it("uses reader-facing words, never the internal action vocabulary", () => {
    // Leaking "conviction_add" / "winners_circle_trim" into subscriber-facing
    // copy is a mistake this codebase has already had to fix once.
    const moves = movesInWeek(
      [{ ticker: "WDC", side: "sell", date: "2026-08-05" }],
      weekEnd,
    );
    expect(moves[0].action).toBe("Sold");
  });

  it("ignores rows with no ticker or no date", () => {
    expect(
      movesInWeek(
        [
          { ticker: null, side: "buy", date: "2026-08-05" },
          { ticker: "WDC", side: "buy", date: null },
        ],
        weekEnd,
      ),
    ).toEqual([]);
  });
});

describe("periodLabel", () => {
  it("collapses the month when the week does not span one", () => {
    expect(periodLabel(new Date("2026-08-09T00:00:00Z"))).toBe(
      "3–9 August 2026",
    );
  });

  it("names both months when it does", () => {
    expect(periodLabel(new Date("2026-08-02T00:00:00Z"))).toBe(
      "27 July–2 August 2026",
    );
  });
});

describe("isoWeekKey", () => {
  it("gives one key for every day of the same ISO week", () => {
    // The claim key. If two days of one week produced different keys the
    // digest would send more than once.
    const monday = isoWeekKey(new Date("2026-08-03T12:00:00Z"));
    const sunday = isoWeekKey(new Date("2026-08-09T12:00:00Z"));
    expect(monday).toBe(sunday);
  });

  it("rolls to a new key on Monday", () => {
    expect(isoWeekKey(new Date("2026-08-09T12:00:00Z"))).not.toBe(
      isoWeekKey(new Date("2026-08-10T12:00:00Z")),
    );
  });

  it("puts a year-end week in the year owning its Thursday", () => {
    // 2026-12-31 is a Thursday, so that week is 2026-W53 and not 2027-W01.
    expect(isoWeekKey(new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53");
    // 2027-01-04 is the Monday of 2027-W01.
    expect(isoWeekKey(new Date("2027-01-04T12:00:00Z"))).toBe("2027-W01");
  });
});
