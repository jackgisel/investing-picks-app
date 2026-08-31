import { describe, expect, it } from "vitest";
import {
  pickSpotlightIndex,
  postLengths,
  rollUpSectors,
  threadDedupeKey,
  weekAheadFraming,
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

  it("keys the sunday review on the week it is about, not the one ending", () => {
    // Drafted Sunday evening; the thread argues about the week starting Monday.
    const sundayNight = new Date("2026-08-30T23:30:00Z");
    const mondayOfTargetWeek = new Date("2026-08-31T12:00:00Z");
    expect(threadDedupeKey("sunday_review", sundayNight)).toBe(
      threadDedupeKey("market", mondayOfTargetWeek),
    );
    // ...and so does not collide with Friday's weekly review of the week just
    // gone, which is the bug this avoids.
    expect(threadDedupeKey("sunday_review", sundayNight)).not.toBe(
      threadDedupeKey("sunday_review", new Date("2026-08-23T23:30:00Z")),
    );
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
  const full = { candidate: 3, sector: 5, news: 4 };

  it("is deterministic within a day regardless of time of day", () => {
    const morning = new Date("2026-08-24T06:00:00Z");
    const evening = new Date("2026-08-24T18:00:00Z");
    expect(pickSpotlightIndex(morning, full)).toEqual(pickSpotlightIndex(evening, full));
  });

  it("cycles through all three sources rather than alternating between two", () => {
    const focuses = [0, 1, 2].map(
      (i) => pickSpotlightIndex(new Date(Date.UTC(2026, 0, 1 + i)), full)?.focus,
    );
    expect(new Set(focuses)).toEqual(new Set(["candidate", "sector", "news"]));
  });

  it("falls back to sector and news when there are no candidates", () => {
    const counts = { candidate: 0, sector: 5, news: 4 };
    for (let i = 0; i < 10; i++) {
      const pick = pickSpotlightIndex(new Date(Date.UTC(2026, 0, 1 + i)), counts);
      expect(pick?.focus).not.toBe("candidate");
    }
  });

  it("falls back to candidate only when sector and news are both empty", () => {
    const counts = { candidate: 3, sector: 0, news: 0 };
    for (let i = 0; i < 10; i++) {
      const pick = pickSpotlightIndex(new Date(Date.UTC(2026, 0, 1 + i)), counts);
      expect(pick?.focus).toBe("candidate");
      expect(pick?.index).toBeLessThan(3);
    }
  });

  it("returns null when there is nothing to spotlight", () => {
    expect(
      pickSpotlightIndex(new Date("2026-08-24T12:00:00Z"), { candidate: 0, sector: 0, news: 0 }),
    ).toBeNull();
  });

  it("keeps indices in range across many days", () => {
    const bounds = full;
    for (let i = 0; i < 30; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i));
      const pick = pickSpotlightIndex(day, full);
      expect(pick).not.toBeNull();
      expect(pick!.index).toBeGreaterThanOrEqual(0);
      expect(pick!.index).toBeLessThan(bounds[pick!.focus]);
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

describe("weekAheadFraming", () => {
  // The first production draft opened "Sunday review for August 25-31, 2026"
  // and reviewed the week that had just finished, because that is the label
  // the payload handed the model.
  const sundayNight = new Date("2026-08-30T23:30:00Z");

  it("labels the week that starts tomorrow, not the one ending tonight", () => {
    const framing = weekAheadFraming(sundayNight);
    expect(framing.period_label).toBe("August 31\u2013September 6, 2026");
    expect(framing.week_key).toBe("2026-W36");
  });

  it("drops per-holding detail so the thread cannot argue single positions", () => {
    const framing = weekAheadFraming(sundayNight);
    expect(framing.holdings).toEqual([]);
    expect(framing.moves).toEqual([]);
  });
});
