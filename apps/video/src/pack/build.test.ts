import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildChart, periodLabel, weekChangePct } from "./build.js";
import type { ApiPerformance } from "./sources.js";

const FIXTURE_PATH = fileURLToPath(new URL("../__fixtures__/pack.sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

describe("weekChangePct", () => {
  it("matches the ported reference on a known series", () => {
    // Real /performance series values for the week the sample pack covers —
    // the book fell 0.45% while (this series') SPY fell from 17.77% to
    // 16.16% since inception, a -1.37% week. Both are load-bearing figures on
    // the fixture's `week` block, so this pins the port against real numbers
    // rather than an invented series.
    const book = [
      { date: "2026-08-14", return_pct: 2.69 },
      { date: "2026-08-17", return_pct: 2.64 },
      { date: "2026-08-18", return_pct: 2.26 },
      { date: "2026-08-19", return_pct: 2.18 },
      { date: "2026-08-20", return_pct: 2.06 },
      { date: "2026-08-21", return_pct: 2.23 },
    ];
    const spy = [
      { date: "2026-08-14", return_pct: 17.77 },
      { date: "2026-08-17", return_pct: 17.21 },
      { date: "2026-08-18", return_pct: 16.42 },
      { date: "2026-08-19", return_pct: 16.66 },
      { date: "2026-08-20", return_pct: 15.68 },
      { date: "2026-08-21", return_pct: 16.16 },
    ];

    expect(weekChangePct(book)).toBeCloseTo(fixture.facts.week.bookChangePct, 2);
    expect(weekChangePct(spy)).toBeCloseTo(fixture.facts.week.spyChangePct, 2);
  });

  it("returns null with fewer than two points, or with nothing at least a week old", () => {
    expect(weekChangePct([{ date: "2026-08-21", return_pct: 2.23 }])).toBeNull();
    expect(
      weekChangePct([
        { date: "2026-08-20", return_pct: 2.06 },
        { date: "2026-08-21", return_pct: 2.23 },
      ]),
    ).toBeNull();
  });
});

describe("periodLabel", () => {
  it("renders a same-month range with an en dash", () => {
    expect(periodLabel(new Date(Date.UTC(2026, 7, 22)))).toBe("August 16–22, 2026");
  });

  it("spells out both months when the week crosses a month boundary", () => {
    expect(periodLabel(new Date(Date.UTC(2026, 7, 2)))).toBe("July 27–August 2, 2026");
  });
});

describe("buildChart", () => {
  it("merges by date rather than by index when a benchmark series is short a day", () => {
    const performance: ApiPerformance = {
      series: [],
      summary: {},
      picks_series: [
        { date: "2026-04-10", return_pct: 0 },
        { date: "2026-04-11", return_pct: 5 },
        { date: "2026-04-12", return_pct: 10 },
      ],
      benchmarks: {
        labels: { SPY: "S&P 500" },
        series: {
          // Missing the 4-11 mark entirely — a naive positional zip would
          // pair picks' 4-12 value with SPY's 4-11 value.
          SPY: [
            { date: "2026-04-10", return_pct: 0 },
            { date: "2026-04-12", return_pct: 2 },
          ],
        },
      },
    };

    const chart = buildChart(performance);
    expect(chart.rows).toEqual([
      { date: "2026-04-10", picks: 0, SPY: 0 },
      { date: "2026-04-11", picks: 5, SPY: null },
      { date: "2026-04-12", picks: 10, SPY: 2 },
    ]);
    expect(chart.startDate).toBe("2026-04-10");
    expect(chart.latestDate).toBe("2026-04-12");
    expect(chart.picksLatestPct).toBe(10);
    expect(chart.benchmarks).toEqual([{ key: "SPY", label: "S&P 500", latestPct: 2 }]);
  });

  it("drops a benchmark that came back with zero usable points instead of drawing a flat line", () => {
    const performance: ApiPerformance = {
      series: [],
      summary: {},
      picks_series: [{ date: "2026-04-10", return_pct: 0 }],
      benchmarks: { labels: { QQQ: "Nasdaq-100" }, series: { QQQ: [] } },
    };
    expect(buildChart(performance).benchmarks).toEqual([]);
  });

  it("reproduces the fixture's chart shape from the same underlying series", () => {
    // Reconstruct a /performance-shaped payload from the fixture's own
    // already-merged rows and confirm the merge round-trips.
    const rows = fixture.facts.chart.rows as { date: string; [k: string]: number | string | null }[];
    const benchmarkKeys = (fixture.facts.chart.benchmarks as { key: string }[]).map((b) => b.key);

    const performance: ApiPerformance = {
      series: [],
      summary: {},
      picks_series: rows
        .filter((r) => typeof r.picks === "number")
        .map((r) => ({ date: r.date, return_pct: r.picks as number })),
      benchmarks: {
        labels: Object.fromEntries(
          (fixture.facts.chart.benchmarks as { key: string; label: string }[]).map((b) => [b.key, b.label]),
        ),
        series: Object.fromEntries(
          benchmarkKeys.map((key) => [
            key,
            rows.filter((r) => typeof r[key] === "number").map((r) => ({ date: r.date, return_pct: r[key] as number })),
          ]),
        ),
      },
    };

    const chart = buildChart(performance);
    expect(chart.rows).toEqual(fixture.facts.chart.rows);
    expect(chart.startDate).toBe(fixture.facts.chart.startDate);
    expect(chart.latestDate).toBe(fixture.facts.chart.latestDate);
    expect(chart.picksLatestPct).toBe(fixture.facts.chart.picksLatestPct);
  });
});
