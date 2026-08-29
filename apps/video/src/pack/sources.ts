/**
 * Read-only data access for the `pack` stage.
 *
 * Two upstreams, and nothing downstream of `pack` ever talks to either
 * directly: the live Outpick API (`OUTPICK_API_URL`) for portfolio facts, and
 * the web app's Postgres (`WEB_DATABASE_URL`) for the source post and the
 * embargo lookup. Once `pack.json` is written the rest of the pipeline has no
 * dependency on either being reachable — see DESIGN.md, "Why a pipeline of
 * files."
 */

import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
// Relative, not "@/lib/env" — `tsx` (this package's CLI runtime) resolves the
// tsconfig "@/*" alias on its own, but Vitest does not without a dedicated
// vite/vitest config, which is out of this chunk's file scope (root-level
// `apps/video/`). Relative imports work identically under both runners.
import { env } from "../lib/env.js";

async function fetchApi<T>(path: string): Promise<T> {
  const base = env.OUTPICK_API_URL().replace(/\/$/, "");
  const url = `${base}/api/v1${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} responded ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function fetchOps<T>(path: string): Promise<T> {
  const base = env.OUTPICK_API_URL().replace(/\/$/, "");
  const url = `${base}/api/ops${path}`;
  const res = await fetch(url, { headers: { "X-Ops-Key": env.OPS_API_KEY() } });
  if (!res.ok) throw new Error(`GET ${url} responded ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// ---- API response shapes (only the fields `build.ts` actually reads) ----

export interface ApiReturnPoint {
  date: string;
  return_pct: number;
}

export interface ApiPerformance {
  series: { date: string; return_pct: number; spy_return_pct: number | null }[];
  picks_series?: ApiReturnPoint[];
  benchmarks?: {
    labels: Record<string, string>;
    series: Record<string, ApiReturnPoint[]>;
  };
  summary: {
    inception_date?: string | null;
    total_return_pct?: number | null;
    position_count?: number | null;
    days_live?: number | null;
    picks_return_pct?: number | null;
    picks_annualized_return_pct?: number | null;
    picks_annualized_status?: string | null;
  };
}

export interface ApiHolding {
  ticker: string;
  entry_date: string;
  pnl_pct: number | null;
  sector: string | null;
  name: string | null;
}

export interface ApiStrategy {
  portfolio: {
    picks?: { open_count?: number | null; closed_count?: number | null };
  };
  holdings: ApiHolding[];
  next_evaluation_date: string | null;
}

export interface ApiPick {
  ticker: string;
  status: string;
  quant_rating: number | null;
  signal: string | null;
}

export interface ApiTrade {
  ticker: string | null;
  side: string | null;
  date: string | null;
}

export interface ApiPeriod {
  id: "day" | "week" | "month";
  label: string;
  from_date: string | null;
  book_return_pct: number | null;
  spy_return_pct: number | null;
  open_picks_return_pct: number | null;
  open_picks_positions: number | null;
  open_picks_excluded_new: number | null;
}

export interface EditorialBrief {
  rating_as_of: string | null;
  sectors: {
    sector: string;
    rated_companies: number;
    qualified_companies: number;
    qualified_share_pct: number;
    high_rating_change: number | null;
  }[];
  watchlist: {
    ticker: string;
    name: string | null;
    sector: string | null;
    quant_rating: number;
    rating_change: number | null;
  }[];
}

export function fetchPerformance(): Promise<ApiPerformance> {
  return fetchApi<ApiPerformance>("/performance");
}

export function fetchStrategy(): Promise<ApiStrategy> {
  return fetchApi<ApiStrategy>("/strategy");
}

export function fetchPicks(): Promise<{ picks: ApiPick[] }> {
  return fetchApi<{ picks: ApiPick[] }>("/picks?status=all");
}

export function fetchTrades(): Promise<{ trades: ApiTrade[] }> {
  return fetchApi<{ trades: ApiTrade[] }>("/trades?limit=100");
}

export function fetchPeriodReturns(): Promise<{ as_of: string; periods: ApiPeriod[] }> {
  return fetchApi<{ as_of: string; periods: ApiPeriod[] }>("/period-returns");
}

export function fetchEditorialBrief(): Promise<EditorialBrief> {
  return fetchOps<EditorialBrief>("/editorial-brief");
}

// ---- Postgres sources ----

/** Common shape every source loader normalizes to — `Pack.source` minus the URL, which `build.ts` derives per kind. */
export interface SourcePost {
  slug: string | null;
  title: string;
  lede: string | null;
  tldr: string[];
  bodyMd: string;
  keyTakeaway: string | null;
  /** ISO 8601 with the original UTC offset preserved (see the `to_char` note below), or null. */
  publishedAt: string | null;
}

// `published_at`/`sent_at` are TIMESTAMPTZ. node-postgres's default type
// parser turns those into JS `Date` objects, and `Date#toISOString()` always
// normalizes to `Z` — which throws away the Pacific offset the site displays
// and that a byte-for-byte pack re-run needs to reproduce. Asking Postgres to
// format the timestamp itself (in the connection's session timezone) sidesteps
// the round trip entirely and is the only way to get "-07:00" back out.
const TIMESTAMPTZ_ISO = `to_char($COL, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM')`;

interface WeeklyReviewRow {
  slug: string;
  title: string | null;
  lede: string | null;
  tldr: string[] | null;
  body_md: string | null;
  key_takeaway: string | null;
  published_at: string | null;
}

/**
 * The newest `approved` weekly review, or a specific one when `weekKey` is
 * given (its slug is always `weekly-review-<weekKey>` — see `build.ts`).
 * Returns null rather than throwing so the CLI can print a clear "nothing to
 * build" message instead of a raw SQL-shaped error.
 */
export async function loadWeeklyReview(pool: Pool, weekKey?: string): Promise<SourcePost | null> {
  const slug = weekKey ? `weekly-review-${weekKey}` : null;
  const sql = `
    SELECT slug, title, lede, tldr, body_md, key_takeaway,
           ${TIMESTAMPTZ_ISO.replace("$COL", "published_at")} AS published_at
      FROM insight
     WHERE post_type = 'weekly_review'
       AND status = 'approved'
       ${slug ? "AND slug = $1" : ""}
     ORDER BY published_at DESC NULLS LAST
     LIMIT 1`;
  const { rows } = await pool.query<WeeklyReviewRow>(sql, slug ? [slug] : []);
  const row = rows[0];
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title ?? "",
    lede: row.lede,
    tldr: row.tldr ?? [],
    bodyMd: row.body_md ?? "",
    keyTakeaway: row.key_takeaway,
    publishedAt: row.published_at,
  };
}

interface MarketNoteRow {
  week_key: string;
  subject: string;
  lede: string | null;
  body_md: string | null;
  sent_at: string | null;
}

/**
 * The newest SENT market note issue, or a specific week's issue when
 * `weekKey` is given. Falls back to the newest issue with a non-empty
 * `body_md` when nothing has `sent_at` set.
 *
 * That fallback matters on this machine specifically: `outpick_web_dev` is
 * seeded from a prod clone whose table allowlist copies `insight` but not
 * `market_note_issue`, so the local database has ZERO rows here today. A
 * market-note episode cannot be built from Postgres at all until that
 * changes — `--from-file` (see `loadFromFile` below) is the only way to
 * exercise this episode kind locally right now.
 */
export async function loadMarketNote(pool: Pool, weekKey?: string): Promise<SourcePost | null> {
  const sentSql = `
    SELECT week_key, subject, lede, body_md,
           ${TIMESTAMPTZ_ISO.replace("$COL", "sent_at")} AS sent_at
      FROM market_note_issue
     WHERE sent_at IS NOT NULL
       ${weekKey ? "AND week_key = $1" : ""}
     ORDER BY sent_at DESC
     LIMIT 1`;
  const sent = await pool.query<MarketNoteRow>(sentSql, weekKey ? [weekKey] : []);
  const row =
    sent.rows[0] ??
    (
      await pool.query<MarketNoteRow>(
        `
    SELECT week_key, subject, lede, body_md,
           ${TIMESTAMPTZ_ISO.replace("$COL", "sent_at")} AS sent_at
      FROM market_note_issue
     WHERE body_md IS NOT NULL AND btrim(body_md) <> ''
       ${weekKey ? "AND week_key = $1" : ""}
     ORDER BY created_at DESC
     LIMIT 1`,
        weekKey ? [weekKey] : [],
      )
    ).rows[0];
  if (!row) return null;
  return {
    // No per-issue route exists on the site (market notes are emailed, not
    // published at a slug — see `sourceUrl` in build.ts), so there is no
    // meaningful slug to carry here.
    slug: null,
    title: row.subject,
    lede: row.lede,
    tldr: [],
    bodyMd: row.body_md ?? "",
    keyTakeaway: null,
    publishedAt: row.sent_at,
  };
}

/**
 * Fallback source: a markdown file with optional YAML-ish front matter
 * (`title:`, `lede:`, `slug:` — one `key: value` pair per line, plain
 * strings only). Everything after the closing `---` is `bodyMd` verbatim.
 * `tldr` and `keyTakeaway` have no front-matter equivalent and come back
 * empty/null; `publishedAt` comes back null too, so `build.ts` falls back to
 * today's date for `asOf`.
 */
export async function loadFromFile(path: string): Promise<SourcePost> {
  const raw = await readFile(path, "utf8");
  let front: Record<string, string> = {};
  let body = raw;

  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const block = raw.slice(3, end);
      body = raw.slice(end + 4);
      front = Object.fromEntries(
        block
          .split("\n")
          .map((line) => line.match(/^([A-Za-z0-9_]+):\s*(.*)$/))
          .filter((m): m is RegExpMatchArray => m !== null)
          .map((m) => [m[1].toLowerCase(), m[2].trim().replace(/^["']|["']$/g, "")]),
      );
    }
  }

  return {
    slug: front.slug ?? null,
    title: front.title ?? "",
    lede: front.lede ?? null,
    tldr: [],
    bodyMd: body.replace(/^\s*\n/, "").trim(),
    keyTakeaway: null,
    publishedAt: null,
  };
}

/**
 * Tickers with an `approved` pick note, upper-cased. This is the other half
 * of the embargo rule (`redact.ts`'s `note_unpublished` reason) — a position
 * can be outside the recency window and still unnamed if nobody has approved
 * its writeup yet.
 */
export async function loadApprovedPickTickers(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ ticker: string }>(
    `SELECT ticker FROM insight WHERE post_type = 'pick' AND status = 'approved' AND ticker IS NOT NULL`,
  );
  return new Set(rows.map((r) => r.ticker.toUpperCase()));
}
