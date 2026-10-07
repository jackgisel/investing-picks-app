import Link from "next/link";
import { getArticlesInCategory } from "@/lib/blog";
import {
  categoryPath,
  subcategoryPath,
  type BlogCategory,
} from "@/lib/blog-taxonomy";
import { cn } from "@/lib/utils";

const chip =
  "press inline-flex items-center gap-2 rounded-pill border px-4 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.08em]";
const chipOn = "border-transparent bg-inverse text-inverse-fg";
const chipOff = "border-border-strong bg-bg text-text hover:bg-bg-secondary";

/** Sub-category chips for one category, with post counts. */
export function TopicNav({
  category,
  activeSlug,
}: {
  category: BlogCategory;
  activeSlug?: string;
}) {
  const total = getArticlesInCategory(category.name).length;
  return (
    <nav aria-label={`${category.name} topics`} className="flex flex-wrap gap-2">
      <Link
        href={categoryPath(category)}
        aria-current={!activeSlug ? "page" : undefined}
        className={cn(chip, !activeSlug ? chipOn : chipOff)}
      >
        All {category.name}
        <span className="font-mono text-[11px] opacity-70">{total}</span>
      </Link>
      {category.subcategories.map((sub) => {
        const count = getArticlesInCategory(category.name, sub.slug).length;
        const on = sub.slug === activeSlug;
        return (
          <Link
            key={sub.slug}
            href={subcategoryPath(category, sub)}
            aria-current={on ? "page" : undefined}
            className={cn(chip, on ? chipOn : chipOff)}
          >
            {sub.name}
            <span className="font-mono text-[11px] opacity-70">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
