import { describe, expect, it } from "vitest";
import {
  artForWeek,
  artForInsight,
  nextSpareCover,
  normalizeWeekKey,
  poolStatus,
  weekKeyFromInsightSlug,
  WEEKLY_POOL,
  SPARE_POOL,
  SPARE_CLAIMED,
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

  it("gives a pick note the same weekly print the email used", () => {
    const art = artForInsight({
      slug: "sndk-stock-buy-sandisks-nand-upcycle",
      publishedAt: "2026-09-18T16:00:00.000Z",
      createdAt: "2026-09-18T12:00:00.000Z",
    });
    expect(art.src).toBe("/art/pool/2026-W38.png");
  });

  it("reads the week from a weekly-review slug, not the timestamps", () => {
    const art = artForInsight({
      slug: "weekly-review-2026-w35",
      publishedAt: "2026-09-18T16:00:00.000Z",
      createdAt: "2026-09-18T12:00:00.000Z",
    });
    expect(art.src).toBe("/art/pool/2026-W35.png");
  });

  it("exposes spare covers for future blog posts", () => {
    const next = nextSpareCover();
    expect(next).toEqual({ id: "spare-09", src: "/art/pool/spare-09.png" });
  });

  it("keeps unused spare-08+ prints unclaimed", () => {
    const expected: Record<string, { label: string; ink: string }> = {
      "spare-07": { label: "Lighthouse", ink: "#1E3A8A" },
      "spare-08": { label: "Mesa", ink: "#0F5C5C" },
      "spare-09": { label: "Harbor boats", ink: "#1B4D3E" },
      "spare-10": { label: "Alpine lake", ink: "#9B2331" },
      "spare-11": { label: "Hill town", ink: "#6B4423" },
      "spare-12": { label: "Terraces", ink: "#3E6B58" },
      "spare-13": { label: "Cypress coast", ink: "#146C32" },
      "spare-14": { label: "Wheat hills", ink: "#A67C2D" },
      "spare-15": { label: "Slot canyon", ink: "#C23B32" },
      "spare-16": { label: "Lavender hills", ink: "#5C3D8A" },
      "spare-17": { label: "Glacier", ink: "#1A6E82" },
      "spare-18": { label: "Adobe pueblo", ink: "#C46A32" },
    };
    const fresh = SPARE_POOL.filter((s) => s.id in expected);
    expect(fresh).toHaveLength(12);
    expect(new Set(fresh.map((s) => s.ink)).size).toBe(12);
    expect(SPARE_CLAIMED["spare-07"]).toBe(
      "individual-stock-research-that-still-holds-up",
    );
    expect(SPARE_CLAIMED["spare-08"]).toBe("earnings-revision-investing");
    for (const spare of fresh) {
      if (spare.id !== "spare-07" && spare.id !== "spare-08") {
        expect(SPARE_CLAIMED[spare.id]).toBeUndefined();
      }
      expect(spare.label).toBe(expected[spare.id].label);
      expect(spare.ink).toBe(expected[spare.id].ink);
      expect(spare.src).toBe(`/art/pool/${spare.id}.png`);
      expect(spare.width).toBe(1280);
    }
  });

  it("reports remaining weeks from today", () => {
    const status = poolStatus(new Date("2026-08-22T12:00:00Z"));
    expect(status.weeksReady).toBe(13);
    expect(status.weeksRemaining).toBeGreaterThanOrEqual(13);
    expect(status.sparesFree).toBe(10);
  });
});
