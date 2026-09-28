import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatChartAxisDate, formatChartDate } from "./chart-date";

const here = dirname(fileURLToPath(import.meta.url));

describe("formatChartDate", () => {
  it("formats an ISO date in UTC without slipping a day", () => {
    expect(formatChartDate("2026-04-10")).toBe("Apr 10, 2026");
    expect(formatChartAxisDate("2026-04-10")).toBe("Apr 10");
  });

  it("returns the input when it is not a date", () => {
    expect(formatChartDate("not-a-date")).toBe("not-a-date");
    expect(formatChartAxisDate("not-a-date")).toBe("not-a-date");
  });
});

describe("homepage graph does not import recharts", () => {
  it("loads the date helper from a module that does not import recharts", () => {
    const methodology = readFileSync(
      join(here, "performance-methodology.tsx"),
      "utf8",
    );
    const performanceChart = readFileSync(
      join(here, "..", "dashboard", "performance-chart.tsx"),
      "utf8",
    );
    const chart = readFileSync(join(here, "picks-benchmark-chart.tsx"), "utf8");
    const helper = readFileSync(join(here, "chart-date.ts"), "utf8");
    const hero = readFileSync(
      join(here, "..", "landing", "hero-outperformance.tsx"),
      "utf8",
    );

    expect(methodology).toContain('from "@/components/ui/chart-date"');
    expect(methodology).not.toContain("picks-benchmark-chart");
    expect(methodology).not.toContain("recharts");
    expect(performanceChart).toContain('from "@/components/ui/chart-date"');
    expect(helper).not.toContain("recharts");
    expect(chart).toContain('from "recharts"');
    expect(chart).toContain('from "@/components/ui/chart-date"');
    expect(hero).toContain("PerformanceMethodology");
    expect(hero).not.toContain("picks-benchmark-chart");
    expect(hero).not.toContain("recharts");
  });
});
