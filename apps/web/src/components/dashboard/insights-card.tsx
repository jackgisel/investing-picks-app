"use client";

import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { insightsForTickers, type InsightMeta } from "@/lib/insights";
import { useInsights } from "@/lib/hooks/use-insights";
import type { Holding } from "@/lib/hooks/use-strategy";
import { CompanyLogo } from "@/components/ui/company-logo";

const MAX_ROWS = 5;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function InsightRow({ insight }: { insight: InsightMeta }) {
  return (
    <Link
      href={`/dashboard/insights/${insight.slug}`}
      className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-bg-tertiary/50 focus-visible:outline-none focus-visible:bg-bg-tertiary/50"
    >
      {insight.ticker && (
        <span className="mt-px flex w-[82px] shrink-0 items-center gap-2 font-mono text-[12px] font-semibold">
          <CompanyLogo ticker={insight.ticker} size="xs" />
          <span>{insight.ticker}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-[13px] text-text group-hover:underline underline-offset-2">
          {insight.title}
        </span>
        <span className="mt-0.5 block font-mono text-[10px] text-text-dim">
          {formatDate(insight.publishedAt ?? insight.createdAt)} ·{" "}
          {insight.readingTime} min read
        </span>
      </span>
      <ArrowUpRight
        size={13}
        className="mt-1 shrink-0 text-text-dim group-hover:text-text"
        aria-hidden
      />
    </Link>
  );
}

/**
 * Research, on the dashboard.
 *
 * Eight member-only insights existed and the only way into them from the
 * product was noticing that a ticker in the picks table happened to be
 * underlined — no sidebar entry, no navbar link, nothing on the index.
 *
 * Cross-referencing against open holdings is the point: it turns the archive
 * from a blog into a per-position annotation, which is what a subscriber
 * holding the name actually wants. Everything else falls back to latest.
 *
 * Fetches metadata from /api/data/insights rather than importing it. Notes are
 * database rows now, and the generated module this used to read existed only
 * to keep every article body out of this bundle.
 */
export function InsightsCard({ holdings }: { holdings?: readonly Holding[] }) {
  const insights = useInsights().data?.insights ?? [];

  const owned = insightsForTickers(
    insights,
    (holdings ?? []).map((h) => h.ticker),
  ).slice(0, MAX_ROWS);

  const onHoldings = owned.length > 0;
  const rows = onHoldings ? owned : insights.slice(0, MAX_ROWS);

  if (rows.length === 0) return null;

  return (
    <div className="data-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <span className="panel-label panel-label-lilac">
          {onHoldings ? "Research on your holdings" : "Latest research"}
        </span>
        <Link
          href="/dashboard/insights"
          className="flex items-center gap-1 font-mono text-[10px] font-semibold text-text underline underline-offset-2 hover:opacity-70"
        >
          ALL INSIGHTS <ArrowUpRight size={10} />
        </Link>
      </div>

      <div className="divide-y divide-border-light">
        {rows.map((insight) => (
          <InsightRow key={insight.slug} insight={insight} />
        ))}
      </div>

      {onHoldings && owned.length < (holdings?.length ?? 0) && (
        <p className="border-t border-border px-5 py-3 font-sans text-[11px] text-text-dim">
          <FileText size={11} className="mr-1.5 inline align-[-1px]" />
          Not every position has a published note — research goes out with the
          pick, and the live book was seeded with names that predate it.
        </p>
      )}
    </div>
  );
}
