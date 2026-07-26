"use client";

import { TONE_BG, toneByIndex } from "@/lib/tones";
import type { Holding } from "@/lib/hooks/use-strategy";

const UNCLASSIFIED = "Unclassified";

export interface SectorSlice {
  sector: string;
  weightPct: number;
  count: number;
  tone: ReturnType<typeof toneByIndex>;
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
      // Unclassified is not a sector, so it never takes a house colour.
      tone: toneByIndex(i),
    }));
}

export function SectorAllocation({
  holdings,
  /** params.sector_concentration — the share of the book one sector may take. */
  sectorCap,
}: {
  holdings: readonly Holding[];
  sectorCap?: number | null;
}) {
  const slices = groupBySector(holdings);
  const invested = slices.reduce((n, s) => n + s.weightPct, 0);
  const capPct = typeof sectorCap === "number" ? sectorCap * 100 : null;
  const breached =
    capPct === null ? [] : slices.filter((s) => s.weightPct > capPct);

  if (slices.length === 0) return null;

  return (
    <div className="data-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
        <span className="panel-label panel-label-mint">Sector exposure</span>
        <span className="font-mono text-[11px] text-text-dim tabular-nums">
          {slices.length} sector{slices.length === 1 ? "" : "s"} ·{" "}
          {invested.toFixed(1)}% invested
        </span>
      </div>

      {/* Widths are shares of equity, so the bar deliberately does not fill
          when the book is holding cash. */}
      <div
        className="flex h-2.5 w-full gap-0.5 mb-4 overflow-hidden rounded-full bg-bg-tertiary"
        role="img"
        aria-label={slices
          .map((s) => `${s.sector} ${s.weightPct.toFixed(1)}%`)
          .join(", ")}
      >
        {slices.map((s) => (
          <span
            key={s.sector}
            className={`${
              s.sector === UNCLASSIFIED ? "bg-border-strong" : TONE_BG[s.tone]
            }`}
            style={{ width: `${s.weightPct}%` }}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {slices.map((s) => (
          <li
            key={s.sector}
            className="flex items-center justify-between gap-3 text-[12px]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  s.sector === UNCLASSIFIED
                    ? "bg-border-strong"
                    : TONE_BG[s.tone]
                }`}
                aria-hidden
              />
              <span className="truncate font-sans text-text-muted">
                {s.sector}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-text-dim">
                {s.count}
              </span>
            </span>
            <span
              className={`shrink-0 font-mono font-semibold tabular-nums ${
                capPct !== null && s.weightPct > capPct
                  ? "text-accent-red"
                  : "text-text"
              }`}
            >
              {s.weightPct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>

      {capPct !== null && (
        <p className="mt-4 border-t border-border pt-3 font-sans text-[11px] leading-relaxed text-text-dim">
          The strategy caps any one sector at{" "}
          <span className="font-mono text-text-muted">
            {capPct.toFixed(0)}%
          </span>{" "}
          of the book and enforces it on every buy.{" "}
          {breached.length === 0
            ? "Every sector is inside the cap."
            : `${breached
                .map((s) => s.sector)
                .join(", ")} ${breached.length === 1 ? "is" : "are"} above it — existing positions are never force-sold to rebalance.`}
        </p>
      )}
    </div>
  );
}
