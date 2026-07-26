import Link from "next/link";

import { insights, type Insight } from "@/lib/insights";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function categoryLabel(insight: Insight): string {
  if (insight.meta.postType === "quarterly_review") return "Quarterly review";
  return insight.meta.ticker ? `Pick · ${insight.meta.ticker}` : "Pick";
}

function InsightCard({
  insight,
  featured = false,
}: {
  insight: Insight;
  featured?: boolean;
}) {
  const { meta } = insight;
  const tone =
    meta.postType === "quarterly_review"
      ? "bg-accent-lilac/15"
      : "bg-accent-yellow/15";

  return (
    <Link
      href={`/dashboard/insights/${meta.slug}`}
      className="group block h-full data-card transition-colors hover:bg-bg-tertiary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span
        className={`inline-flex items-center rounded-lg px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted ${tone}`}
      >
        {categoryLabel(insight)}
      </span>
      <h2
        className={`mt-3.5 font-sans font-bold tracking-tight text-text transition-opacity group-hover:opacity-70 ${
          featured
            ? "text-[22px] leading-[1.2] max-w-[720px]"
            : "text-[16px] leading-[1.3]"
        }`}
      >
        {meta.title}
      </h2>
      <p
        className={`mt-2.5 font-sans text-text-muted leading-relaxed ${
          featured ? "text-[14px] max-w-[640px]" : "text-[13px] line-clamp-3"
        }`}
      >
        {meta.description}
      </p>
      <p className="mt-4 font-mono text-[11px] text-text-dim">
        {formatDate(meta.publishedAt)}
        {meta.readingTime ? ` · ${meta.readingTime} min read` : ""}
      </p>
    </Link>
  );
}

export default function InsightsIndexPage() {
  const [featured, ...rest] = insights;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Insights</h1>
        <p className="mt-1 font-sans text-[13px] text-text-dim">
          {insights.length === 0
            ? "No research published yet"
            : `${insights.length} research note${insights.length === 1 ? "" : "s"} · the thesis behind every position`}
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="data-card py-12 text-center">
          <p className="panel-label panel-label-lilac justify-center">
            Nothing published yet
          </p>
          <p className="mt-3 font-sans text-[14px] text-text-muted">
            The first batch is being written. New research lands with each pick.
          </p>
        </div>
      ) : (
        <>
          {featured && (
            <section className="space-y-3">
              <p className="panel-label panel-label-lilac">Latest</p>
              <InsightCard insight={featured} featured />
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-3">
              <p className="panel-label panel-label-lilac">All research</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rest.map((insight) => (
                  <InsightCard key={insight.meta.slug} insight={insight} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
