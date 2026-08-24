import Link from "next/link";
import type { ReactNode } from "react";

import { Callout, KeyTakeaway, LI, Lede, P, TLDR, UL } from "@/components/blog/prose";
import { MarkdownProse } from "@/components/blog/markdown-prose";
import { CompanyLogo } from "@/components/ui/company-logo";
import { SITE_NAME } from "@/lib/constants";
import { insightCategoryLabel } from "@/lib/insights";
import type { Insight } from "@/lib/insights";

/**
 * The rendered body of a research note, shared by the members-only route and
 * the public sample route.
 *
 * Extracted rather than duplicated because the two pages must show the same
 * note: a public specimen that reads differently from what a member gets is a
 * misrepresentation of the product. The auth check lives entirely in
 * /dashboard/insights/layout.tsx, so this markup was already free of it.
 *
 * `viz` is a slot, not a prop bundle. The live figures a note carries — quant
 * rating, week-vs-SPY bars, the Street range band — are fetched per route with
 * different caching, and only some of them make sense on a given post type.
 */

const TONE_BY_POST_TYPE: Record<string, string> = {
  weekly_review: "bg-accent-mint/15",
  quarterly_review: "bg-accent-lilac/15",
  exit: "bg-accent-peach/15",
  pick: "bg-accent-yellow/15",
};

export function insightTone(postType: string): string {
  return TONE_BY_POST_TYPE[postType] ?? TONE_BY_POST_TYPE.pick;
}

export function formatInsightDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function InsightHeader({ insight }: { insight: Insight }) {
  const dateLabel = insight.publishedAt ?? insight.createdAt;

  return (
    <header className="mt-6 border-b border-border pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-lg px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted ${insightTone(
            insight.postType,
          )}`}
        >
          {insightCategoryLabel(insight)}
        </span>
        <span className="font-mono text-[11px] text-text-dim">
          {formatInsightDate(dateLabel)}
          {insight.quarter ? ` · ${insight.quarter}` : ""}
          {insight.readingTime ? ` · ${insight.readingTime} min read` : ""}
        </span>
      </div>

      <div className="flex items-start gap-4 sm:gap-5">
        {insight.ticker ? (
          <CompanyLogo ticker={insight.ticker} size="lg" priority />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="font-sans text-[28px] font-bold leading-[1.2] tracking-tight text-text sm:text-[32px]">
            {insight.title ?? insight.slug}
          </h1>

          {insight.description && (
            <p className="mt-4 font-sans text-[16px] leading-[1.6] text-text-muted">
              {insight.description}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * The disclaimer is a fixed template, not authored content.
 *
 * It was identical in all eight hand-written notes, and making it a column
 * would mean a note could be published without it.
 */
function InsightDisclaimer({ insight }: { insight: Insight }) {
  const dashboard = (
    <Link href="/dashboard" className="underline">
      dashboard
    </Link>
  );

  return (
    <Callout variant="warning" title="Educational disclaimer">
      <P>
        {insight.postType === "weekly_review" ? (
          <>
            This note is a weekly review of the {SITE_NAME} live portfolio. It is
            educational research, not a recommendation to buy or sell. See the{" "}
            {dashboard} for the live book.
          </>
        ) : insight.postType === "exit" ? (
          <>
            This note accounts for a position the {SITE_NAME} live portfolio has
            closed. It is a record of what we did and why, not a recommendation
            to buy or sell {insight.ticker ?? "this security"}. See the{" "}
            {dashboard} for the live book.
          </>
        ) : (
          <>
            This note explains why {insight.ticker ?? "this position"} is in the{" "}
            {SITE_NAME} live portfolio. It is educational research, not a
            recommendation to buy or sell. See the {dashboard} for the live book.
          </>
        )}
      </P>
    </Callout>
  );
}

export function InsightBody({
  insight,
  viz,
}: {
  insight: Insight;
  /** Live figure panels, rendered between the Highlights box and the body. */
  viz?: ReactNode;
}) {
  return (
    <div className="pt-10">
      {insight.lede && <Lede>{insight.lede}</Lede>}

      {insight.tldr.length > 0 && (
        <TLDR>
          <UL>
            {insight.tldr.map((line, i) => (
              <LI key={i}>{line}</LI>
            ))}
          </UL>
        </TLDR>
      )}

      {viz}

      {insight.bodyMd && <MarkdownProse markdown={insight.bodyMd} />}

      <InsightDisclaimer insight={insight} />

      {insight.keyTakeaway && (
        <KeyTakeaway>
          <P>{insight.keyTakeaway}</P>
        </KeyTakeaway>
      )}
    </div>
  );
}
