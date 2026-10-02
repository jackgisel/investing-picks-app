"use client";

import { useState } from "react";
import { incomeVisualUrl } from "@/lib/income-visual/url";
import type { PeriodType } from "@/lib/income-visual/model";

/**
 * A holding's latest income statement as a flow, quarter or fiscal year.
 *
 * The image route paywalls held names, and this only renders inside the
 * member drawer. A name the worker has not stored yet (bought today, say)
 * 404s, which is the empty state rather than an error.
 */
export function PositionIncomeVisual({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState<PeriodType>("quarter");
  const [failed, setFailed] = useState<Record<PeriodType, boolean>>({
    quarter: false,
    annual: false,
  });

  return (
    <div>
      <div className="mb-3 inline-flex rounded-xl border border-border p-0.5" role="group" aria-label="Period">
        {(["quarter", "annual"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={`rounded-[10px] px-3 py-1 font-mono text-[11px] ${
              period === p ? "bg-bg-tertiary text-text" : "text-text-dim hover:text-text"
            }`}
          >
            {p === "quarter" ? "Latest quarter" : "Fiscal year"}
          </button>
        ))}
      </div>

      {failed[period] ? (
        <p className="font-sans text-[12px] text-text-dim">
          Not drawn yet. Statements load as each company reports.
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={period}
          src={incomeVisualUrl(ticker, period)}
          alt={`${ticker} ${period === "quarter" ? "latest quarter" : "fiscal year"} income statement: revenue flowing to gross profit, operating profit and net profit`}
          width={1080}
          height={1080}
          loading="lazy"
          onError={() => setFailed((f) => ({ ...f, [period]: true }))}
          className="aspect-square w-full rounded-xl border border-border bg-[#0A0A0A]"
        />
      )}
      {period === "annual" && !failed.annual && (
        <p className="mt-2 font-sans text-[10px] leading-relaxed text-text-dim">
          Fiscal-year view includes the revenue split by product line where
          the company reports one.
        </p>
      )}
    </div>
  );
}
