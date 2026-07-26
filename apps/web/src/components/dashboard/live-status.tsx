"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import {
  computePortfolioReturnPct,
  daysSinceInception,
  formatPctOrDash,
  pnlClass,
} from "@/lib/portfolio";
import { Radio } from "lucide-react";

export function LiveStatus() {
  const { data: strategy, isPending, isError } = useStrategy();
  const { inceptionISO } = useInceptionDate();
  const isLoading = isPending;
  const days = daysSinceInception(inceptionISO);
  const portfolio = strategy?.portfolio;
  const totalReturnPct = computePortfolioReturnPct(strategy);

  // A pulsing green "Live portfolio" banner full of em-dashes is worse than no
  // banner: it asserts everything is fine while the numbers are unavailable.
  // The page that owns this slot renders the real explanation instead.
  if (isError) return null;

  return (
    <div className="data-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Radio size={12} className="text-accent-green" />
              <span className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text">
                Live portfolio
              </span>
            </div>
            <p className="font-sans text-[13px] text-text-muted mt-1">
              Real trades · Tracked since{" "}
              {new Date(`${inceptionISO}T00:00:00Z`).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                },
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <span className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim block">
              Days live
            </span>
            <span className="font-mono text-[18px] font-bold">{days}</span>
          </div>
          <div>
            <span className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim block">
              Positions
            </span>
            <span className="font-mono text-[18px] font-bold">
              {isLoading ? "—" : (portfolio?.position_count ?? "—")}
            </span>
          </div>
          <div>
            <span className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim block">
              Total return
            </span>
            <span
              className={`font-mono text-[18px] font-bold ${pnlClass(
                isLoading ? null : totalReturnPct,
              )}`}
            >
              {isLoading ? "—" : formatPctOrDash(totalReturnPct)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
