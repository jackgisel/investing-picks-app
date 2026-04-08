import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { ArticleMeta, Article } from "@/lib/blog";
import { ArticleCard } from "./article-card";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

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
      {/* Header */}
      <header className="border-b border-border">
        <div className="container-op pt-14 pb-16">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 font-mono text-[11px] text-text-dim tracking-wider hover:text-accent-green transition-colors mb-10"
          >
            <ArrowLeft size={12} />
            ALL ARTICLES
          </Link>

          <div className="flex flex-wrap items-center gap-4 mb-6 font-mono text-[10px] tracking-[2px] uppercase">
            <span className="text-accent-green">{meta.category}</span>
            <span className="text-text-dim">·</span>
            <span className="text-text-dim">{formatDate(meta.publishedAt)}</span>
            <span className="text-text-dim">·</span>
            <span className="text-text-dim">{meta.readingTime} min read</span>
          </div>

          <h1 className="font-sans text-[34px] sm:text-[42px] font-bold leading-[1.15] tracking-tight text-text max-w-[760px] mb-6">
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
                  className="font-mono text-[10px] text-text-dim tracking-wider px-2.5 py-1 border border-border bg-bg-secondary uppercase"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="container-op py-16">{children}</div>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-border bg-bg-secondary/30">
          <div className="container-op py-16">
            <p className="font-mono text-[10px] text-accent-green tracking-[3px] mb-3 uppercase">
              KEEP READING
            </p>
            <h2 className="font-sans text-[24px] font-bold tracking-tight mb-10">
              Related articles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-border">
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
