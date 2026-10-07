/**
 * Ranking for the site search palette. Pure, so the order is testable without
 * the API or the article modules.
 */

export type SearchKind = "company" | "article" | "topic" | "tool" | "page";

export type SearchResult = {
  kind: SearchKind;
  title: string;
  href: string;
  /** Second line: company name, article category, tool blurb. */
  detail: string | null;
  /** Ticker, for company rows. */
  ticker?: string;
};

export type SearchCorpus = {
  companies: { ticker: string; name: string | null; sector: string | null }[];
  documents: { kind: Exclude<SearchKind, "company">; title: string; href: string; detail: string | null; keywords?: string[] }[];
};

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

/**
 * 0 is no match. Higher is better. An exact ticker beats everything, because
 * someone typing "META" wants Meta, not an article that mentions meta-analysis.
 */
export function companyScore(
  q: string,
  c: { ticker: string; name: string | null },
): number {
  const t = c.ticker.toLowerCase();
  const n = (c.name ?? "").toLowerCase();
  if (t === q) return 100;
  if (n === q) return 90;
  if (t.startsWith(q)) return 70 - Math.min(t.length - q.length, 10);
  if (n.startsWith(q)) return 60;
  if (q.length >= 3 && n.split(/[\s,.&-]+/).some((w) => w.startsWith(q))) return 45;
  if (q.length >= 3 && n.includes(q)) return 30;
  return 0;
}

export function documentScore(
  q: string,
  d: { title: string; keywords?: string[] },
): number {
  if (q.length < 2) return 0;
  const title = d.title.toLowerCase();
  if (title === q) return 80;
  if (title.startsWith(q)) return 55;
  const words = q.split(" ").filter((w) => w.length >= 2);
  if (words.length === 0) return 0;
  const hay = `${title} ${(d.keywords ?? []).join(" ").toLowerCase()}`;
  const hits = words.filter((w) => hay.includes(w)).length;
  if (hits === words.length) return 40 + Math.min(words.length, 5);
  if (hits >= Math.ceil(words.length * 0.6)) return 20 + hits;
  return 0;
}

export function searchSite(
  rawQuery: string,
  corpus: SearchCorpus,
  limit = 12,
): SearchResult[] {
  const q = normalizeQuery(rawQuery);
  if (!q) return [];

  const companies = corpus.companies
    .map((c) => ({ c, s: companyScore(q, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.ticker.localeCompare(b.c.ticker))
    .slice(0, 6)
    .map(({ c, s }) => ({
      s,
      r: {
        kind: "company" as const,
        title: c.name?.trim() || c.ticker,
        href: `/companies/${c.ticker.toLowerCase()}`,
        detail: c.sector,
        ticker: c.ticker,
      },
    }));

  const docs = corpus.documents
    .map((d) => ({ d, s: documentScore(q, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d.title.localeCompare(b.d.title))
    .slice(0, 8)
    .map(({ d, s }) => ({
      s,
      r: { kind: d.kind, title: d.title, href: d.href, detail: d.detail },
    }));

  return [...companies, ...docs]
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}
