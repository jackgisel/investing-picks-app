import { describe, expect, it } from "vitest";
import {
  artForWeek,
  nextSpareCover,
  normalizeWeekKey,
  poolStatus,
  weekKeyFromInsightSlug,
  WEEKLY_POOL,
} from "@/lib/art-pool";

describe("art pool", () => {
  it("normalizes week keys to the ISO form used by isoWeekKey", () => {
    expect(normalizeWeekKey("2026-w35")).toBe("2026-W35");
    expect(normalizeWeekKey("2026-W35")).toBe("2026-W35");
    expect(normalizeWeekKey("2026-W5")).toBe("2026-W05");
    expect(normalizeWeekKey("nope")).toBeNull();
  });

  it("resolves weekly-review slugs", () => {
    expect(weekKeyFromInsightSlug("weekly-review-2026-w35")).toBe("2026-W35");
    expect(weekKeyFromInsightSlug("weekly-review-2026-W40")).toBe("2026-W40");
    expect(weekKeyFromInsightSlug("some-pick-note")).toBeNull();
  });

  it("serves a dedicated pool file for pre-generated weeks", () => {
    for (const week of WEEKLY_POOL) {
      expect(artForWeek(week).src).toBe(`/art/pool/${week}.png`);
    }
  });

  it("falls back outside the pre-generated window", () => {
    expect(artForWeek("2027-W01").src.startsWith("/art/")).toBe(true);
    expect(artForWeek("2027-W01").src).not.toContain("/pool/2027");
  });

  it("exposes spare covers for future blog posts", () => {
    const next = nextSpareCover();
    expect(next).not.toBeNull();
    expect(next?.src).toMatch(/^\/art\/pool\/spare-\d{2}\.png$/);
  });

  it("reports remaining weeks from today", () => {
    const status = poolStatus(new Date("2026-08-22T12:00:00Z"));
    expect(status.weeksReady).toBe(13);
    expect(status.weeksRemaining).toBeGreaterThanOrEqual(13);
    expect(status.sparesFree).toBe(6);
  });
});
