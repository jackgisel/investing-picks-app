import { PUBLIC_API_BASE } from "@/lib/api-config";
import type { WorkforceHistory, WorkforceShape } from "@/lib/workforce";

/**
 * Public company data pages: one page per company we hold a stated headcount
 * for, plus a page per sector. Everything here comes from the API's
 * `/workforce/directory` (one row per company) and `/workforce/{ticker}` (the
 * year by year series); peers, ranks and sector medians are computed here
 * from the directory so the API keeps one cached payload.
 */

export type DirectoryCompany = {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  period: string;
  filing_date: string;
  employees: number;
  revenue: number;
  rev_per_employee: number | null;
  employees_yoy: number | null;
  revenue_yoy: number | null;
  shape: WorkforceShape | null;
  years: number;
  stale: boolean;
};

export type CompanyDirectory = {
  as_of: string;
  count: number;
  companies: DirectoryCompany[];
};

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,15}$/;

/** `brk.b` → `BRK.B`, or null for anything that is not a ticker. */
export function normalizeTicker(raw: string): string | null {
  const t = decodeURIComponent(raw).trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}

export function companyPath(ticker: string): string {
  return `/companies/${ticker.toLowerCase()}`;
}

/** `Consumer Cyclical` → `consumer-cyclical`. */
export function sectorSlug(sector: string): string {
  return sector
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sectorPath(sector: string): string {
  return `/companies/sector/${sectorSlug(sector)}`;
}

/** The display name, falling back to the ticker. */
export function displayName(c: { ticker: string; name: string | null }): string {
  return c.name?.trim() || c.ticker;
}

/**
 * The directory, or null when the API is down. Cached for an hour by Next's
 * fetch cache; the API holds its own copy for the same hour.
 */
export async function getCompanyDirectory(): Promise<CompanyDirectory | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/workforce/directory`, {
      next: { revalidate: 3600, tags: ["company-directory"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as CompanyDirectory;
    return Array.isArray(data?.companies) ? data : null;
  } catch {
    return null;
  }
}

/**
 * One company's year by year series, or null when we hold none (a 404).
 * Any other failure throws, so a cached page never records an outage as
 * "this company does not exist".
 */
export async function getCompanyHistory(
  ticker: string,
): Promise<WorkforceHistory | null> {
  const res = await fetch(
    `${PUBLIC_API_BASE}/workforce/${encodeURIComponent(ticker)}`,
    { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`workforce history returned ${res.status}`);
  const data = (await res.json()) as WorkforceHistory;
  return Array.isArray(data?.series) ? data : null;
}

export function median(values: number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export type PeerStats = {
  /** Same-industry companies, current one included, by revenue per employee. */
  ranked: DirectoryCompany[];
  /** 1-based rank of this company in `ranked`, or null when it has no ratio. */
  rank: number | null;
  median_rev_per_employee: number | null;
  median_employees: number | null;
  /** Where the comparison set came from: the industry, or the sector when the industry is too thin. */
  basis: "industry" | "sector" | null;
  label: string | null;
};

/** Fewer peers than this and the industry comparison widens to the sector. */
export const MIN_PEERS = 4;

/**
 * The comparison set for one company. Industry first, because revenue per
 * employee at a bank and at a software maker are different quantities; the
 * sector only when the industry has too few names to rank against.
 */
export function peerStats(
  companies: DirectoryCompany[],
  company: DirectoryCompany,
): PeerStats {
  const live = companies.filter((c) => !c.stale);
  let basis: PeerStats["basis"] = null;
  let label: string | null = null;
  let set: DirectoryCompany[] = [];
  if (company.industry) {
    set = live.filter((c) => c.industry === company.industry);
    basis = "industry";
    label = company.industry;
  }
  if (set.length < MIN_PEERS && company.sector) {
    set = live.filter((c) => c.sector === company.sector);
    basis = "sector";
    label = company.sector;
  }
  if (set.length < MIN_PEERS) {
    return {
      ranked: [],
      rank: null,
      median_rev_per_employee: null,
      median_employees: null,
      basis: null,
      label: null,
    };
  }
  if (!set.some((c) => c.ticker === company.ticker)) set = [...set, company];
  const ranked = [...set]
    .filter((c) => typeof c.rev_per_employee === "number")
    .sort((a, b) => (b.rev_per_employee ?? 0) - (a.rev_per_employee ?? 0));
  const idx = ranked.findIndex((c) => c.ticker === company.ticker);
  return {
    ranked,
    rank: idx >= 0 ? idx + 1 : null,
    median_rev_per_employee: median(
      ranked.map((c) => c.rev_per_employee ?? NaN),
    ),
    median_employees: median(set.map((c) => c.employees)),
    basis,
    label,
  };
}

/**
 * Up to `limit` peers to link to: the closest in size by revenue, so a
 * mid-cap's page points at mid-caps and not only at the industry giant.
 */
export function nearestPeers(
  stats: PeerStats,
  company: DirectoryCompany,
  limit = 8,
): DirectoryCompany[] {
  return stats.ranked
    .filter((c) => c.ticker !== company.ticker)
    .sort(
      (a, b) =>
        Math.abs(Math.log(a.revenue / company.revenue)) -
        Math.abs(Math.log(b.revenue / company.revenue)),
    )
    .slice(0, limit);
}

export type SectorSummary = {
  sector: string;
  slug: string;
  count: number;
  median_rev_per_employee: number | null;
  total_employees: number;
};

export function sectorSummaries(companies: DirectoryCompany[]): SectorSummary[] {
  const by = new Map<string, DirectoryCompany[]>();
  for (const c of companies) {
    if (!c.sector || c.stale) continue;
    by.set(c.sector, [...(by.get(c.sector) ?? []), c]);
  }
  return [...by.entries()]
    .map(([sector, list]) => ({
      sector,
      slug: sectorSlug(sector),
      count: list.length,
      median_rev_per_employee: median(list.map((c) => c.rev_per_employee ?? NaN)),
      total_employees: list.reduce((n, c) => n + c.employees, 0),
    }))
    .sort((a, b) => b.count - a.count);
}

export function sectorFromSlug(
  companies: DirectoryCompany[],
  slug: string,
): string | null {
  for (const c of companies) {
    if (c.sector && sectorSlug(c.sector) === slug) return c.sector;
  }
  return null;
}

/** Plain-English sentence for a growth shape, used in the page summary. */
export function shapeSentence(shape: WorkforceShape | null): string | null {
  switch (shape) {
    case "leaner":
      return "Revenue held up or grew while headcount stayed flat or fell.";
    case "efficient_growth":
      return "Revenue and headcount both grew, and revenue grew faster.";
    case "hiring_ahead":
      return "Headcount grew faster than revenue.";
    case "contracting":
      return "Revenue fell, and headcount fell or held flat with it.";
    case "hiring_into_decline":
      return "Revenue fell while headcount grew.";
    default:
      return null;
  }
}
