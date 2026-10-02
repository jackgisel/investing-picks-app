import { describe, expect, it } from "vitest";
import {
  crossedThreshold,
  DRAWDOWN_THRESHOLDS,
  MILESTONE_THRESHOLDS,
} from "@/lib/performance-alerts";

/**
 * The two calculations that decide whether the list gets mailed.
 *
 * The dedupe itself lives in `email_dispatch` and is exercised by the claim
 * tests; what matters here is that a position sitting above a line does not
 * keep producing a fresh crossing, and that a drawdown is measured from the
 * high-water mark rather than from inception.
 */

describe("crossedThreshold", () => {
  it("returns the deepest threshold passed, not every one", () => {
    // A position that gaps from +40% to +210% overnight announces +200% once,
    // rather than mailing the list three times in a row.
    expect(crossedThreshold(210, MILESTONE_THRESHOLDS)).toBe(200);
  });

  it("returns null below the first threshold", () => {
    expect(crossedThreshold(49.9, MILESTONE_THRESHOLDS)).toBeNull();
    expect(crossedThreshold(-30, MILESTONE_THRESHOLDS)).toBeNull();
  });

  it("includes the boundary itself", () => {
    expect(crossedThreshold(50, MILESTONE_THRESHOLDS)).toBe(50);
  });

  it("does not skip to a higher band on the way up", () => {
    expect(crossedThreshold(99.9, MILESTONE_THRESHOLDS)).toBe(50);
    expect(crossedThreshold(100, MILESTONE_THRESHOLDS)).toBe(100);
  });

  it("works the same for drawdown bands", () => {
    expect(crossedThreshold(24, DRAWDOWN_THRESHOLDS)).toBe(20);
    expect(crossedThreshold(9, DRAWDOWN_THRESHOLDS)).toBeNull();
  });
});

