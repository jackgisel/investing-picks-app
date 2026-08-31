import { describe, expect, it } from "vitest";
import {
  CTA_DESTINATIONS,
  kindDirectives,
  pickSpotlightIndex,
  POST_BOUNDS,
  postLengths,
  rollUpSectors,
  threadDedupeKey,
  validateCta,
  weekAheadFraming,
} from "@/lib/x-thread-draft";
import { SITE_URL } from "@/lib/constants";

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

describe("threadDedupeKey for the reach formats", () => {
  it("keys the hot take on the day, like the spotlight it runs beside", () => {
    expect(threadDedupeKey("hot_take", new Date("2026-08-24T06:45:00Z"))).toBe(
      threadDedupeKey("hot_take", new Date("2026-08-24T19:00:00Z")),
    );
    expect(threadDedupeKey("hot_take", new Date("2026-08-24T12:00:00Z"))).not.toBe(
      threadDedupeKey("hot_take", new Date("2026-08-25T12:00:00Z")),
    );
  });

  it("keys the weekly reach formats on the week", () => {
    const wed = new Date("2026-08-26T12:00:00Z");
    const thu = new Date("2026-08-27T12:00:00Z");
    for (const kind of ["leaderboard", "poll_prompt"] as const) {
      expect(threadDedupeKey(kind, wed)).toBe(threadDedupeKey(kind, thu));
    }
  });
});

describe("POST_BOUNDS", () => {
  it("caps the short formats so they cannot be stretched into threads", () => {
    expect(POST_BOUNDS.hot_take).toEqual({ min: 2, max: 2 });
    expect(POST_BOUNDS.poll_prompt).toEqual({ min: 2, max: 2 });
    expect(POST_BOUNDS.leaderboard.max).toBeLessThan(POST_BOUNDS.weekly_review.max);
  });

  it("leaves room for a CTA post on top of every long thread", () => {
    // The CTA post is counted in the bound, so a long thread's floor has to
    // be above the four body posts the shared rules ask for.
    for (const kind of ["weekly_review", "market", "pick", "spotlight", "sunday_review"] as const) {
      expect(POST_BOUNDS[kind].min).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("CTA_DESTINATIONS", () => {
  it("points every kind at a route that exists on the site", () => {
    const real = ["/track-record", "/strategy", "/market-note"];
    for (const kind of Object.keys(POST_BOUNDS) as (keyof typeof POST_BOUNDS)[]) {
      const { url } = CTA_DESTINATIONS[kind];
      expect(url.startsWith(SITE_URL)).toBe(true);
      expect(real).toContain(url.slice(SITE_URL.length));
    }
  });

  it("sends the screen-driven formats to the page explaining the screen", () => {
    // A reader arriving from a list of names we do NOT own needs the rating
    // explained before they see what we actually bought.
    expect(CTA_DESTINATIONS.leaderboard.url).toBe(`${SITE_URL}/strategy`);
    expect(CTA_DESTINATIONS.spotlight.url).toBe(`${SITE_URL}/strategy`);
  });
});

describe("kindDirectives", () => {
  it("states an exact count for a fixed-length format", () => {
    expect(kindDirectives("hot_take")).toContain("exactly 2 posts");
  });

  it("states a range for the long threads", () => {
    expect(kindDirectives("weekly_review")).toContain("between 5 and 13 posts");
  });

  it("names the kind's own CTA url", () => {
    expect(kindDirectives("sunday_review")).toContain(`${SITE_URL}/market-note`);
    expect(kindDirectives("sunday_review")).not.toContain("/track-record");
  });
});

describe("validateCta", () => {
  const url = `${SITE_URL}/track-record`;

  it("passes a thread whose only link is in the last post", () => {
    expect(validateCta(["A real hook", "The payoff", `More at ${url}`], url)).toEqual([]);
  });

  it("catches a missing CTA link, which is the whole point of the thread", () => {
    expect(validateCta(["A real hook", "The payoff", "Read the full note"], url))
      .toEqual([`the last post does not carry the CTA link ${url}`]);
  });

  it("catches a link in the body, which is billed at 13x per post", () => {
    const problems = validateCta(["Hook", `See ${url}`, `More at ${url}`], url);
    expect(problems).toEqual(["post 2 contains a link — only the last post may have one"]);
  });

  it("catches a bare domain in the body, not just an https:// one", () => {
    // `containsUrl` matches what X linkifies, and X linkifies bare domains.
    const problems = validateCta(["Hook", "outpick.xyz/track-record", `More at ${url}`], url);
    expect(problems).toHaveLength(1);
  });

  it("does not mistake ordinary prose for a link", () => {
    const posts = ["Up 1.5% in Q3. The Fed. Then the market moved.", `More at ${url}`];
    expect(validateCta(posts, url)).toEqual([]);
  });
});
