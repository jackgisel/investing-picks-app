"use client";

import { TONE_BG } from "@/lib/tones";
import type { Holding } from "@/lib/hooks/use-strategy";
import { groupBySector, sectorPositionCap, UNCLASSIFIED } from "./sector-model";

export function SectorAllocation({
  holdings,
  /** params.sector_concentration — see sectorPositionCap. */
  sectorCap,
  /** params.max_positions — the cap is a fraction of this, not of equity. */
  maxPositions,
}: {
  holdings: readonly Holding[];
  sectorCap?: number | null;
  maxPositions?: number | null;
}) {
  const slices = groupBySector(holdings);
  const names = slices.reduce((n, s) => n + s.count, 0);
  const cap = sectorPositionCap(sectorCap, maxPositions);
  // Unclassified is not a sector, so it cannot breach a sector cap.
  const breached =
    cap === null
      ? []
      : slices.filter((s) => s.sector !== UNCLASSIFIED && s.count >= cap);

  if (slices.length === 0) return null;

  return (
    <div className="data-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
        <span className="panel-label panel-label-mint">Sector exposure</span>
        <span className="font-mono text-[11px] text-text-dim tabular-nums">
          {slices.length} sector{slices.length === 1 ? "" : "s"} · {names}{" "}
          {names === 1 ? "name" : "names"}
        </span>
      </div>

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
            className={s.tone ? TONE_BG[s.tone] : "bg-border-strong"}
            style={{ width: `${s.weightPct}%` }}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {slices.map((s) => {
          const atCap =
            cap !== null && s.sector !== UNCLASSIFIED && s.count >= cap;
          return (
            <li
              key={s.sector}
              className="flex items-center justify-between gap-3 text-[12px]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    s.tone ? TONE_BG[s.tone] : "bg-border-strong"
                  }`}
                  aria-hidden
                />
                <span className="truncate font-sans text-text-muted">
                  {s.sector}
                </span>
                <span
                  className={`shrink-0 font-mono text-[10px] tabular-nums ${
                    atCap ? "text-accent-red" : "text-text-dim"
                  }`}
                  title={
                    cap === null
                      ? undefined
                      : `${s.count} of a maximum ${cap} positions in one sector`
                  }
                >
                  {cap === null ? s.count : `${s.count}/${cap}`}
                </span>
              </span>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-text">
                {s.weightPct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>

      {cap !== null && (
        <p className="mt-4 border-t border-border pt-3 font-sans text-[11px] leading-relaxed text-text-dim">
          The strategy will not open a new position in a sector that already
          holds{" "}
          <span className="font-mono text-text-muted">{cap}</span> names, and
          checks that on every buy.{" "}
          {breached.length === 0
            ? "No sector is at its limit."
            : `${breached
                .map((s) => s.sector)
                .join(", ")} ${breached.length === 1 ? "is" : "are"} at the limit — no new names there until one closes. Existing positions are never force-sold to rebalance.`}
        </p>
      )}
    </div>
  );
}
