import { describe, expect, it } from "vitest";
import { insightCategoryLabel, weeklyReviewSlug } from "@/lib/insights";
import {
  fridayNoonPacific,
  isPastFridayNoon,
} from "@/lib/weekly-review";

describe("weeklyReviewSlug", () => {
  it("lowercases the ISO week key", () => {
    expect(weeklyReviewSlug("2026-W34")).toBe("weekly-review-2026-w34");
  });
});

describe("insightCategoryLabel", () => {
  it("names a weekly review without inventing a ticker", () => {
    expect(
      insightCategoryLabel({ postType: "weekly_review", ticker: null }),
    ).toBe("Weekly review");
  });
});

describe("fridayNoonPacific", () => {
  // Friday 21 Aug 2026, PDT (UTC-7). Noon Pacific is 19:00 UTC.
  it("is 12:00 America/Los_Angeles on a Friday in daylight time", () => {
    expect(
      fridayNoonPacific(new Date("2026-08-21T17:00:00.000Z")).toISOString(),
    ).toBe("2026-08-21T19:00:00.000Z");
  });

  // Friday 16 Jan 2026, PST (UTC-8). Noon Pacific is 20:00 UTC.
  it("is 12:00 America/Los_Angeles on a Friday in standard time", () => {
    expect(
      fridayNoonPacific(new Date("2026-01-16T18:00:00.000Z")).toISOString(),
    ).toBe("2026-01-16T20:00:00.000Z");
  });

  it("still points at this week's Friday when asked on Thursday", () => {
    expect(
      fridayNoonPacific(new Date("2026-08-20T18:00:00.000Z")).toISOString(),
    ).toBe("2026-08-21T19:00:00.000Z");
  });

  it("points at the Friday that already happened when asked on Sunday", () => {
    // Sunday is still the same ISO week. The send window was two days ago.
    expect(
      fridayNoonPacific(new Date("2026-08-23T18:00:00.000Z")).toISOString(),
    ).toBe("2026-08-21T19:00:00.000Z");
  });
});

describe("isPastFridayNoon", () => {
  it("is false at 10am PT on Friday", () => {
    // 10:00 PDT = 17:00 UTC
    expect(isPastFridayNoon(new Date("2026-08-21T17:00:00.000Z"))).toBe(false);
  });

  it("is true at 12:00 PT on Friday", () => {
    expect(isPastFridayNoon(new Date("2026-08-21T19:00:00.000Z"))).toBe(true);
  });
});
