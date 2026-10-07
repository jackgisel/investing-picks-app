import { describe, expect, it } from "vitest";
import {
  annualized,
  cohortFor,
  cohortLabel,
  endDate,
  entryProblems,
  MIN_PICKS,
  normalizeDisplayName,
  normalizeTickers,
  nyDate,
  pickContribution,
  pickGrowth,
  portfolioReturn,
} from "./rules";

const tickers = (n: number) => Array.from({ length: n }, (_, i) => `T${i}`);

describe("dates and cohorts", () => {
  it("dates a submission in New York, not UTC", () => {
    // 01:30 UTC on Oct 8 is still Oct 7 in New York.
    expect(nyDate(new Date("2026-10-08T01:30:00Z"))).toBe("2026-10-07");
  });

  it("puts each month in its calendar quarter", () => {
    expect(cohortFor("2026-01-02")).toBe("2026-Q1");
    expect(cohortFor("2026-03-31")).toBe("2026-Q1");
    expect(cohortFor("2026-10-07")).toBe("2026-Q4");
    expect(cohortLabel("2026-Q4")).toBe("Q4 2026");
  });

  it("ends ten years after the start", () => {
    expect(endDate("2026-10-08")).toBe("2036-10-08");
  });
});

describe("entry validation", () => {
  const eligible = new Set(tickers(40));

  it("accepts 15 eligible stocks and a name", () => {
    expect(
      entryProblems({ tickers: tickers(MIN_PICKS), displayName: "Jack", eligible }),
    ).toEqual([]);
  });

  it("rejects too few and too many", () => {
    expect(entryProblems({ tickers: tickers(14), displayName: "J1", eligible })[0].code).toBe("too_few");
    expect(entryProblems({ tickers: tickers(31), displayName: "J1", eligible })[0].code).toBe("too_many");
  });

  it("names the tickers that are not eligible", () => {
    const p = entryProblems({
      tickers: [...tickers(15), "SPY"],
      displayName: "J1",
      eligible,
    });
    expect(p).toEqual([expect.objectContaining({ code: "ineligible", tickers: ["SPY"] })]);
  });

  it("dedupes and uppercases tickers, and refuses junk", () => {
    expect(normalizeTickers(["aapl", "AAPL", " msft "])).toEqual(["AAPL", "MSFT"]);
    expect(normalizeTickers(["AAPL", "<script>"])).toBeNull();
    expect(normalizeTickers("AAPL")).toBeNull();
  });

  it("keeps display names short and plain", () => {
    expect(normalizeDisplayName("  Value   Hunter ")).toBe("Value Hunter");
    expect(normalizeDisplayName("Zoë O'Neil")).toBe("Zoë O'Neil");
    expect(normalizeDisplayName("a")).toBeNull();
    expect(normalizeDisplayName("x".repeat(31))).toBeNull();
    expect(normalizeDisplayName("<b>hi</b>")).toBeNull();
    expect(normalizeDisplayName("...")).toBeNull();
  });
});

describe("scoring", () => {
  it("averages growth factors with no rebalancing", () => {
    const r = portfolioReturn([
      { ticker: "A", start: 10, last: 20 },
      { ticker: "B", start: 10, last: 10 },
    ]);
    expect(r).toBeCloseTo(0.5);
  });

  it("counts a pick with no price as flat, never as a gain", () => {
    expect(pickGrowth({ ticker: "X", start: null, last: 50 })).toBe(1);
    expect(pickGrowth({ ticker: "X", start: 10, last: null })).toBe(1);
  });

  it("splits the return into per-pick contributions that add up", () => {
    const picks = [
      { ticker: "A", start: 10, last: 13 },
      { ticker: "B", start: 10, last: 9 },
      { ticker: "C", start: 10, last: 11 },
    ];
    const sum = picks.reduce((s, p) => s + pickContribution(p, picks.length), 0);
    expect(sum).toBeCloseTo(portfolioReturn(picks)!);
  });

  it("only annualizes after a year", () => {
    expect(annualized(0.2, 200)).toBeNull();
    expect(annualized(0.21, 730)).toBeCloseTo(0.1, 3);
  });
});
