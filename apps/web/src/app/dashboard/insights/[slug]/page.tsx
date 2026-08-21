import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { CommentThread } from "@/components/comments/comment-thread";
import { MarkdownProse } from "@/components/blog/markdown-prose";
import { Callout, KeyTakeaway, LI, Lede, P, TLDR, UL } from "@/components/blog/prose";
import { getAdminUser } from "@/lib/admin";
import { getAccess } from "@/lib/api-gate";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { insightCategoryLabel } from "@/lib/insights";
import { getInsightBySlug } from "@/lib/insights-db";
import { CompanyLogo } from "@/components/ui/company-logo";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const access = await getAccess();
  if (!access.entitled) {
    return {
      title: "Insights — Members only",
      robots: { index: false, follow: false },
    };
  }

  const { slug } = await params;
  const insight = await getInsightBySlug(slug);
  if (!insight) return { robots: { index: false, follow: false } };

  const url = `${SITE_URL}/dashboard/insights/${insight.slug}`;
  const title = insight.title ?? undefined;
  const description = insight.description ?? undefined;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: insight.publishedAt ?? undefined,
      authors: insight.author ? [insight.author] : undefined,
      tags: insight.tags,
    },
    twitter: { card: "summary", title, description },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  // Admins can open a draft to check how it reads on the real page before
  // approving it. Everyone else gets published notes only, and the filter is
  // in the query rather than a check here — a page that forgets to look at
  // `status` still cannot serve an unreviewed draft.
  const admin = await getAdminUser();
  const insight = await getInsightBySlug(slug, {
    includeUnpublished: admin !== null,
  });
  if (!insight) notFound();

  const categoryLabel = insightCategoryLabel(insight);

  const tone =
    insight.postType === "weekly_review"
      ? "bg-accent-mint/15"
      : insight.postType === "quarterly_review"
        ? "bg-accent-lilac/15"
        : "bg-accent-yellow/15";

  const dateLabel = insight.publishedAt ?? insight.createdAt;

  return (
    // The shell is 1400px wide for tables; long-form prose is not, so the
    // article caps itself at a reading measure. prose.tsx already holds its
    // own children to 680px — this keeps the header aligned with them.
    <article className="max-w-[760px]">
      <Link
        href="/dashboard/insights"
        className="inline-flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft size={12} />
        All insights
      </Link>

      {insight.status !== "approved" && (
        <div className="mt-6 rounded-soft border border-accent-coral/40 bg-accent-coral/5 px-4 py-3">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-accent-coral">
            {insight.status} — not published
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Only admins can see this. Subscribers see nothing here until it is
            approved.
          </p>
        </div>
      )}

      <header className="mt-6 border-b border-border pb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted ${tone}`}
          >
            {categoryLabel}
          </span>
          <span className="font-mono text-[11px] text-text-dim">
            {formatDate(dateLabel)}
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

        {insight.bodyMd && <MarkdownProse markdown={insight.bodyMd} />}

        {/* Fixed template, not authored content. It was identical in all eight
            hand-written notes, and making it a column would mean a note could
            be published without it. */}
        <Callout variant="warning" title="Educational disclaimer">
          <P>
            {insight.postType === "weekly_review" ? (
              <>
                This note is a weekly review of the {SITE_NAME} live portfolio.
                It is educational research, not a recommendation to buy or sell.
                See the{" "}
                <Link href="/dashboard" className="underline">
                  dashboard
                </Link>{" "}
                for the live book.
              </>
            ) : (
              <>
                This note explains why {insight.ticker ?? "this position"} is in
                the {SITE_NAME} live portfolio. It is educational research, not a
                recommendation to buy or sell. See the{" "}
                <Link href="/dashboard" className="underline">
                  dashboard
                </Link>{" "}
                for the live book.
              </>
            )}
          </P>
        </Callout>

        {insight.keyTakeaway && (
          <KeyTakeaway>
            <P>{insight.keyTakeaway}</P>
          </KeyTakeaway>
        )}
      </div>

      <CommentThread subjectType="insight" subjectSlug={insight.slug} />
    </article>
  );
}
