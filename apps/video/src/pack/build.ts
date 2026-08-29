/**
 * `buildPack`: the `pack` stage's one entry point. Assembles the source post
 * and the live portfolio facts, decides and applies redaction, and returns a
 * `Pack` — the single artifact everything downstream reads instead of the
 * API or the database (see DESIGN.md, "Why a pipeline of files").
 */

import { Pool } from "pg";
// Relative, not "@/..." — see the matching comment in sources.ts.
import { env } from "../lib/env.js";
import type { ChartFact, ChartRow, EpisodeKind, Pack, PackFacts, PeriodFact } from "../types.js";
import { applyRedaction, decideRedaction, redactSource } from "./redact.js";
import {
  fetchPeriodReturns,
  fetchEditorialBrief,
  fetchPerformance,
  fetchPicks,
  fetchStrategy,
  fetchTrades,
  loadApprovedPickTickers,
  loadFromFile,
  loadMarketNote,
  loadWeeklyReview,
  type ApiPerformance,
  type SourcePost,
} from "./sources.js";

export interface BuildPackOptions {
  kind: EpisodeKind;
  /** YYYY-MM-DD. Defaults to the source post's own date, then to today. */
  asOf?: string;
  /** e.g. "2026-w34". Selects a specific source post; also becomes half of `episodeId`. */
  weekKey?: string;
  /** Path to a markdown file to use instead of Postgres — see `loadFromFile`. */
  fromFile?: string;
}

function roundPct(n: number | null | undefined): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Ported verbatim from `apps/web/src/lib/weekly-summary.ts`. The series
 * carries since-inception returns, so the week's move is the difference
 * between two points on it, not the last point — see that file's comment for
 * why. This has to agree with what the site publishes, which is the whole
 * reason it is a port rather than a rewrite.
 */
export function weekChangePct(
  series: { date?: string; return_pct?: number | null }[],
): number | null {
  const points = series.filter(
    (p): p is { date: string; return_pct: number } =>
      typeof p.date === "string" && typeof p.return_pct === "number",
  );
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - 7);

  let prior: { date: string; return_pct: number } | null = null;
  for (const p of points) {
    if (new Date(p.date) <= cutoff) prior = p;
    else break;
  }
  if (!prior) return null;

  const a = 1 + prior.return_pct / 100;
  const b = 1 + latest.return_pct / 100;
  if (a <= 0) return null;
  return (b / a - 1) * 100;
}

/** Ported verbatim from `apps/web/src/lib/weekly-summary.ts` ("August 16–22, 2026"). */
export function periodLabel(weekEnd: Date): string {
  const start = new Date(weekEnd);
  start.setDate(start.getDate() - 6);
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
  const sameMonth = start.getUTCMonth() === weekEnd.getUTCMonth();
  if (sameMonth) {
    return `${month.format(weekEnd)} ${start.getUTCDate()}–${weekEnd.getUTCDate()}, ${weekEnd.getUTCFullYear()}`;
  }
  return `${month.format(start)} ${start.getUTCDate()}–${month.format(weekEnd)} ${weekEnd.getUTCDate()}, ${weekEnd.getUTCFullYear()}`;
}

const BENCHMARK_ORDER = ["SPY", "QQQ", "VTI", "MAGS"];

function orderBenchmarks(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = BENCHMARK_ORDER.indexOf(a);
    const ib = BENCHMARK_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function lastValue(points: { return_pct: number }[] | undefined): number | null {
  if (!points?.length) return null;
  const value = points[points.length - 1]?.return_pct;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Ported from `buildPicksComparison` in `apps/web/src/lib/hooks/use-chart.ts`.
 * Merged BY DATE, never by array index — a benchmark whose latest mark has
 * not landed yet is genuinely shorter than the picks series, and zipping by
 * position would shift every point by a day and misstate the comparison.
 * `/performance` already returns exactly the `{ picks_series, benchmarks }`
 * shape that function consumes, so the port is a straight copy.
 */
export function buildChart(performance: ApiPerformance): ChartFact {
  const picks = performance.picks_series ?? [];
  const rawSeries = performance.benchmarks?.series ?? {};
  const labels = performance.benchmarks?.labels ?? {};

  const keys = orderBenchmarks(Object.keys(rawSeries).filter((k) => (rawSeries[k]?.length ?? 0) > 0));

  const byDate = new Map<string, Map<string, number>>();
  const addPoint = (key: string, point: { date: string; return_pct: number }) => {
    if (!point?.date || typeof point.return_pct !== "number" || !Number.isFinite(point.return_pct)) return;
    let row = byDate.get(point.date);
    if (!row) {
      row = new Map<string, number>();
      byDate.set(point.date, row);
    }
    row.set(key, point.return_pct);
  };

  picks.forEach((p) => addPoint("picks", p));
  keys.forEach((key) => (rawSeries[key] ?? []).forEach((p) => addPoint(key, p)));

  const dates = [...byDate.keys()].sort();

  const rows: ChartRow[] = dates.map((date) => {
    const values = byDate.get(date)!;
    const row: ChartRow = { date, picks: values.has("picks") ? values.get("picks")! : null };
    keys.forEach((key) => {
      row[key] = values.has(key) ? values.get(key)! : null;
    });
    return row;
  });

  return {
    rows,
    benchmarks: keys.map((key) => ({
      key,
      label: labels[key] ?? key,
      latestPct: lastValue(rawSeries[key]),
    })),
    picksLatestPct: lastValue(picks),
    startDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
  };
}

interface RawHolding {
  ticker: string;
  name: string | null;
  sector: string | null;
  entryDate: string;
  pnlPct: number | null;
  quantRating: number | null;
  signal: string | null;
}

/**
 * Sector shares, in first-appearance order among the holdings (which are
 * themselves ordered by entry date) — this is what makes the `Sectors` slide
 * bars come out in the same order the `Holdings` slide's rows do.
 */
function computeSectors(holdings: RawHolding[]): PackFacts["sectors"] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? "Unknown";
    if (!counts.has(sector)) order.push(sector);
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }
  const total = holdings.length;
  return order.map((sector) => {
    const count = counts.get(sector)!;
    return {
      sector,
      count,
      sharePct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * ISO week key (Monday–Sunday, Thursday-anchored — same algorithm as
 * `isoWeekKey` in `apps/web/src/lib/email-dispatch.ts`), lower-cased to match
 * this package's `episodeId` convention (`weekly-review-2026-w34`, not
 * `...-2026-W34`).
 */
function isoWeekKeyLower(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

/**
 * The Date fed to the ported `periodLabel`. When the source post has a real
 * timestamp, pass it through as-is: `periodLabel` reads UTC date parts, so a
 * Friday-evening-Pacific timestamp naturally lands the label's end date on
 * the following UTC day, exactly like the site's own draft flow (which calls
 * `periodLabel(new Date())` at the moment of drafting). With no timestamp
 * (`--from-file`), anchor at UTC noon on `asOf` so the label can't roll to an
 * adjacent day by accident.
 */
function periodLabelAnchor(publishedAt: string | null, asOf: string): Date {
  return publishedAt ? new Date(publishedAt) : new Date(`${asOf}T12:00:00Z`);
}

function sourceUrl(kind: EpisodeKind, slug: string | null): string | null {
  const site = env.SITE_URL().replace(/\/$/, "");
  if (kind === "weekly-review") {
    return slug ? `${site}/dashboard/insights/${slug}` : null;
  }
  // Market notes are emailed, not published at a per-issue route — the site
  // only hosts the evergreen signup/sample page. See `loadMarketNote`.
  return `${site}/market-note`;
}

export async function buildPack(options: BuildPackOptions): Promise<Pack> {
  const pool = new Pool({ connectionString: env.WEB_DATABASE_URL() });
  try {
    const source: SourcePost | null = options.fromFile
      ? await loadFromFile(options.fromFile)
      : options.kind === "weekly-review"
        ? await loadWeeklyReview(pool, options.weekKey)
        : await loadMarketNote(pool, options.weekKey);

    if (!source) {
      const week = options.weekKey ? ` for week ${options.weekKey}` : "";
      throw new Error(
        options.kind === "weekly-review"
          ? `No approved weekly review found${week}. Publish one, or pass --from-file.`
          : `No sent market note found${week}, and none with a draft body to fall back to. ` +
            `The local database currently has zero market_note_issue rows — pass --from-file.`,
      );
    }

    const asOf = options.asOf ?? source.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const weekKey = options.weekKey ?? isoWeekKeyLower(asOf);
    const episodeId = `${options.kind}-${weekKey}`;
    const embargoDays = env.VIDEO_PICK_EMBARGO_DAYS();

    const [performance, strategy, picksRes, tradesRes, periodReturns, editorialBrief, approvedPickTickers] = await Promise.all([
      fetchPerformance(),
      fetchStrategy(),
      fetchPicks(),
      fetchTrades(),
      fetchPeriodReturns(),
      fetchEditorialBrief(),
      loadApprovedPickTickers(pool),
    ]);

    const pickByTicker = new Map(picksRes.picks.map((p) => [p.ticker.toUpperCase(), p]));

    const rawHoldings: RawHolding[] = strategy.holdings.map((h) => {
      const ticker = h.ticker.toUpperCase();
      const pick = pickByTicker.get(ticker);
      return {
        ticker,
        name: h.name ?? null,
        sector: h.sector ?? null,
        entryDate: h.entry_date,
        pnlPct: roundPct(h.pnl_pct),
        // Quant ratings are a 1–5 score, not a percentage — they carry three
        // decimal places on the site (4.435, not 4.44) and roundPct would
        // quietly change that precision.
        quantRating: typeof pick?.quant_rating === "number" ? pick.quant_rating : null,
        signal: pick?.signal ?? null,
      };
    });

    const weekStart = shiftDate(asOf, -6);
    const rawMoves: PackFacts["moves"] = (tradesRes.trades ?? [])
      .filter((t): t is { ticker: string; side: string; date: string } =>
        Boolean(t.ticker && t.side && t.date && t.date >= weekStart && t.date <= asOf),
      )
      .map((t) => ({ ticker: t.ticker.toUpperCase(), redacted: false, action: t.side, when: t.date }));

    const periods: PeriodFact[] = (periodReturns.periods ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      fromDate: p.from_date ?? null,
      bookReturnPct: roundPct(p.book_return_pct),
      spyReturnPct: roundPct(p.spy_return_pct),
      openPicksReturnPct: roundPct(p.open_picks_return_pct),
      openPicksPositions: p.open_picks_positions ?? null,
      openPicksExcludedNew: p.open_picks_excluded_new ?? null,
    }));

    const rawFacts: PackFacts = {
      summary: {
        picksReturnPct: roundPct(performance.summary.picks_return_pct),
        totalReturnPct: roundPct(performance.summary.total_return_pct),
        positionCount: performance.summary.position_count ?? rawHoldings.length,
        openCount: strategy.portfolio.picks?.open_count ?? null,
        closedCount: strategy.portfolio.picks?.closed_count ?? null,
        inceptionDate: performance.summary.inception_date ?? null,
        daysLive: performance.summary.days_live ?? null,
        // The claim this video makes is about the picks, not the whole
        // (mostly-cash) book — see DESIGN.md and `ChartPoint` in use-chart.ts
        // for why `annualized_*` (book equity) is the wrong field here.
        annualizedReturnPct: roundPct(performance.summary.picks_annualized_return_pct),
        annualizedStatus: performance.summary.picks_annualized_status ?? null,
      },
      week: {
        bookChangePct: roundPct(weekChangePct(performance.series)),
        spyChangePct: roundPct(
          weekChangePct(performance.series.map((p) => ({ date: p.date, return_pct: p.spy_return_pct }))),
        ),
      },
      periods,
      chart: buildChart(performance),
      holdings: rawHoldings.map((h) => ({ redacted: false, ...h })),
      sectors: computeSectors(rawHoldings),
      sectorBreadth: editorialBrief.sectors.map((sector) => ({
        sector: sector.sector,
        ratedCompanies: sector.rated_companies,
        qualifiedCompanies: sector.qualified_companies,
        qualifiedSharePct: sector.qualified_share_pct,
        highRatingChange: sector.high_rating_change,
      })),
      watchlistAsOf: editorialBrief.rating_as_of,
      watchlist: editorialBrief.watchlist.map((stock) => ({
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        marketCap: stock.market_cap,
        quantRating: stock.quant_rating,
        ratingChange: stock.rating_change,
        grades: stock.grades,
        fundamentals: stock.fundamentals
          ? {
              asOf: stock.fundamentals.as_of,
              revenueGrowthTtmPct: stock.fundamentals.revenue_growth_ttm_pct,
              epsGrowthTtmPct: stock.fundamentals.eps_growth_ttm_pct,
              revenueRevisionPct: stock.fundamentals.revenue_revision_pct,
              epsRevisionPct: stock.fundamentals.eps_revision_pct,
              earningsReportDate: stock.fundamentals.earnings_report_date,
            }
          : null,
      })),
      moves: rawMoves,
      nextEvaluationDate: strategy.next_evaluation_date ?? null,
    };

    const redaction = decideRedaction({
      holdings: rawHoldings.map((h) => ({ ticker: h.ticker, name: h.name, entryDate: h.entryDate })),
      pickNotes: approvedPickTickers,
      asOf,
      embargoDays,
    });
    const facts = applyRedaction(rawFacts, redaction);
    // The source post is the paywalled review — it names the new pick on
    // purpose for its subscribers. `bodyMd` (and the rest of this block) is
    // what the script-writing model reads verbatim, so it needs the same
    // strip `facts` just got, or the embargo never actually reaches the
    // model. See redact.ts's `redactProse` comment and DESIGN.md, "The
    // claims gate".
    const redactedSource = redactSource(source, redaction);

    return {
      schemaVersion: 1,
      episodeId,
      kind: options.kind,
      generatedAt: new Date().toISOString(),
      asOf,
      periodLabel: periodLabel(periodLabelAnchor(source.publishedAt, asOf)),
      source: {
        slug: redactedSource.slug,
        title: redactedSource.title,
        lede: redactedSource.lede,
        tldr: redactedSource.tldr,
        bodyMd: redactedSource.bodyMd,
        keyTakeaway: redactedSource.keyTakeaway,
        publishedAt: redactedSource.publishedAt,
        url: sourceUrl(options.kind, source.slug),
      },
      facts,
      redaction,
    };
  } finally {
    await pool.end();
  }
}
