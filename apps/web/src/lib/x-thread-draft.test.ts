import { describe, expect, it } from "vitest";
import {
  pickSpotlightIndex,
  postLengths,
  rollUpSectors,
  threadDedupeKey,
} from "@/lib/x-thread-draft";

type Holding = Parameters<typeof rollUpSectors>[0][number];

function holding(partial: Partial<Holding>): Holding {
  return {
    ticker: "AAA",
    pnl_pct: null,
    weight_pct: null,
    sector: null,
    quant_rating: null,
    quant_rating_display: null,
    signal: null,
    entry_date: null,
    ...partial,
  };
}

describe("rollUpSectors", () => {
  it("groups holdings and averages their P&L", () => {
    const rollup = rollUpSectors([
      holding({ ticker: "A", sector: "Technology", pnl_pct: 10 }),
      holding({ ticker: "B", sector: "Technology", pnl_pct: 20 }),
      holding({ ticker: "C", sector: "Energy", pnl_pct: -5 }),
    ]);

    expect(rollup).toEqual([
      { sector: "Technology", positions: 2, mean_pnl_pct: 15 },
      { sector: "Energy", positions: 1, mean_pnl_pct: -5 },
    ]);
  });

  it("buckets a missing sector as Unclassified rather than dropping it", () => {
    const rollup = rollUpSectors([
      holding({ ticker: "A", sector: null, pnl_pct: 4 }),
      holding({ ticker: "B", sector: "   ", pnl_pct: 6 }),
    ]);
    expect(rollup).toEqual([
      { sector: "Unclassified", positions: 2, mean_pnl_pct: 5 },
    ]);
  });

  it("counts a position with no P&L but reports the sector mean as null", () => {
    const rollup = rollUpSectors([
      holding({ ticker: "A", sector: "Energy", pnl_pct: null }),
    ]);
    // The position is real and belongs in the count; inventing 0% for it
    // would put a fabricated number in front of the model.
    expect(rollup).toEqual([
      { sector: "Energy", positions: 1, mean_pnl_pct: null },
    ]);
  });

  it("averages only the holdings that have a P&L", () => {
    const rollup = rollUpSectors([
      holding({ ticker: "A", sector: "Energy", pnl_pct: 10 }),
      holding({ ticker: "B", sector: "Energy", pnl_pct: null }),
    ]);
    expect(rollup[0]).toEqual({
      sector: "Energy",
      positions: 2,
      mean_pnl_pct: 10,
    });
  });

  it("sorts the largest sector first", () => {
    const rollup = rollUpSectors([
      holding({ ticker: "A", sector: "Energy", pnl_pct: 1 }),
      holding({ ticker: "B", sector: "Tech", pnl_pct: 1 }),
      holding({ ticker: "C", sector: "Tech", pnl_pct: 1 }),
    ]);
    expect(rollup.map((r) => r.sector)).toEqual(["Tech", "Energy"]);
  });

  it("returns nothing for an empty book", () => {
    expect(rollUpSectors([])).toEqual([]);
  });
});

describe("threadDedupeKey", () => {
  it("keys on the ISO week so a re-fired job finds the same draft", () => {
    const monday = new Date("2026-08-24T12:00:00Z");
    const thursday = new Date("2026-08-27T12:00:00Z");
    expect(threadDedupeKey("weekly_review", monday)).toBe(
      threadDedupeKey("weekly_review", thursday),
    );
  });

  it("separates weeks", () => {
    expect(threadDedupeKey("market", new Date("2026-08-24T12:00:00Z"))).not.toBe(
      threadDedupeKey("market", new Date("2026-08-31T12:00:00Z")),
    );
  });

  it("appends a suffix for more than one thread of a kind in a week", () => {
    const week = new Date("2026-08-24T12:00:00Z");
    expect(threadDedupeKey("pick", week, "NVDA")).toMatch(/:NVDA$/);
  });

  it("keys the spotlight kind on the day, not the week", () => {
    const monday = new Date("2026-08-24T12:00:00Z");
    const tuesday = new Date("2026-08-25T12:00:00Z");
    expect(threadDedupeKey("spotlight", monday)).not.toBe(
      threadDedupeKey("spotlight", tuesday),
    );
    // Same calendar day, different times: a re-fired job must find the same row.
    expect(threadDedupeKey("spotlight", new Date("2026-08-24T06:00:00Z"))).toBe(
      threadDedupeKey("spotlight", new Date("2026-08-24T18:00:00Z")),
    );
  });
});

describe("pickSpotlightIndex", () => {
  it("is deterministic within a day regardless of time of day", () => {
    const morning = new Date("2026-08-24T06:00:00Z");
    const evening = new Date("2026-08-24T18:00:00Z");
    expect(pickSpotlightIndex(morning, 3, 5)).toEqual(pickSpotlightIndex(evening, 3, 5));
  });

  it("alternates focus on consecutive days", () => {
    const day1 = pickSpotlightIndex(new Date("2026-08-24T12:00:00Z"), 3, 5);
    const day2 = pickSpotlightIndex(new Date("2026-08-25T12:00:00Z"), 3, 5);
    expect(day1?.focus).not.toBe(day2?.focus);
  });

  it("falls back to sector when there are no candidates", () => {
    const pick = pickSpotlightIndex(new Date("2026-08-24T12:00:00Z"), 0, 5);
    expect(pick?.focus).toBe("sector");
    expect(pick?.index).toBeLessThan(5);
  });

  it("falls back to candidate when there are no sectors", () => {
    const pick = pickSpotlightIndex(new Date("2026-08-24T12:00:00Z"), 3, 0);
    expect(pick?.focus).toBe("candidate");
    expect(pick?.index).toBeLessThan(3);
  });

  it("returns null when there is nothing to spotlight", () => {
    expect(pickSpotlightIndex(new Date("2026-08-24T12:00:00Z"), 0, 0)).toBeNull();
  });

  it("keeps indices in range across many days", () => {
    for (let i = 0; i < 30; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i));
      const pick = pickSpotlightIndex(day, 3, 5);
      expect(pick).not.toBeNull();
      const bound = pick!.focus === "candidate" ? 3 : 5;
      expect(pick!.index).toBeGreaterThanOrEqual(0);
      expect(pick!.index).toBeLessThan(bound);
    }
  });
});

describe("postLengths", () => {
  it("reports the count the editor shows per post", () => {
    expect(postLengths(["abc", "see https://a-very-long-url.example.com/x"])).toEqual([
      3,
      "see ".length + 23,
    ]);
  });
});
