import { describe, expect, it } from "vitest";
import { activeHref, covers, flatten, visibleGroups } from "./nav-model";
import {
  asShareOfInvested,
  groupBySector,
  investedWeightTotal,
  sectorPositionCap,
  shareOfInvested,
  UNCLASSIFIED,
} from "./sector-model";
import { actionMeta } from "./trade-action";
import {
  insightForTicker,
  insightsForTickers,
  type InsightMeta,
} from "@/lib/insights";

/**
 * Notes are database rows now, so these fixtures stand in for what
 * /api/data/insights returns. The lookups stayed pure precisely so the
 * matching rules could still be tested without a database.
 */
function note(ticker: string | null, publishedAt: string): InsightMeta {
  return {
    id: `${ticker ?? "q"}-id`,
    slug: `${(ticker ?? "quarterly").toLowerCase()}-note`,
    ticker,
    postType: ticker ? "pick" : "quarterly_review",
    status: "approved",
    title: `${ticker ?? "Quarterly"} note`,
    description: "d",
    readingTime: 7,
    tags: [],
    author: null,
    quarter: null,
    publishedAt,
    // Approved notes have no pending deadline — the send already happened.
    autoPublishAt: null,
    confirmedAt: null,
    publicSampleAt: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  };
}

// Newest first, the order listInsights returns.
const NOTES: InsightMeta[] = [
  note("WDC", "2026-07-17T00:00:00.000Z"),
  note("SOFI", "2026-06-05T00:00:00.000Z"),
  note("SEZL", "2026-04-10T00:00:00.000Z"),
];

const ALL = flatten(visibleGroups(true));

describe("covers", () => {
  it("matches a route and its children", () => {
    expect(covers("/dashboard/ops", "/dashboard/ops")).toBe(true);
    expect(covers("/dashboard/ops/book", "/dashboard/ops")).toBe(true);
  });

  // The reason this is a helper and not `startsWith`.
  it("does not match a route that merely shares a prefix", () => {
    expect(covers("/dashboard/opsfoo", "/dashboard/ops")).toBe(false);
    expect(covers("/dashboard/positions", "/dashboard/position")).toBe(false);
  });
});

describe("activeHref", () => {
  it("highlights the dashboard only on the dashboard", () => {
    expect(activeHref("/dashboard", ALL)).toBe("/dashboard");
  });

  it("gives a child route to its own item, not to the dashboard", () => {
    expect(activeHref("/dashboard/positions", ALL)).toBe("/dashboard/positions");
    expect(activeHref("/dashboard/insights", ALL)).toBe("/dashboard/insights");
  });

  it("keeps an insight article on Insights", () => {
    expect(activeHref("/dashboard/insights/wdc-western-digital", ALL)).toBe(
      "/dashboard/insights",
    );
  });

  // Longest match wins: /dashboard/ops/book must not resolve to /dashboard/ops.
  it("prefers the more specific of two nested admin items", () => {
    expect(activeHref("/dashboard/ops/book", ALL)).toBe("/dashboard/ops/book");
    expect(activeHref("/dashboard/ops", ALL)).toBe("/dashboard/ops");
  });

  // The bug the `owns` list exists to fix: these used to highlight nothing.
  it("routes owned child pages to their owner", () => {
    expect(activeHref("/dashboard/ops/positions", ALL)).toBe(
      "/dashboard/ops/book",
    );
    expect(activeHref("/dashboard/ops/evaluations/42", ALL)).toBe(
      "/dashboard/ops",
    );
  });

  // Easy to regress into: /dashboard/ops/positions vs /dashboard/positions.
  it("does not confuse the admin positions page with the member one", () => {
    expect(activeHref("/dashboard/ops/positions", ALL)).not.toBe(
      "/dashboard/positions",
    );
  });

  it("returns null for a path outside the nav", () => {
    expect(activeHref("/login", ALL)).toBeNull();
  });

  // The footer group is not rendered inside <nav>, but it IS in the model, so
  // its rows must highlight like any other. Regressing this looks like a
  // sidebar where clicking Settings selects nothing.
  it("highlights footer items", () => {
    expect(activeHref("/dashboard/settings", ALL)).toBe("/dashboard/settings");
    expect(activeHref("/dashboard/feature-requests", ALL)).toBe(
      "/dashboard/feature-requests",
    );
  });

  // Same trap as ops/positions vs positions, with the same two names.
  it("does not confuse the admin feature requests page with the member one", () => {
    expect(activeHref("/dashboard/ops/feature-requests", ALL)).toBe(
      "/dashboard/ops/feature-requests",
    );
    expect(activeHref("/dashboard/feature-requests", ALL)).not.toBe(
      "/dashboard/ops/feature-requests",
    );
  });
});

describe("visibleGroups", () => {
  it("shows a non-admin the product nav and the footer", () => {
    const groups = visibleGroups(false);
    expect(groups).toHaveLength(2);
    expect(flatten(groups).map((i) => i.label)).toEqual([
      "Dashboard",
      "Positions",
      "Insights",
      "Strategy",
      "Feature requests",
      "Settings",
    ]);
  });

  // Settings shares the avatar's row as an icon; Feature requests takes a
  // labelled row of its own. Flipping either changes the footer's layout.
  it("marks only Settings as inline", () => {
    const footer = visibleGroups(false).find((g) => g.footer);
    expect(footer?.items.filter((i) => i.inline).map((i) => i.label)).toEqual([
      "Settings",
    ]);
  });

  // An icon-only control still needs a name for the aria-label.
  it("gives every inline item a label to name it by", () => {
    for (const item of flatten(visibleGroups(true)).filter((i) => i.inline)) {
      expect(item.label.trim()).not.toBe("");
    }
  });

  // The sidebar renders these outside the scrolling <nav>, so it needs the
  // flag to find them — and the product group must not carry it.
  it("marks exactly one group as the footer, and it is last", () => {
    const groups = visibleGroups(true);
    expect(groups.filter((g) => g.footer)).toHaveLength(1);
    expect(groups[groups.length - 1].footer).toBe(true);
    expect(groups[0].footer).toBeUndefined();
  });

  // The nav used to advertise ops pages that then 404'd.
  it("leaks no admin href to a non-admin", () => {
    const hrefs = flatten(visibleGroups(false)).map((i) => i.href);
    expect(hrefs.some((h) => h.startsWith("/dashboard/ops"))).toBe(false);
    expect(hrefs).not.toContain("/dashboard/dca");
  });

  it("gives an admin a separate, labelled group", () => {
    const groups = visibleGroups(true);
    expect(groups).toHaveLength(3);
    expect(groups[1].label).toBe("Admin");
    expect(groups[1].items.map((i) => i.href)).toEqual([
      "/dashboard/ops",
      "/dashboard/ops/book",
      "/dashboard/ops/insights",
      "/dashboard/ops/weekly-review",
      "/dashboard/ops/market-note",
      "/dashboard/dca",
      "/dashboard/ops/product-updates",
      "/dashboard/ops/feature-requests",
    ]);
  });
});

describe("groupBySector", () => {
  const holdings = [
    { ticker: "A", pnl_pct: 1, weight_pct: 10, sector: "Technology" },
    { ticker: "B", pnl_pct: 1, weight_pct: 5, sector: "Technology" },
    { ticker: "C", pnl_pct: 1, weight_pct: 20, sector: "Financials" },
    { ticker: "D", pnl_pct: 1, weight_pct: 3, sector: null },
    { ticker: "E", pnl_pct: 1, weight_pct: 2, sector: "   " },
  ] as never;

  it("sums weights and counts per sector", () => {
    const [first] = groupBySector(holdings);
    expect(first).toMatchObject({
      sector: "Financials",
      weightPct: 20,
      count: 1,
    });
  });

  it("orders heaviest first", () => {
    expect(groupBySector(holdings).map((s) => s.sector)).toEqual([
      "Financials",
      "Technology",
      UNCLASSIFIED,
    ]);
  });

  // Dropping these would make the weights add up to something that is not
  // the portfolio.
  it("collapses null and whitespace sectors into one Unclassified bucket", () => {
    const unclassified = groupBySector(holdings).find(
      (s) => s.sector === UNCLASSIFIED,
    );
    expect(unclassified).toMatchObject({ weightPct: 5, count: 2 });
  });

  it("preserves the total weight", () => {
    const total = groupBySector(holdings).reduce((n, s) => n + s.weightPct, 0);
    expect(total).toBe(40);
  });

  it("never gives Unclassified a house colour", () => {
    const unclassified = groupBySector(holdings).find(
      (s) => s.sector === UNCLASSIFIED,
    );
    expect(unclassified!.tone).toBeNull();
  });

  it("gives every real sector a tone", () => {
    for (const s of groupBySector(holdings).filter(
      (s) => s.sector !== UNCLASSIFIED,
    )) {
      expect(s.tone).toBeTruthy();
    }
  });

  it("returns nothing for an empty book", () => {
    expect(groupBySector([])).toEqual([]);
  });
});

describe("shareOfInvested", () => {
  it("returns 0 when nothing is invested", () => {
    expect(shareOfInvested(1.9, 0)).toBe(0);
    expect(shareOfInvested(1.9, -1)).toBe(0);
  });

  it("is 100% for a single name", () => {
    expect(shareOfInvested(1.9, 1.9)).toBe(100);
  });

  it("rebases cash-drag weights onto the open book", () => {
    // 1.9 + 1.2 + 1.0 + 1.0 + 0.9 + 0.9 = 6.9, a trimmed version of the
    // 12.9% invested screenshot: each figure is a share of equity, not of 50.
    const weights = [1.9, 1.2, 1.0, 1.0, 0.9, 0.9];
    const total = weights.reduce((n, w) => n + w, 0);
    const rebased = weights.map((w) => shareOfInvested(w, total));
    expect(rebased[0]).toBeCloseTo((1.9 / 6.9) * 100);
    expect(rebased.reduce((n, w) => n + w, 0)).toBeCloseTo(100);
  });

  it("sums API weights as the invested total", () => {
    expect(
      investedWeightTotal([
        { weight_pct: 7.9 },
        { weight_pct: 1.2 },
        { weight_pct: 1.0 },
        { weight_pct: 1.0 },
        { weight_pct: 0.9 },
        { weight_pct: 0.9 },
      ]),
    ).toBeCloseTo(12.9);
    expect(investedWeightTotal([])).toBe(0);
    expect(investedWeightTotal([{ weight_pct: undefined }])).toBe(0);
  });

  it("rewrites holdings and leaves missing weights missing", () => {
    const [a, b, blank] = asShareOfInvested([
      { ticker: "A", weight_pct: 7.9 },
      { ticker: "B", weight_pct: 5.0 },
      { ticker: "C" },
    ]);
    expect(a.weight_pct).toBeCloseTo((7.9 / 12.9) * 100);
    expect(b.weight_pct).toBeCloseTo((5.0 / 12.9) * 100);
    expect(blank.weight_pct).toBeUndefined();
  });
});

describe("actionMeta", () => {
  it.each([
    ["buy", "Buy", "badge-buy"],
    ["double_buy", "Double buy", "badge-buy"],
    ["full_sell", "Full sell", "badge-sell"],
    ["partial_sell", "Partial sell", "badge-hold"],
    ["trim", "Trim", "badge-hold"],
    ["recycle_trim", "Recycle trim", "badge-hold"],
    ["hold", "Hold", "badge-hold"],
  ] as const)("maps %s to its own label", (action, label, badge) => {
    expect(actionMeta({ action, side: "buy" })).toEqual({ label, badge });
  });

  // A trim on a doubled winner and a stop-out must not look the same.
  it("distinguishes a trim from a full sell", () => {
    const trim = actionMeta({ action: "trim", side: "sell" });
    const stop = actionMeta({ action: "full_sell", side: "sell" });
    expect(trim.badge).not.toBe(stop.badge);
  });

  it("falls back to the side for hand-entered seed trades", () => {
    expect(actionMeta({ action: null, side: "buy" })).toEqual({
      label: "Buy",
      badge: "badge-buy",
    });
    expect(actionMeta({ action: null, side: "sell" })).toEqual({
      label: "Sell",
      badge: "badge-sell",
    });
  });

  it("falls back for an action the frontend does not know", () => {
    expect(
      actionMeta({ action: "some_new_action" as never, side: "sell" }),
    ).toEqual({ label: "Sell", badge: "badge-sell" });
  });

  // Regression: "" is falsy but not nullish, so `(a && MAP[a]) ?? fallback`
  // returned "" and the caller rendered a blank cell with a broken class.
  it("falls back for an empty-string action", () => {
    const meta = actionMeta({ action: "" as never, side: "buy" });
    expect(meta).toEqual({ label: "Buy", badge: "badge-buy" });
    expect(meta.badge).toBeTruthy();
  });
});

describe("insight lookups", () => {
  it("matches a ticker regardless of case", () => {
    expect(insightForTicker(NOTES, "wdc")?.ticker).toBe("WDC");
    expect(insightForTicker(NOTES, "WDC")?.ticker).toBe("WDC");
  });

  it("returns nothing for a ticker with no published note", () => {
    expect(insightForTicker(NOTES, "ZZZZ")).toBeUndefined();
  });

  it("ignores a quarterly review when matching a ticker", () => {
    const withQuarterly = [...NOTES, note(null, "2026-07-01T00:00:00.000Z")];
    expect(insightForTicker(withQuarterly, "WDC")?.ticker).toBe("WDC");
  });

  it("finds every note covering a set of holdings", () => {
    const found = insightsForTickers(NOTES, ["wdc", "sofi", "ZZZZ"]);
    expect(found.map((i) => i.ticker).sort()).toEqual(["SOFI", "WDC"]);
  });

  it("returns nothing for an empty holdings list", () => {
    expect(insightsForTickers(NOTES, [])).toEqual([]);
  });

  it("preserves the newest-first order it was given", () => {
    const found = insightsForTickers(NOTES, ["sezl", "wdc", "sofi"]);
    expect(found.map((i) => i.ticker)).toEqual(["WDC", "SOFI", "SEZL"]);
  });

  it("returns nothing when the list has not loaded yet", () => {
    // The metadata arrives over the wire now, so every caller renders at
    // least once against an empty array before it lands.
    expect(insightForTicker([], "WDC")).toBeUndefined();
    expect(insightsForTickers([], ["WDC"])).toEqual([]);
  });
});

describe("anonymised payload safety", () => {
  // Regression. anonymiseStrategy returns HTTP 200 with holdings stripped to
  // { pnl_pct, weight_pct, sector } — no ticker — for a signed-in
  // non-subscriber. /dashboard/positions rendered that payload and threw
  // "Cannot read properties of undefined (reading 'toUpperCase')", replacing
  // the whole shell with a client-side exception. TypeScript missed it
  // because Holding.ticker was declared non-optional: the type described the
  // entitled payload only.
  it("insightForTicker survives a missing ticker", () => {
    expect(() => insightForTicker(NOTES, undefined)).not.toThrow();
    expect(insightForTicker(NOTES, undefined)).toBeUndefined();
    expect(insightForTicker(NOTES, "")).toBeUndefined();
  });

  it("insightsForTickers survives holdings with no tickers", () => {
    const anonymised = [undefined, null, ""];
    expect(() => insightsForTickers(NOTES, anonymised)).not.toThrow();
    expect(insightsForTickers(NOTES, anonymised)).toEqual([]);
  });

  it("insightsForTickers still matches around missing entries", () => {
    const mixed = [undefined, "wdc", null];
    expect(insightsForTickers(NOTES, mixed).map((i) => i.ticker)).toEqual([
      "WDC",
    ]);
  });
});

describe("sectorPositionCap", () => {
  // sector_concentration reads like a share of the book and is not one. The
  // engine computes int(max_positions * sector_concentration) and compares it
  // against a COUNT of held names, so 0.30 across 50 slots means 15 names.
  // The dashboard first compared it against weight, which would have called a
  // 6-of-8 book a breach of a cap it was nowhere near.
  it("returns a position count, not a percentage", () => {
    expect(sectorPositionCap(0.3, 50)).toBe(15);
  });

  it("floors rather than rounds, matching int() in the engine", () => {
    expect(sectorPositionCap(0.3, 11)).toBe(3);
    expect(sectorPositionCap(0.33, 10)).toBe(3);
  });

  it("is unknown when either input is missing", () => {
    expect(sectorPositionCap(null, 50)).toBeNull();
    expect(sectorPositionCap(0.3, null)).toBeNull();
    expect(sectorPositionCap(undefined, undefined)).toBeNull();
  });

  it("treats a cap that floors to zero as no cap at all", () => {
    expect(sectorPositionCap(0.05, 10)).toBeNull();
  });
});
