import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { CommentThread } from "@/components/comments/comment-thread";
import {
  QuantRatingMeter,
  WeekVsSpyBars,
} from "@/components/blog/insight-viz";
import { InsightBody, InsightHeader } from "@/components/blog/insight-article";
import { getAdminUser } from "@/lib/admin";
import { getAccess } from "@/lib/api-gate";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { isoWeekKey } from "@/lib/email-dispatch";
import { weeklyReviewSlug } from "@/lib/insights";
import { getInsightBySlug } from "@/lib/insights-db";
import {
  fetchQuantRatingForTicker,
  fetchWeekVsSpy,
} from "@/lib/insight-viz-data";
import { StreetRangeBand } from "@/components/street-range-band";
import { fetchStreetRangeForTicker } from "@/lib/street-range-server";

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

  const streetRange =
    insight.postType === "pick"
      ? await fetchStreetRangeForTicker(insight.ticker)
      : null;

  const quantRating =
    insight.postType === "pick"
      ? await fetchQuantRatingForTicker(insight.ticker)
      : null;

  const weekVsSpy =
    insight.postType === "weekly_review" &&
    insight.slug === weeklyReviewSlug(isoWeekKey())
      ? await fetchWeekVsSpy()
      : null;

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

      <InsightHeader insight={insight} />

      <InsightBody
        insight={insight}
        viz={
          <>
            {quantRating ? (
              <QuantRatingMeter
                rating={quantRating.rating}
                asOf={quantRating.asOf}
              />
            ) : null}

            {weekVsSpy ? (
              <WeekVsSpyBars
                bookChangePct={weekVsSpy.bookChangePct}
                spyChangePct={weekVsSpy.spyChangePct}
              />
            ) : null}

            {streetRange ? (
              <div className="mb-10">
                <StreetRangeBand range={streetRange} />
              </div>
            ) : null}
          </>
        }
      />

      <CommentThread subjectType="insight" subjectSlug={insight.slug} />
    </article>
  );
}
