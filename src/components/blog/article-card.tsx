import Link from "next/link";
import type { ArticleMeta } from "@/lib/blog";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ArticleCard({
  meta,
  compact = false,
  featured = false,
}: {
  meta: ArticleMeta;
  compact?: boolean;
  featured?: boolean;
}) {
  if (featured) {
    return (
      <Link
        href={`/blog/${meta.slug}`}
        className="block bg-bg-secondary border border-border hover:border-accent-green/40 transition-colors p-9 group"
      >
        <div className="flex flex-wrap items-center gap-3 mb-5 font-mono text-[10px] tracking-[2px] uppercase">
          <span className="text-accent-green">{meta.category}</span>
          <span className="text-text-dim">·</span>
          <span className="text-text-dim">{formatDate(meta.publishedAt)}</span>
          <span className="text-text-dim">·</span>
          <span className="text-text-dim">{meta.readingTime} min read</span>
        </div>
        <h3 className="font-sans text-[26px] font-bold leading-[1.2] tracking-tight mb-3 text-text group-hover:text-accent-green transition-colors">
          {meta.title}
        </h3>
        <p className="font-sans text-[15px] text-text-muted leading-relaxed max-w-[640px]">
          {meta.description}
        </p>
        <p className="mt-6 font-mono text-[11px] text-accent-green tracking-wider">
          READ ARTICLE →
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${meta.slug}`}
      className="block bg-bg-secondary hover:bg-bg-tertiary transition-colors p-7 group h-full"
    >
      <div className="flex items-center gap-3 mb-4 font-mono text-[10px] tracking-[2px] uppercase">
        <span className="text-accent-green">{meta.category}</span>
        <span className="text-text-dim">·</span>
        <span className="text-text-dim">{meta.readingTime} min</span>
      </div>
      <h3
        className={`font-sans font-bold leading-[1.25] tracking-tight mb-3 text-text group-hover:text-accent-green transition-colors ${
          compact ? "text-[16px]" : "text-[18px]"
        }`}
      >
        {meta.title}
      </h3>
      <p className="font-sans text-[13px] text-text-muted leading-relaxed line-clamp-3">
        {meta.description}
      </p>
      <p className="mt-5 font-mono text-[10px] text-text-dim tracking-wider">
        {formatDate(meta.publishedAt)}
      </p>
    </Link>
  );
}
