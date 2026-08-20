import { CompanyLogo } from "@/components/ui/company-logo";
import { TONE_BG, type PastelTone } from "@/lib/tones";

/**
 * Compact, token-built visuals for the "how it works" steps — replacing a
 * set of stock illustrations (a person at a desk, a celebration around an
 * envelope) with small honest renderings of the product itself: what gets
 * scored, what a note looks like, what a live position looks like, what the
 * comparison looks like. Nothing here is real data — it's the shape of the
 * real thing, in the same visual language the dashboard actually uses.
 */

const CARD_CLASS =
  "h-full w-full rounded-soft border border-border bg-bg p-4 sm:p-5 flex flex-col justify-center";

const FACTORS: { label: string; pct: number; tone: PastelTone }[] = [
  { label: "Growth", pct: 82, tone: "mint" },
  { label: "Revisions", pct: 71, tone: "cyan" },
  { label: "Profitability", pct: 64, tone: "yellow" },
  { label: "Momentum", pct: 48, tone: "peach" },
  { label: "Valuation", pct: 35, tone: "lilac" },
];

export function ResearchDiagram() {
  return (
    <div className={CARD_CLASS}>
      <div className="space-y-2.5">
        {FACTORS.map((f) => (
          <div key={f.label} className="flex items-center gap-2.5">
            <span className="font-mono text-[9px] text-text-dim w-[62px] shrink-0 truncate">
              {f.label}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full ${TONE_BG[f.tone]}`}
                style={{ width: `${f.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublishDiagram() {
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2 mb-3">
        <CompanyLogo ticker="CRS" size="xs" />
        <span className="font-mono text-[12px] font-bold">CRS</span>
        <span className="badge bg-accent-green-soft text-accent-green ml-auto">
          New
        </span>
      </div>
      <div className="h-2 w-4/5 rounded bg-bg-tertiary mb-3" />
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded bg-bg-tertiary/70" />
        <div className="h-1.5 w-[90%] rounded bg-bg-tertiary/70" />
        <div className="h-1.5 w-2/3 rounded bg-bg-tertiary/70" />
      </div>
    </div>
  );
}

/**
 * Real tickers (they're names, not performance claims), no invented return
 * figures — this page is not a client component and has no live data to
 * draw on, and hardcoding a number here would drift from the real one
 * exactly the way the blog posts already did once.
 */
export function TrackDiagram() {
  const rows: { ticker: string; up: boolean }[] = [
    { ticker: "CRS", up: true },
    { ticker: "IRS", up: true },
    { ticker: "AGI", up: true },
  ];
  return (
    <div className={CARD_CLASS}>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.ticker} className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
            </span>
            <span className="font-mono text-[11px] font-semibold w-10 shrink-0">
              {r.ticker}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary overflow-hidden ml-2">
              <div
                className="h-full rounded-full bg-accent-green"
                style={{ width: "68%" }}
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Schematic only — no invented percentages for either series. */
export function MeasureDiagram() {
  const rows = [
    { label: "Picks", pct: 78, tone: true },
    { label: "S&P 500", pct: 46, tone: false },
  ];
  return (
    <div className={CARD_CLASS}>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="font-sans text-[10px] font-bold text-text-dim uppercase tracking-[0.08em] mb-1.5">
              {r.label}
            </p>
            <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full ${r.tone ? "bg-accent-green" : "bg-text-dim"}`}
                style={{ width: `${r.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
