import { CompanyLogo } from "@/components/ui/company-logo";
import { CategoryTag } from "@/components/ui/category-tag";
import { BACKTEST, FINAL_HOLDINGS, WINNERS_CIRCLE } from "@/lib/constants";
import { TONE_BG, type PastelTone } from "@/lib/tones";

/**
 * Cropped dashboard panels for the homepage loop — same tokens as the product,
 * static shapes only. No live data, no invented live performance figures.
 */

const PANEL =
  "h-full w-full overflow-hidden rounded-xl border border-border bg-bg-secondary/60 flex flex-col";

const PANEL_HEAD =
  "px-4 py-2.5 border-b border-border bg-bg-secondary/80 font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-text-dim";

const FACTORS: { label: string; pct: number; tone: PastelTone }[] = [
  { label: "Growth", pct: 82, tone: "mint" },
  { label: "Revisions", pct: 71, tone: "cyan" },
  { label: "Profitability", pct: 64, tone: "yellow" },
  { label: "Momentum", pct: 48, tone: "peach" },
  { label: "Valuation", pct: 35, tone: "lilac" },
];

export function ResearchDiagram() {
  return (
    <div className={PANEL}>
      <div className={PANEL_HEAD}>Universe scan</div>
      <div className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5">
        <p className="mb-4 font-mono text-[22px] font-bold leading-none text-text">
          ~3,600
          <span className="ml-1.5 font-sans text-[11px] font-semibold tracking-normal text-text-dim">
            US-listed names
          </span>
        </p>
        <div className="space-y-2">
          {FACTORS.map((f) => (
            <div key={f.label} className="flex items-center gap-2.5">
              <span className="w-[72px] shrink-0 truncate font-mono text-[9px] text-text-dim">
                {f.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                <div
                  className={`h-full rounded-full ${TONE_BG[f.tone]}`}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublishDiagram() {
  return (
    <div className={PANEL}>
      <div className={`${PANEL_HEAD} flex items-center justify-between gap-2`}>
        <span>Research note</span>
        <CategoryTag tone="mint" className="!text-[9px] !px-2 !py-0.5">
          New pick
        </CategoryTag>
      </div>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-3 flex items-center gap-2.5">
          <CompanyLogo ticker="CRS" size="sm" />
          <div>
            <p className="font-mono text-[14px] font-bold leading-none">CRS</p>
            <p className="mt-0.5 font-sans text-[10px] text-text-dim">
              Carpenter Technology
            </p>
          </div>
        </div>
        <p className="mb-3 font-sans text-[13px] font-semibold leading-snug text-text">
          Specialty alloys with pricing power the market still underweights
        </p>
        <div className="mt-auto space-y-1.5 border-t border-border pt-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-dim">
            In the note
          </p>
          <p className="font-sans text-[11px] leading-relaxed text-text-muted">
            Thesis · financials · cycle context · exit rules
          </p>
        </div>
      </div>
    </div>
  );
}

export function TrackDiagram() {
  const rows: { ticker: string; status: "Open" | "Closed" }[] = [
    { ticker: "CRS", status: "Open" },
    { ticker: "FIX", status: "Open" },
    { ticker: "YPF", status: "Closed" },
  ];
  return (
    <div className={PANEL}>
      <div className={`${PANEL_HEAD} flex items-center justify-between`}>
        <span>Example portfolio</span>
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
        </span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div
            key={r.ticker}
            className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <CompanyLogo ticker={r.ticker} size="xs" />
              <span className="font-mono text-[13px] font-semibold">
                {r.ticker}
              </span>
            </span>
            <span
              className={`badge !py-1 !text-[10px] ${
                r.status === "Open"
                  ? "bg-accent-green-soft text-accent-green"
                  : "bg-bg-tertiary text-text-dim"
              }`}
            >
              {r.status}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-auto border-t border-border px-4 py-2.5 font-sans text-[10px] text-text-dim sm:px-5">
        Every entry, trim, and exit stays on the page
      </p>
    </div>
  );
}

/** Closed picks from the backtrained model — winners and losers both shown. */
export function MeasureDiagram() {
  const winners = WINNERS_CIRCLE.slice(0, 3);
  const losers = FINAL_HOLDINGS.filter((h) => h.ret.startsWith("-")).slice(0, 3);

  return (
    <div className={PANEL}>
      <div className={`${PANEL_HEAD} flex items-center justify-between gap-2`}>
        <span>Closed picks</span>
        <span className="font-mono text-[9px] font-semibold normal-case tracking-normal text-text-dim">
          {BACKTEST.wins}W / {BACKTEST.losses}L
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 py-3 sm:px-5 sm:py-4">
        <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-dim">
          Backtrained model · simulated
        </p>

        <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-accent-green">
          Winners
        </p>
        <ul className="mb-4 divide-y divide-border border-y border-border">
          {winners.map((w) => (
            <li
              key={w.ticker}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <CompanyLogo ticker={w.ticker} size="xs" />
                <span className="font-mono text-[12px] font-semibold">
                  {w.ticker}
                </span>
              </span>
              <span className="font-mono text-[12px] font-semibold tabular-nums text-accent-green">
                {w.ret}
              </span>
            </li>
          ))}
        </ul>

        <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-accent-red">
          Losers
        </p>
        <ul className="divide-y divide-border border-y border-border">
          {losers.map((l) => (
            <li
              key={l.ticker}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <CompanyLogo ticker={l.ticker} size="xs" />
                <span className="font-mono text-[12px] font-semibold">
                  {l.ticker}
                </span>
              </span>
              <span className="font-mono text-[12px] font-semibold tabular-nums text-accent-red">
                {l.ret}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-auto pt-3 font-sans text-[10px] leading-relaxed text-text-dim">
          {BACKTEST.closedPicks} closed picks · {BACKTEST.startDate} –{" "}
          {BACKTEST.endDate}
        </p>
      </div>
    </div>
  );
}
