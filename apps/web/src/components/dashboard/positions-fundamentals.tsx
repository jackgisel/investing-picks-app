"use client";

import { CompanyLogo } from "@/components/ui/company-logo";
import {
  DataState,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { PanelHeader } from "@/components/dashboard/data-table";
import { HScroll } from "@/components/ui/h-scroll";
import { useStrategy, type Holding } from "@/lib/hooks/use-strategy";

function signedPct(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function growthClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.05) return "text-text-muted";
  return value > 0 ? "text-accent-green" : "text-accent-red";
}

function compactMoney(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)}B`;
  if (abs >= 1_000_000)
    return `${sign}$${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}M`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
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
    ? compactMoney
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

function FundamentalsCard({ holding }: { holding: Holding }) {
  const facts = holding.fundamentals;
  const fy = fiscalLabel(facts?.estimate_period ?? null);

  return (
    <article className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <CompanyLogo ticker={holding.ticker} size="sm" />
        <div className="min-w-0">
          <p className="font-mono text-[14px] font-semibold text-text">
            {holding.ticker ?? "—"}
          </p>
          <p className="mt-0.5 font-sans text-[9px] text-text-dim">
            {facts?.earnings_report_date
              ? dateLabel(facts.earnings_report_date)
              : periodLabel(facts?.growth_basis_period ?? null)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
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
                {compactMoney(facts?.revenue_estimate ?? null)}
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
      </div>
    </article>
  );
}

function FundamentalsRow({ holding }: { holding: Holding }) {
  const facts = holding.fundamentals;
  const fy = fiscalLabel(facts?.estimate_period ?? null);

  return (
    <tr className="border-b border-border transition-colors last:border-b-0 hover:bg-bg-tertiary/50">
      <td className="px-5 py-4">
        <span className="flex items-center gap-2.5">
          <CompanyLogo ticker={holding.ticker} size="sm" />
          <span>
            <span className="block font-mono text-[14px] font-semibold text-text">
              {holding.ticker ?? "—"}
            </span>
            <span className="mt-0.5 block whitespace-nowrap font-sans text-[9px] text-text-dim">
              {facts?.earnings_report_date
                ? dateLabel(facts.earnings_report_date)
                : periodLabel(facts?.growth_basis_period ?? null)}
            </span>
          </span>
        </span>
      </td>
      <td className="px-5 py-4">
        <Surprise
          actual={facts?.revenue_actual ?? null}
          estimate={facts?.revenue_report_estimate ?? null}
          surprise={facts?.revenue_surprise_pct ?? null}
          money
        />
      </td>
      <td className="px-5 py-4">
        <Surprise
          actual={facts?.eps_actual ?? null}
          estimate={facts?.eps_report_estimate ?? null}
          surprise={facts?.eps_surprise_pct ?? null}
        />
      </td>
      <td className={`px-5 py-4 font-mono text-[13px] font-semibold tabular-nums ${growthClass(facts?.revenue_growth_ttm_pct ?? null)}`}>
        {signedPct(facts?.revenue_growth_ttm_pct ?? null)}
      </td>
      <td className={`px-5 py-4 font-mono text-[13px] font-semibold tabular-nums ${growthClass(facts?.eps_growth_ttm_pct ?? null)}`}>
        {signedPct(facts?.eps_growth_ttm_pct ?? null)}
      </td>
      <td className="px-5 py-4">
        <span className="font-mono text-[13px] font-semibold tabular-nums text-text">
          {compactMoney(facts?.revenue_estimate ?? null)}
        </span>
        <span className="ml-1.5 font-mono text-[9px] text-text-dim">{fy}</span>
        <Revision value={facts?.revenue_revision_pct ?? null} />
      </td>
      <td className="px-5 py-4">
        <span className="font-mono text-[13px] font-semibold tabular-nums text-text">
          {facts?.eps_estimate === null || facts?.eps_estimate === undefined
            ? "—"
            : moneyPerShare(facts.eps_estimate)}
        </span>
        <span className="ml-1.5 font-mono text-[9px] text-text-dim">{fy}</span>
        <Revision value={facts?.eps_revision_pct ?? null} />
      </td>
    </tr>
  );
}

export function PositionsFundamentals() {
  const query = useStrategy();
  const { data, isPending, isError, error } = query;
  const holdings = data?.holdings;
  const rows = holdings ?? [];
  const hasAnyFacts = rows.some((holding) => holding.fundamentals);
  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: rows.length === 0 || !hasAnyFacts,
  });

  return (
    <div className="pt-4">
      <div className="data-panel">
        <PanelHeader label="Company fundamentals">
          <span className="font-mono text-[10px] text-text-dim">
            REPORTED + FORWARD
          </span>
        </PanelHeader>

        {hasDataState(state) ? (
          <DataState
            state={state}
            error={error}
            onRetry={() => void query.refetch()}
            emptyTitle="No fundamentals available"
            emptyMessage="Reported growth and analyst consensus will appear after the next fundamentals refresh."
            compact
          />
        ) : (
          <>
            <div className="md:hidden">
              {rows.map((holding, index) => (
                <FundamentalsCard
                  key={holding.ticker ?? `fundamentals-${index}`}
                  holding={holding}
                />
              ))}
            </div>
            <HScroll className="hidden md:block">
              <table className="w-full min-w-[1120px]">
                <thead>
                  <tr className="border-b border-border bg-bg">
                    <th rowSpan={2} className="px-5 py-3 text-left align-bottom font-mono text-[10px] font-medium tracking-[1.5px] text-text-dim">
                      TICKER
                    </th>
                    <th colSpan={2} className="border-l border-border px-5 py-2.5 text-left font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
                      LATEST EARNINGS VS ESTIMATE
                    </th>
                    <th colSpan={2} className="border-l border-border px-5 py-2.5 text-left font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
                      REPORTED TTM GROWTH
                    </th>
                    <th colSpan={2} className="border-l border-border px-5 py-2.5 text-left font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
                      FORWARD CONSENSUS
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-bg">
                    {["REVENUE", "EPS", "REVENUE", "EPS", "REVENUE", "EPS"].map((label, index) => (
                      <th
                        key={`${label}-${index}`}
                        className={`px-5 py-2.5 text-left font-mono text-[10px] font-medium tracking-[1.5px] text-text-dim ${index === 0 || index === 2 || index === 4 ? "border-l border-border" : ""}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((holding, index) => (
                    <FundamentalsRow
                      key={holding.ticker ?? `fundamentals-${index}`}
                      holding={holding}
                    />
                  ))}
                </tbody>
              </table>
            </HScroll>
          </>
        )}

        <p className="border-t border-border px-5 py-3 font-sans text-[10px] leading-relaxed text-text-dim">
          Earnings surprise compares the latest reported actual with the
          consensus estimate available for that announcement. Reported growth
          compares the latest trailing four quarters with the prior four.
          Forward consensus is the current analyst average for the labeled
          fiscal year; revision is its change from the prior snapshot.
        </p>
      </div>
    </div>
  );
}
