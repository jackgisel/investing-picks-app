import Link from "next/link";
import type { ArticleMeta } from "@/lib/blog";
import { artForArticle } from "@/lib/art";
import { ArtThumb } from "@/components/art/art-masthead";
import { CategoryTag, type PastelTone } from "@/components/ui/category-tag";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
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

function toneFor(category: string): PastelTone {
  return CATEGORY_TONES[category] ?? "peach";
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
  const art = artForArticle(meta);

  if (featured) {
    return (
      <Link
        href={`/blog/${meta.slug}`}
        className="block overflow-hidden soft-card !p-0 hover:bg-bg-tertiary transition-colors group"
      >
        <ArtThumb art={art} className="h-[160px] sm:h-[200px]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <CategoryTag tone={toneFor(meta.category)}>{meta.category}</CategoryTag>
            <span className="font-sans text-[12px] text-text-dim">
              {formatDate(meta.publishedAt)} · {meta.readingTime} min read
            </span>
          </div>
          <h3 className="font-sans text-[26px] font-bold leading-[1.2] tracking-tight mb-3 text-text group-hover:opacity-70 transition-opacity">
            {meta.title}
          </h3>
          <p className="font-sans text-[15px] text-text-muted leading-relaxed max-w-[640px] mb-6">
            {meta.description}
          </p>
          <span className="pill-solid text-[11px]">
            Read article <span className="ml-1">→</span>
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${meta.slug}`}
      className="block overflow-hidden soft-card !p-0 hover:bg-bg-tertiary transition-colors group h-full"
    >
      {!compact && <ArtThumb art={art} className="h-[110px]" />}
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <CategoryTag tone={toneFor(meta.category)} className="!text-[10px] !px-3 !py-1.5">
            {meta.category}
          </CategoryTag>
          <span className="font-sans text-[11px] text-text-dim">
            {meta.readingTime} min
          </span>
        </div>
        <h3
          className={`font-sans font-bold leading-[1.25] tracking-tight mb-3 text-text group-hover:opacity-70 transition-opacity ${
            compact ? "text-[16px]" : "text-[18px]"
          }`}
        >
          {meta.title}
        </h3>
        <p className="font-sans text-[13px] text-text-muted leading-relaxed line-clamp-3">
          {meta.description}
        </p>
        <p className="mt-5 font-sans text-[12px] text-text-dim">
          {formatDate(meta.publishedAt)}
        </p>
      </div>
    </Link>
  );
}
