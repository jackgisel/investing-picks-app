import { describe, expect, it } from "vitest";
import type { Holding } from "@/lib/hooks/use-strategy";
import type { Trade } from "@/lib/hooks/use-trades";
import {
  closedSummary,
  groupTradesByEvaluation,
  holdingSignals,
  openSummary,
  parsePositionsView,
  tradesForTicker,
} from "./positions-model";

function holding(over: Partial<Holding> = {}): Holding {
  return { ticker: "AAA", entry_date: "2026-01-02", pnl_pct: 0, ...over };
}

function facts(
  over: Partial<NonNullable<Holding["fundamentals"]>> = {},
): NonNullable<Holding["fundamentals"]> {
  return {
    as_of: "2026-09-20",
    growth_basis_period: null,
    estimate_period: null,
    revenue_growth_ttm_pct: null,
    eps_growth_ttm_pct: null,
    revenue_estimate: null,
    eps_estimate: null,
    revenue_revision_pct: null,
    eps_revision_pct: null,
    earnings_report_date: null,
    revenue_actual: null,
    revenue_report_estimate: null,
    revenue_surprise_pct: null,
    eps_actual: null,
    eps_report_estimate: null,
    eps_surprise_pct: null,
    mark: null,
    price_target_low: null,
    price_target_mean: null,
    price_target_high: null,
    price_target_analyst_count: null,
    ...over,
  };
}

function trade(over: Partial<Trade>): Trade {
  return {
    ticker: "AAA",
    side: "buy",
    action: "buy",
    date: "2026-01-02T15:00:00Z",
    reason: null,
    evaluation_id: null,
    ...over,
  };
}

describe("parsePositionsView", () => {
  it("keeps closed and folds every retired tab into open", () => {
    expect(parsePositionsView("closed")).toBe("closed");
    expect(parsePositionsView("fundamentals")).toBe("open");
    expect(parsePositionsView("activity")).toBe("open");
    expect(parsePositionsView(null)).toBe("open");
  });
});

describe("openSummary", () => {
  it("leaves unknown returns out of the counts and the average", () => {
    const s = openSummary([
      holding({ pnl_pct: 20 }),
      holding({ pnl_pct: -10 }),
      holding({ pnl_pct: null }),
      holding({ pnl_pct: 0 }),
    ]);
    expect(s).toMatchObject({ count: 4, above: 1, below: 1, scored: 3 });
    expect(s.avgPct).toBeCloseTo(10 / 3);
  });

  it("reports no average rather than 0% for an empty book", () => {
    expect(openSummary([]).avgPct).toBeNull();
  });
});

describe("closedSummary", () => {
  it("splits wins from losses and ignores unknown results", () => {
    const s = closedSummary([
      { pnl_pct: 40 },
      { pnl_pct: 20 },
      { pnl_pct: -10 },
      { pnl_pct: null },
    ]);
    expect(s.count).toBe(4);
    expect(s.scored).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.winRatePct).toBeCloseTo(200 / 3);
    expect(s.avgWinPct).toBe(30);
    expect(s.avgLossPct).toBe(-10);
  });

  it("has no win rate with nothing closed", () => {
    expect(closedSummary([]).winRatePct).toBeNull();
  });
});

describe("holdingSignals", () => {
  it("is all null without fundamentals", () => {
    expect(holdingSignals(holding({ fundamentals: null }))).toEqual({
      earnings: null,
      earningsBasis: null,
      earningsSurprisePct: null,
      revisions: null,
      revisionPct: null,
      upsidePct: null,
    });
  });

  it("reads EPS surprise first and falls back to revenue", () => {
    expect(
      holdingSignals(
        holding({
          fundamentals: facts({ eps_surprise_pct: -3, revenue_surprise_pct: 5 }),
        }),
      ),
    ).toMatchObject({ earnings: "miss", earningsBasis: "EPS" });
    expect(
      holdingSignals(holding({ fundamentals: facts({ revenue_surprise_pct: 5 }) })),
    ).toMatchObject({ earnings: "beat", earningsBasis: "Revenue" });
  });

  it("treats moves inside the flat band as inline / flat", () => {
    const s = holdingSignals(
      holding({
        fundamentals: facts({ eps_surprise_pct: 0.01, eps_revision_pct: -0.02 }),
      }),
    );
    expect(s.earnings).toBe("inline");
    expect(s.revisions).toBe("flat");
  });

  it("computes upside to the Street mean from the mark", () => {
    const s = holdingSignals(
      holding({
        fundamentals: facts({
          mark: 100,
          price_target_low: 90,
          price_target_mean: 120,
          price_target_high: 150,
        }),
      }),
    );
    expect(s.upsidePct).toBeCloseTo(20);
  });
});

describe("tradesForTicker", () => {
  it("returns one name's trades oldest first", () => {
    const out = tradesForTicker(
      [
        trade({ date: "2026-03-01" }),
        trade({ ticker: "BBB" }),
        trade({ date: "2026-01-01" }),
      ],
      "AAA",
    );
    expect(out.map((t) => t.date)).toEqual(["2026-01-01", "2026-03-01"]);
  });
});

describe("groupTradesByEvaluation", () => {
  it("groups by evaluation, falls back to day, newest first", () => {
    const groups = groupTradesByEvaluation([
      trade({ evaluation_id: 7, date: "2026-09-12T14:00:00Z" }),
      trade({ evaluation_id: 7, date: "2026-09-12T14:01:00Z", ticker: "BBB" }),
      trade({ evaluation_id: 5, date: "2026-08-29T14:00:00Z" }),
      trade({ evaluation_id: null, date: "2026-01-02T00:00:00Z" }),
      trade({ evaluation_id: null, date: "2026-01-02T00:00:00Z", ticker: "CCC" }),
    ]);
    expect(groups.map((g) => [g.key, g.date, g.trades.length])).toEqual([
      ["eval:7", "2026-09-12", 2],
      ["eval:5", "2026-08-29", 1],
      ["day:2026-01-02", "2026-01-02", 2],
    ]);
  });
});
