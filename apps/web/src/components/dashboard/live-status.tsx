"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";
import { useInceptionDate } from "@/lib/hooks/use-inception";
import {
  computePortfolioReturnPct,
  daysSinceInception,
  formatPctOrDash,
  formatWeekdayDate,
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
  const nextEvaluation = formatWeekdayDate(strategy?.next_evaluation_date);

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
              <span className="panel-label panel-label-mint">
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
            <span className="field-label block">
              Days live
            </span>
            <span className="font-mono text-[18px] font-bold">{days}</span>
          </div>
          <div>
            <span className="field-label block">
              Positions
            </span>
            <span className="font-mono text-[18px] font-bold">
              {isLoading ? "—" : (portfolio?.position_count ?? "—")}
            </span>
          </div>
          <div>
            <span className="field-label block">
              Picks return
            </span>
            <span
              className={`font-mono text-[18px] font-bold ${pnlClass(
                isLoading ? null : totalReturnPct,
              )}`}
            >
              {isLoading ? "—" : formatPctOrDash(totalReturnPct)}
            </span>
          </div>
          <div>
            <span className="field-label block">Next picks</span>
            <span
              className="font-mono text-[18px] font-bold whitespace-nowrap"
              title="The book is re-evaluated on the 1st and 3rd Friday of each month. Holdings do not change in between."
            >
              {isLoading ? "—" : (nextEvaluation ?? "—")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
