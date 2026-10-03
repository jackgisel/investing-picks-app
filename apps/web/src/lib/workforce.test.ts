import { describe, expect, it } from "vitest";
import {
  fiscalYearLabel,
  fiscalYearShort,
  formatEmployees,
  formatGrowth,
  formatLeverage,
  formatPerEmployee,
  indexTo100,
  isWorkforceOrder,
} from "./workforce";

describe("workforce formatting", () => {
  it("formats revenue per employee", () => {
    expect(formatPerEmployee(2_400_000)).toBe("$2.40M");
    expect(formatPerEmployee(12_300_000)).toBe("$12.3M");
    expect(formatPerEmployee(850_000)).toBe("$850K");
    expect(formatPerEmployee(null)).toBe("—");
    expect(formatPerEmployee(999_600)).toBe("$1.00M");
    expect(formatPerEmployee(300)).toBe("$300");
  });

  it("formats headcount", () => {
    expect(formatEmployees(12400)).toBe("12,400");
    expect(formatEmployees(2_100_000)).toBe("2.10M");
    expect(formatEmployees(undefined)).toBe("—");
  });

  it("signs growth and never coerces a missing value to zero", () => {
    expect(formatGrowth(0.123)).toBe("+12.3%");
    expect(formatGrowth(-0.04)).toBe("-4.0%");
    expect(formatGrowth(null)).toBe("—");
    expect(formatLeverage(0.4)).toBe("+40.0 pts");
    expect(formatLeverage(-0.05)).toBe("-5.0 pts");
  });

  it("indexes a series to 100 at its first value", () => {
    expect(indexTo100([200, 300, 100])).toEqual([100, 150, 50]);
    expect(indexTo100([0, 5]).every(Number.isNaN)).toBe(true);
  });

  it("labels fiscal years and validates orders", () => {
    expect(fiscalYearLabel("2025-12-31")).toBe("Dec 2025");
    expect(fiscalYearLabel("2025-02-01")).toBe("Feb 2025");
    expect(fiscalYearShort("2025-02-01")).toBe("'25");
    expect(isWorkforceOrder("leverage")).toBe(true);
    expect(isWorkforceOrder("nope")).toBe(false);
  });
});
