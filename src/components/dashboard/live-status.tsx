"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { computePortfolioReturnPct, formatPct } from "@/lib/portfolio";
import { Radio } from "lucide-react";

// Live portfolio inception
const LIVE_INCEPTION = "2026-04-01";

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

export function LiveStatus() {
  const { data: strategy, isLoading } = useStrategy();
  const days = daysSince(LIVE_INCEPTION);
  const portfolio = strategy?.portfolio;
  const totalReturnPct = computePortfolioReturnPct(strategy);
  const hasReturn = totalReturnPct !== null;
  const isPositive = hasReturn && totalReturnPct! >= 0;

  return (
    <div className="bg-bg-secondary border border-accent-green-soft p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Radio size={12} className="text-accent-green" />
              <span className="font-mono text-[10px] text-accent-green tracking-[2px] font-semibold">
                LIVE PORTFOLIO
              </span>
            </div>
            <p className="font-sans text-[12px] text-text-muted mt-1">
              Real trades &middot; Tracked since{" "}
              {new Date(LIVE_INCEPTION).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block">
              DAYS LIVE
            </span>
            <span className="font-mono text-[18px] font-bold">{days}</span>
          </div>
          <div>
            <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block">
              POSITIONS
            </span>
            <span className="font-mono text-[18px] font-bold">
              {isLoading ? "—" : (portfolio?.position_count ?? "—")}
            </span>
          </div>
          <div>
            <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block">
              TOTAL RETURN
            </span>
            <span
              className={`font-mono text-[18px] font-bold ${
                isLoading || !hasReturn
                  ? "text-text-dim"
                  : isPositive
                    ? "text-accent-green"
                    : "text-accent-red"
              }`}
            >
              {isLoading || !hasReturn ? "—" : formatPct(totalReturnPct!)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
