import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href: string };

/**
 * Visible trail plus the BreadcrumbList that lets Google show it in results.
 * The last crumb is the current page: rendered as text, still listed in the
 * schema with its URL.
 */
export function Breadcrumbs({
  items,
  className,
  includeJsonLd = true,
}: {
  items: Crumb[];
  className?: string;
  /** Set false when the page already emits BreadcrumbList in a combined graph. */
  includeJsonLd?: boolean;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `${SITE_URL}${item.href}`,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      {includeJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-dim">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1.5 min-w-0">
              {last ? (
                <span aria-current="page" className="truncate text-text-muted">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link
                    href={item.href}
                    className="truncate hover:text-text transition-colors"
                  >
                    {item.label}
                  </Link>
                  <ChevronRight size={12} aria-hidden className="shrink-0" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
