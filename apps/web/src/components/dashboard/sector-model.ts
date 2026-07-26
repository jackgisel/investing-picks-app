import { toneByIndex } from "@/lib/tones";
import type { Holding } from "@/lib/hooks/use-strategy";

/**
 * Sector grouping, kept apart from the component so the bucketing rules can
 * be tested as a plain function.
 */

export const UNCLASSIFIED = "Unclassified";

export interface SectorSlice {
  sector: string;
  weightPct: number;
  count: number;
  tone: ReturnType<typeof toneByIndex> | null;
}

/**
 * Group holdings by sector, heaviest first.
 *
 * Position.sector is nullable and the live book was seeded by hand, so some
 * rows genuinely have no sector. Those get an explicit "Unclassified" bucket
 * rather than being dropped — silently omitting them would make the weights
 * add up to something that isn't the portfolio.
 */
export function groupBySector(holdings: readonly Holding[]): SectorSlice[] {
  const byName = new Map<string, { weightPct: number; count: number }>();
  for (const h of holdings) {
    const key = h.sector?.trim() || UNCLASSIFIED;
    const acc = byName.get(key) ?? { weightPct: 0, count: 0 };
    acc.weightPct += h.weight_pct ?? 0;
    acc.count += 1;
    byName.set(key, acc);
  }

  return [...byName.entries()]
    .sort(
      (a, b) =>
        b[1].weightPct - a[1].weightPct || a[0].localeCompare(b[0]),
    )
    .map(([sector, v], i) => ({
      sector,
      weightPct: v.weightPct,
      count: v.count,
      // Unclassified is not a sector, so it never takes a house colour. Null
      // here rather than relying on every render site to remember that.
      tone: sector === UNCLASSIFIED ? null : toneByIndex(i),
    }));
}

/**
 * How many positions one sector may hold.
 *
 * `sector_concentration` reads like a share of the book and is not one. The
 * engine computes `int(max_positions * sector_concentration)` and compares it
 * against a COUNT of held names (signals.py `_would_exceed_sector_cap`), so
 * 0.30 with a 50-position ceiling means "at most 15 names in one sector" —
 * never "at most 30% of book value".
 *
 * The dashboard originally compared it against weight, which would have
 * reported a 6-of-8-position book as breaching a cap it was nowhere near.
 */
export function sectorPositionCap(
  sectorConcentration: number | null | undefined,
  maxPositions: number | null | undefined,
): number | null {
  if (typeof sectorConcentration !== "number") return null;
  if (typeof maxPositions !== "number") return null;
  const cap = Math.floor(maxPositions * sectorConcentration);
  return cap > 0 ? cap : null;
}
