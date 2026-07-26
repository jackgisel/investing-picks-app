"use client";

import { OutpickWordmark } from "@/components/ui/outpick-logo";
import {
  PicksBenchmarkChart,
  PicksBenchmarkLegend,
  formatChartPct,
} from "@/components/ui/picks-benchmark-chart";
import type { PicksComparison } from "@/lib/hooks/use-chart";
import type { Holding } from "@/lib/hooks/use-strategy";
import type { Trade } from "@/lib/hooks/use-trades";
import type { BlogPostSummary } from "@/lib/hooks/use-blog-posts";
import { formatPct } from "@/lib/portfolio";
import { BACKTEST, SITE_URL } from "@/lib/constants";

/* ------------------------------- Primitives ------------------------------- */

/**
 * Every slide is a full 1600×900 frame with identical padding, so the eyeline
 * and the title baseline never move between slides in the recording.
 */
function Slide({
  eyebrow,
  title,
  children,
  footer,
}: {
  eyebrow?: string;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full h-full flex flex-col px-[90px] py-[70px] bg-bg">
      {(eyebrow || title) && (
        <header className="mb-9 shrink-0">
          {eyebrow && (
            <p className="font-sans text-[15px] font-bold tracking-[0.22em] uppercase text-accent-green mb-3.5">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="font-sans text-[52px] font-extrabold tracking-tight leading-[1.05]">
              {title}
            </h2>
          )}
        </header>
      )}

      <div className="flex-1 min-h-0">{children}</div>

      <footer className="shrink-0 pt-7 flex items-center justify-between border-t border-border mt-7">
        <OutpickWordmark size={20} />
        <span className="font-mono text-[13px] text-text-dim tracking-wide">
          {footer ?? "Not investment advice · outpick.xyz"}
        </span>
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  note,
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "neutral";
  note?: string;
}) {
  const color =
    tone === "green"
      ? "text-accent-green"
      : tone === "red"
        ? "text-accent-red"
        : "text-text";
  return (
    <div>
      <p className="font-sans text-[14px] font-bold tracking-[0.16em] uppercase text-text-dim mb-3">
        {label}
      </p>
      <p className={`font-mono text-[76px] font-bold leading-none tracking-tight ${color}`}>
        {value}
      </p>
      {note && (
        <p className="font-sans text-[15px] text-text-dim mt-3.5">{note}</p>
      )}
    </div>
  );
}

const dash = "—";

function pct(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatPct(value)
    : dash;
}

function toneFor(value: number | null | undefined): "green" | "red" | "neutral" {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  return value >= 0 ? "green" : "red";
}

/* --------------------------------- Slides --------------------------------- */

export function CoverSlide({ reviewDate }: { reviewDate: string }) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-[90px] py-[70px] bg-bg relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_85%_15%,rgba(168,217,160,0.16),transparent_65%)]"
      />
      <div className="relative">
        <OutpickWordmark size={34} className="mb-14" />
        <p className="font-sans text-[18px] font-bold tracking-[0.24em] uppercase text-accent-green mb-6">
          Portfolio Review
        </p>
        <h1 className="font-sans text-[96px] font-extrabold tracking-tight leading-[0.98] uppercase mb-8 max-w-[1150px]">
          The book,
          <br />
          in the open.
        </h1>
        <p className="font-sans text-[24px] text-text-muted max-w-[720px] leading-relaxed">
          Every position, every entry, every loss — reviewed against the same
          money in the index.
        </p>
        <p className="font-mono text-[17px] text-text-dim mt-14 tracking-wide">
          {reviewDate}
        </p>
      </div>
    </div>
  );
}

export function ScoreboardSlide({
  picksReturnPct,
  comparison,
  positionCount,
  closedCount,
}: {
  picksReturnPct: number | null;
  comparison: PicksComparison;
  positionCount: number | null;
  closedCount: number | null;
}) {
  const best = comparison.benchmarks.reduce<{ label: string; pct: number } | null>(
    (acc, b) =>
      b.latestPct === null
        ? acc
        : acc === null || b.latestPct > acc.pct
          ? { label: b.label || b.key, pct: b.latestPct }
          : acc,
    null
  );
  const lead =
    picksReturnPct !== null && best !== null ? picksReturnPct - best.pct : null;

  return (
    <Slide eyebrow="Where we stand" title="The scoreboard">
      <div className="grid grid-cols-3 gap-x-16 gap-y-14 h-full content-start pt-4">
        <Metric
          label="Return on picks"
          value={pct(picksReturnPct)}
          tone={toneFor(picksReturnPct)}
          note="Capital deployed into picks"
        />
        <Metric
          label={best ? `${best.label}, same window` : "Benchmark"}
          value={best ? pct(best.pct) : dash}
          note="Same dollars, same dates"
        />
        <Metric
          label="Lead vs. best index"
          value={lead === null ? dash : `${lead >= 0 ? "+" : ""}${lead.toFixed(2)} pts`}
          tone={toneFor(lead)}
        />
        <Metric
          label="Open positions"
          value={positionCount === null ? dash : String(positionCount)}
        />
        <Metric
          label="Closed picks"
          value={closedCount === null ? dash : String(closedCount)}
        />
        <Metric
          label="Model target CAGR"
          value={BACKTEST.cagr}
          tone="green"
          note="5-year walk-forward backtest"
        />
      </div>
    </Slide>
  );
}

export function ChartSlide({ comparison }: { comparison: PicksComparison }) {
  const hasCurve = comparison.rows.filter((r) => r.picks !== null).length >= 2;

  return (
    <Slide eyebrow="Performance" title="Picks vs. the same money in the index">
      {hasCurve ? (
        <div className="h-full flex flex-col">
          <div className="flex items-end gap-5 mb-5">
            {comparison.picksLatestPct !== null && (
              <span
                className={`font-mono text-[56px] font-bold leading-none tracking-tight ${
                  comparison.picksLatestPct >= 0
                    ? "text-accent-green"
                    : "text-accent-red"
                }`}
              >
                {formatChartPct(comparison.picksLatestPct)}
              </span>
            )}
            <div className="pb-2">
              <PicksBenchmarkLegend comparison={comparison} />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PicksBenchmarkChart comparison={comparison} height={430} />
          </div>
        </div>
      ) : (
        <div className="h-full grid place-items-center">
          <p className="font-sans text-[22px] text-text-dim">
            Not enough marks yet to draw the curve.
          </p>
        </div>
      )}
    </Slide>
  );
}

export function HoldingsSlide({
  holdings,
  page,
  pageCount,
}: {
  holdings: Holding[];
  page: number;
  pageCount: number;
}) {
  return (
    <Slide
      eyebrow="The book"
      title={pageCount > 1 ? `Open positions (${page} of ${pageCount})` : "Open positions"}
    >
      <div className="grid grid-cols-2 gap-x-16 gap-y-0 content-start">
        {holdings.map((h) => (
          <div
            key={h.ticker}
            className="flex items-baseline justify-between gap-6 border-b border-border py-[18px]"
          >
            <div className="flex items-baseline gap-4 min-w-0">
              <span className="font-mono text-[28px] font-bold tracking-tight">
                {h.ticker}
              </span>
              {h.is_house_money && (
                <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-accent-green px-2.5 py-1 rounded-pill bg-accent-green-soft shrink-0">
                  House money
                </span>
              )}
              <span className="font-sans text-[14px] text-text-dim truncate">
                {h.entry_date ?? ""}
              </span>
            </div>
            <span
              className={`font-mono text-[28px] font-bold shrink-0 ${
                h.pnl_pct >= 0 ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {pct(h.pnl_pct)}
            </span>
          </div>
        ))}
      </div>
    </Slide>
  );
}

export function WinnersLaggardsSlide({ holdings }: { holdings: Holding[] }) {
  const sorted = [...holdings].sort((a, b) => b.pnl_pct - a.pnl_pct);
  const winners = sorted.slice(0, 5);
  const laggards = sorted.slice(-5).reverse();

  return (
    <Slide eyebrow="Both sides" title="What's working. What isn't.">
      <div className="grid grid-cols-2 gap-16 h-full">
        <div>
          <p className="font-sans text-[15px] font-bold tracking-[0.16em] uppercase text-accent-green mb-6">
            Leading
          </p>
          {winners.map((h) => (
            <Row key={h.ticker} ticker={h.ticker} value={h.pnl_pct} />
          ))}
        </div>
        <div>
          <p className="font-sans text-[15px] font-bold tracking-[0.16em] uppercase text-accent-red mb-6">
            Lagging
          </p>
          {laggards.map((h) => (
            <Row key={h.ticker} ticker={h.ticker} value={h.pnl_pct} />
          ))}
        </div>
      </div>
    </Slide>
  );
}

function Row({ ticker, value }: { ticker: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-[19px]">
      <span className="font-mono text-[30px] font-bold tracking-tight">
        {ticker}
      </span>
      <span
        className={`font-mono text-[30px] font-bold ${
          value >= 0 ? "text-accent-green" : "text-accent-red"
        }`}
      >
        {pct(value)}
      </span>
    </div>
  );
}

export function TradesSlide({ trades }: { trades: Trade[] }) {
  return (
    <Slide eyebrow="Since last review" title="What we actually did">
      {trades.length === 0 ? (
        <div className="h-full grid place-items-center">
          <p className="font-sans text-[22px] text-text-dim">
            No trades in this period — that counts as a decision too.
          </p>
        </div>
      ) : (
        <div className="content-start">
          {trades.map((t, i) => (
            <div
              key={`${t.ticker}-${t.date}-${i}`}
              className="grid grid-cols-[130px_180px_1fr] items-baseline gap-8 border-b border-border py-[21px]"
            >
              <span
                className={`font-sans text-[15px] font-bold tracking-[0.14em] uppercase ${
                  t.side === "buy" ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {t.side}
              </span>
              <span className="font-mono text-[28px] font-bold tracking-tight">
                {t.ticker}
              </span>
              <span className="font-sans text-[17px] text-text-muted truncate">
                {t.reason ?? ""}
                <span className="text-text-dim font-mono text-[15px] ml-4">
                  {t.date}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Slide>
  );
}

export function ResearchSlide({ post }: { post: BlogPostSummary }) {
  return (
    <Slide eyebrow="Research note" title={post.ticker ?? "Latest research"}>
      <div className="h-full flex flex-col justify-center max-w-[1180px]">
        <h3 className="font-sans text-[46px] font-bold tracking-tight leading-[1.12] mb-9">
          {post.title}
        </h3>
        <p className="font-sans text-[25px] text-text-muted leading-[1.55]">
          {post.excerpt}
        </p>
        <p className="font-mono text-[15px] text-text-dim mt-10 tracking-wide">
          Published {post.published_at.slice(0, 10)} · full thesis for members at
          outpick.xyz/insights
        </p>
      </div>
    </Slide>
  );
}

export function OutroSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center px-[90px] py-[70px] bg-bg relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_15%_85%,rgba(168,217,160,0.16),transparent_65%)]"
      />
      <div className="relative">
        <p className="font-sans text-[18px] font-bold tracking-[0.24em] uppercase text-accent-green mb-7">
          Every pick. Every loss. Published.
        </p>
        <h2 className="font-sans text-[82px] font-extrabold tracking-tight leading-[1.02] uppercase mb-9 max-w-[1150px]">
          A research firm with
          <br />a public track record.
        </h2>
        <p className="font-sans text-[24px] text-text-muted max-w-[760px] leading-relaxed mb-12">
          The backtest, the live book, and the weekly Market Note are all on the
          site. The Market Note is free.
        </p>
        <p className="font-mono text-[30px] font-bold text-text tracking-wide">
          {SITE_URL.replace(/^https?:\/\//, "")}
        </p>
        <p className="font-sans text-[15px] text-text-dim mt-14 max-w-[900px] leading-relaxed">
          Outpick is an independent equity research publication. Nothing here is
          investment advice. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
}
