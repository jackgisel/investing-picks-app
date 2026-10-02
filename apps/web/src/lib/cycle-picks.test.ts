import { describe, expect, it } from "vitest";
import {
  cyclePicksSentence,
  joinTickers,
  renderNewPickEmail,
  renderNewPicksEmail,
} from "@/lib/email-templates";
import { cyclePicks } from "@/lib/insights";

const SITE = "https://outpick.xyz";

describe("cyclePicks", () => {
  const trades = [
    { ticker: "TPR", action: "buy", date: "2026-10-02" },
    { ticker: "MU", action: "buy", date: "2026-10-02" },
    { ticker: "OLD", action: "manual_buy", date: "2026-10-02" },
    { ticker: "SEZL", action: "double_buy", date: "2026-10-02" },
    { ticker: "WDC", action: "buy", date: "2026-09-18" },
  ];

  it("names the other engine buys from the same day", () => {
    expect(cyclePicks(trades, "tpr")).toEqual(["MU"]);
    expect(cyclePicks(trades, "MU")).toEqual(["TPR"]);
  });

  it("is empty in a normal one-pick cycle", () => {
    expect(cyclePicks(trades, "WDC")).toEqual([]);
    expect(cyclePicks(trades, "NOPE")).toEqual([]);
  });
});

describe("cycle line in the pick email", () => {
  const render = (alsoPicked?: string[]) =>
    renderNewPickEmail({
      recipientName: null,
      ticker: "TPR",
      articleTitle: "Why TPR cleared every gate",
      articleDescription: "The full note covers the thesis.",
      articleUrl: `${SITE}/dashboard/insights/tpr`,
      siteUrl: SITE,
      alsoPicked,
    });

  it("says the cycle bought two names", () => {
    expect(cyclePicksSentence("TPR", ["MU"])).toBe(
      "We bought two names this cycle instead of the usual one: TPR and MU. Each has its own research note.",
    );
    expect(render(["MU"])).toContain("We bought two names this cycle");
  });

  it("leaves a single-pick email unchanged", () => {
    expect(cyclePicksSentence("TPR", [])).toBeNull();
    expect(render()).not.toContain("this cycle");
    expect(render([])).toEqual(render());
  });
});

describe("combined cycle email", () => {
  const html = renderNewPicksEmail({
    recipientName: "Ada Lovelace",
    siteUrl: SITE,
    picks: [
      {
        ticker: "TPR",
        articleTitle: "Tapestry note",
        articleDescription: "Margins.",
        articleUrl: `${SITE}/dashboard/insights/tpr`,
      },
      {
        ticker: "MU",
        articleTitle: "Micron note",
        articleDescription: "Memory.",
        articleUrl: `${SITE}/dashboard/insights/mu`,
      },
    ],
  });

  it("carries both notes and both links in one mail", () => {
    expect(html).toContain("We bought two names this cycle");
    expect(html).toContain("Tapestry note");
    expect(html).toContain("Micron note");
    expect(html).toContain(`${SITE}/dashboard/insights/tpr`);
    expect(html).toContain(`${SITE}/dashboard/insights/mu`);
    expect(html).toContain("Read the MU research");
  });

  it("joins tickers the way the copy reads", () => {
    expect(joinTickers(["TPR", "MU"])).toBe("TPR and MU");
    expect(joinTickers(["A", "B", "C"])).toBe("A, B and C");
  });
});
