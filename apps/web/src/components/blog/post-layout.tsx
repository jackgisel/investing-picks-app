import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { ArticleMeta, Article } from "@/lib/blog";
import { ArticleCard } from "./article-card";
import { CategoryTag, type PastelTone } from "@/components/ui/category-tag";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { CommentThread } from "@/components/comments/comment-thread";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const CATEGORY_TONES: Record<string, PastelTone> = {
  Strategy: "yellow",
  Education: "lilac",
  Markets: "cyan",
  Portfolio: "mint",
};

export function PostLayout({
  meta,
  related,
  children,
}: {
  meta: ArticleMeta;
  related: Article[];
  children: ReactNode;
}) {
  return (
    <article>
      <header className="border-b border-border">
        <div className="container-op pt-14 pb-16">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 font-sans text-[12px] font-bold tracking-[0.1em] uppercase text-text-dim hover:text-text transition-colors mb-10"
          >
            <ArrowLeft size={12} />
            All articles
          </Link>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <CategoryTag tone={CATEGORY_TONES[meta.category] ?? "peach"}>
              {meta.category}
            </CategoryTag>
            <span className="font-sans text-[13px] text-text-dim">
              {formatDate(meta.publishedAt)} · {meta.readingTime} min read
            </span>
          </div>

          <h1 className="font-sans text-[34px] sm:text-[42px] font-extrabold leading-[1.15] tracking-tight text-text max-w-[760px] mb-6">
            {meta.title}
          </h1>

          <p className="font-sans text-[17px] text-text-muted leading-[1.6] max-w-[680px]">
            {meta.description}
          </p>

          {meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8">
              {meta.tags.map((tag) => (
                <span
                  key={tag}
                  className="badge !text-[11px] !py-1.5 !font-semibold bg-bg-secondary text-text-dim"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="container-op py-16">
        {children}
        {/* Discussion sits inside the article column, above the signup: it is
            part of the post, not a footer promo. Reading is public; posting is
            gated in the route handler. */}
        <div className="max-w-[720px]">
          <CommentThread subjectType="blog" subjectSlug={meta.slug} />
        </div>
      </div>

      {/* The end of an article is the highest-intent moment on the marketing
          site: they just read 1,500 words voluntarily. Ask for the email here,
          not for the sale. */}
      <section className="border-t border-border">
        <div className="container-op py-14">
          <MarketNoteSignup
            source={`blog:${meta.slug}`}
            variant="panel"
            className="max-w-[620px]"
          />
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-border bg-bg-secondary/40">
          <div className="container-op py-16">
            <p className="section-label mb-3">Keep reading</p>
            <h2 className="font-sans text-[24px] font-bold tracking-tight mb-10">
              Related articles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map((a) => (
                <ArticleCard key={a.meta.slug} meta={a.meta} compact />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
