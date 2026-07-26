import { describe, expect, it } from "vitest";
import { activeHref, covers, flatten, visibleGroups } from "./nav-model";
import { groupBySector, UNCLASSIFIED } from "./sector-model";
import { actionMeta } from "./trade-action";
import { getInsightByTicker, getInsightsForTickers } from "@/lib/insight-index";

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
});

describe("visibleGroups", () => {
  it("shows a non-admin exactly the product nav", () => {
    const groups = visibleGroups(false);
    expect(groups).toHaveLength(1);
    expect(flatten(groups).map((i) => i.label)).toEqual([
      "Dashboard",
      "Positions",
      "Insights",
      "Strategy",
      "Settings",
    ]);
  });

  // The nav used to advertise ops pages that then 404'd.
  it("leaks no admin href to a non-admin", () => {
    const hrefs = flatten(visibleGroups(false)).map((i) => i.href);
    expect(hrefs.some((h) => h.startsWith("/dashboard/ops"))).toBe(false);
  });

  it("gives an admin a separate, labelled group", () => {
    const groups = visibleGroups(true);
    expect(groups).toHaveLength(2);
    expect(groups[1].label).toBe("Admin");
    expect(groups[1].items.map((i) => i.href)).toEqual([
      "/dashboard/ops",
      "/dashboard/ops/book",
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

describe("insight index lookups", () => {
  it("matches a ticker regardless of case", () => {
    expect(getInsightByTicker("wdc")?.ticker).toBe("WDC");
    expect(getInsightByTicker("WDC")?.ticker).toBe("WDC");
  });

  it("returns nothing for a ticker with no published note", () => {
    expect(getInsightByTicker("ZZZZ")).toBeUndefined();
  });

  it("finds every insight covering a set of holdings", () => {
    const found = getInsightsForTickers(["wdc", "sofi", "ZZZZ"]);
    expect(found.map((i) => i.ticker).sort()).toEqual(["SOFI", "WDC"]);
  });

  it("returns nothing for an empty holdings list", () => {
    expect(getInsightsForTickers([])).toEqual([]);
  });

  it("returns results newest first, matching the generated order", () => {
    const found = getInsightsForTickers(["wdc", "sofi", "sezl"]);
    const dates = found.map((i) => i.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
