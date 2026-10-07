import { NextResponse } from "next/server";
import { articles } from "@/lib/blog";
import {
  BLOG_CATEGORIES,
  categoryPath,
  getCategoryByName,
  getSubcategory,
  subcategoryPath,
} from "@/lib/blog-taxonomy";
import { getCompanyDirectory } from "@/lib/companies";
import { hasPublishedSampleResearch } from "@/lib/public-samples";
import { NAV_SECTIONS, ALL_TOOL_LINKS, SAMPLE_RESEARCH_HREF } from "@/lib/site-nav";
import { searchSite, type SearchCorpus } from "@/lib/site-search";

/** Public site search for the nav palette and the company finder. */

const DOCUMENTS: SearchCorpus["documents"] = [
  ...articles.map((a) => ({
    kind: "article" as const,
    title: a.meta.title,
    href: `/blog/${a.meta.slug}`,
    detail:
      getSubcategory(getCategoryByName(a.meta.category), a.meta.subcategory)?.name ??
      a.meta.category,
    keywords: [a.meta.keyword, ...a.meta.keywords, ...a.meta.tags],
  })),
  ...BLOG_CATEGORIES.flatMap((c) => [
    { kind: "topic" as const, title: c.title, href: categoryPath(c), detail: "Blog topic" },
    ...c.subcategories.map((s) => ({
      kind: "topic" as const,
      title: s.name,
      href: subcategoryPath(c, s),
      detail: c.title,
      keywords: [s.description],
    })),
  ]),
  ...ALL_TOOL_LINKS.map((t) => ({
    kind: "tool" as const,
    title: t.label,
    href: t.href,
    detail: t.blurb ?? null,
  })),
  ...NAV_SECTIONS.filter((s) => s.id !== "tools").flatMap((s) =>
    s.groups.flatMap((g) =>
      g.links
        .filter((l) => !l.href.startsWith("/blog"))
        .map((l) => ({ kind: "page" as const, title: l.label, href: l.href, detail: l.blurb ?? null })),
    ),
  ),
];

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0 || q.length > 80) {
    return NextResponse.json({ results: [] });
  }
  const [directory, hasSampleResearch] = await Promise.all([
    getCompanyDirectory(),
    hasPublishedSampleResearch(),
  ]);
  const documents = hasSampleResearch
    ? DOCUMENTS
    : DOCUMENTS.filter((d) => d.href !== SAMPLE_RESEARCH_HREF);
  const results = searchSite(q, {
    companies: directory?.companies ?? [],
    documents,
  });
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
