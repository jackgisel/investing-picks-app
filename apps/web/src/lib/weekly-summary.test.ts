import { describe, expect, it } from "vitest";
import {
  movesInWeek,
  periodLabel,
} from "@/lib/weekly-summary";
import { isoWeekKey } from "@/lib/email-dispatch";

/**
 * The digest's arithmetic and its dedupe key. The fan-out itself is the same
 * chunked loop the pick announcement uses and is covered there.
 */

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

  it("calls a double buy Added to, not Bought", () => {
    const moves = movesInWeek(
      [
        {
          ticker: "SEZL",
          side: "buy",
          action: "double_buy",
          date: "2026-08-05",
        },
      ],
      weekEnd,
    );
    expect(moves[0].action).toBe("Added to");
  });

  it("formats trade dates American month-first", () => {
    const moves = movesInWeek(
      [{ ticker: "WDC", side: "buy", date: "2026-08-05" }],
      weekEnd,
    );
    expect(moves[0].when).toBe("Wed, Aug 5");
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
      "August 3–9, 2026",
    );
  });

  it("names both months when it does", () => {
    expect(periodLabel(new Date("2026-08-02T00:00:00Z"))).toBe(
      "July 27–August 2, 2026",
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
