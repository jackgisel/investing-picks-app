"use client";

import type { Holding } from "@/lib/hooks/use-strategy";
import { streetRangeFromFundamentals } from "@/lib/street-range";
import { formatCompactUsd } from "@/lib/market-cap";
import { StreetRangeBand } from "@/components/street-range-band";

function signedPct(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function growthClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.05) return "text-text-muted";
  return value > 0 ? "text-accent-green" : "text-accent-red";
}

function moneyPerShare(value: number | null): string {
  if (value === null) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fiscalLabel(period: string | null): string {
  if (!period) return "FY";
  const year = Number(period.slice(0, 4));
  return Number.isFinite(year) ? `FY${String(year).slice(-2)}` : "FY";
}

function periodLabel(period: string | null): string {
  if (!period) return "Period unavailable";
  const date = new Date(`${period.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  const quarter = Math.ceil((date.getUTCMonth() + 1) / 3);
  return `Through Q${quarter} ${date.getUTCFullYear()}`;
}

function dateLabel(iso: string | null): string {
  if (!iso) return "Latest report unavailable";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return `Reported ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function Revision({ value }: { value: number | null }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className={`mt-1 block font-sans text-[9px] ${growthClass(value)}`}>
      {flat ? "No change" : `${signedPct(value)} revision`}
    </span>
  );
}

function Surprise({
  actual,
  estimate,
  surprise,
  money = false,
}: {
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  money?: boolean;
}) {
  const format = money
    ? formatCompactUsd
    : moneyPerShare;
  return (
    <span>
      <span className={`block font-mono text-[13px] font-semibold tabular-nums ${growthClass(surprise)}`}>
        {signedPct(surprise)}
      </span>
      <span className="mt-1 block font-sans text-[9px] text-text-dim sm:whitespace-nowrap">
        {actual === null || estimate === null
          ? "Actual / estimate unavailable"
          : `${format(actual)} vs ${format(estimate)}`}
      </span>
    </span>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * One holding's fundamentals: last print vs estimate, trailing growth,
 * forward consensus and the Street range. Rendered in the position drawer —
 * it used to be the mobile fallback for an 8-column table nobody could read
 * without scrolling sideways.
 */
export function PositionFundamentals({ holding }: { holding: Holding }) {
  const facts = holding.fundamentals;
  const fy = fiscalLabel(facts?.estimate_period ?? null);
  const street = streetRangeFromFundamentals(facts);

  return (
    <div>
      <p className="font-sans text-[11px] text-text-dim">
        {facts?.earnings_report_date
          ? dateLabel(facts.earnings_report_date)
          : periodLabel(facts?.growth_basis_period ?? null)}
      </p>

      <div className="mt-3 space-y-4">
        <div>
          <p className="mb-2 font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
            Latest earnings vs estimate
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Revenue">
              <Surprise
                actual={facts?.revenue_actual ?? null}
                estimate={facts?.revenue_report_estimate ?? null}
                surprise={facts?.revenue_surprise_pct ?? null}
                money
              />
            </Metric>
            <Metric label="EPS">
              <Surprise
                actual={facts?.eps_actual ?? null}
                estimate={facts?.eps_report_estimate ?? null}
                surprise={facts?.eps_surprise_pct ?? null}
              />
            </Metric>
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
            Reported TTM growth
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Revenue">
              <span
                className={`font-mono text-[13px] font-semibold tabular-nums ${growthClass(facts?.revenue_growth_ttm_pct ?? null)}`}
              >
                {signedPct(facts?.revenue_growth_ttm_pct ?? null)}
              </span>
            </Metric>
            <Metric label="EPS">
              <span
                className={`font-mono text-[13px] font-semibold tabular-nums ${growthClass(facts?.eps_growth_ttm_pct ?? null)}`}
              >
                {signedPct(facts?.eps_growth_ttm_pct ?? null)}
              </span>
            </Metric>
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
            Forward consensus
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Revenue">
              <span className="font-mono text-[13px] font-semibold tabular-nums text-text">
                {formatCompactUsd(facts?.revenue_estimate ?? null)}
              </span>
              <span className="ml-1.5 font-mono text-[9px] text-text-dim">
                {fy}
              </span>
              <Revision value={facts?.revenue_revision_pct ?? null} />
            </Metric>
            <Metric label="EPS">
              <span className="font-mono text-[13px] font-semibold tabular-nums text-text">
                {facts?.eps_estimate === null || facts?.eps_estimate === undefined
                  ? "—"
                  : moneyPerShare(facts.eps_estimate)}
              </span>
              <span className="ml-1.5 font-mono text-[9px] text-text-dim">
                {fy}
              </span>
              <Revision value={facts?.eps_revision_pct ?? null} />
            </Metric>
          </div>
        </div>

        {street ? (
          <div>
            <StreetRangeBand range={street} />
          </div>
        ) : null}
      </div>

      <p className="mt-4 font-sans text-[10px] leading-relaxed text-text-dim">
        Earnings surprise compares the latest reported actual with the
        consensus estimate available for that announcement. Reported growth
        compares the latest trailing four quarters with the prior four.
        Forward consensus is the current analyst average for the labeled
        fiscal year; revision is its change from the prior snapshot. Street
        range is analyst price-target consensus versus the latest mark — not
        an Outpick target.
      </p>
    </div>
  );
}
