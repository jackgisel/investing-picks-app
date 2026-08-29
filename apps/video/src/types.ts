/**
 * The shared contract between the five pipeline stages (`pack`, `script`,
 * `gate`, `voice`, `render`). Every stage reads a JSON file shaped like one of
 * these types and writes the next one — nothing here is inferred at render
 * time, because a render three weeks after the pack was written has to
 * produce the same video the pack described on the day, not whatever the
 * live portfolio looks like now.
 */

export type EpisodeKind = "market-note" | "weekly-review";

/** The five pastels the site's `.section-label` eyebrow rule draws from, one per chapter. */
export type AccentName = "mint" | "cyan" | "lilac" | "peach" | "yellow";

/**
 * The output of the `pack` stage: every fact and every source string the
 * episode is allowed to speak, plus the redaction decisions that were made
 * before anything reached the model. `script` and everything downstream only
 * ever sees this file — never the live API or database — so the pack is the
 * one place embargoed names have to be caught, and the one place a re-render
 * has to be reproducible from.
 */
export interface Pack {
  schemaVersion: 1;
  episodeId: string;
  kind: EpisodeKind;
  /** When this pack was built, distinct from `asOf` — the day the numbers describe. */
  generatedAt: string;
  asOf: string;
  periodLabel: string;
  source: {
    slug: string | null;
    title: string;
    lede: string | null;
    tldr: string[];
    bodyMd: string;
    keyTakeaway: string | null;
    publishedAt: string | null;
    url: string | null;
  };
  facts: PackFacts;
  redaction: Redaction;
}

/**
 * The embargo decisions `pack` made while assembling `facts`. Kept alongside
 * the facts rather than thrown away once redaction happens, because `gate`
 * has to re-scan the finished narration for exactly these names — the
 * redaction record is the thing the scan checks against.
 */
export interface Redaction {
  embargoDays: number;
  tickers: string[];
  names: string[];
  reasons: { ticker: string; reason: "recent_entry" | "note_unpublished"; entryDate: string | null }[];
}

/**
 * Every number the script is allowed to cite. `gate` traces each figure the
 * narration speaks back to a value reachable somewhere in here; a number that
 * doesn't trace fails the build rather than shipping unverified.
 */
export interface PackFacts {
  summary: {
    picksReturnPct: number | null;
    totalReturnPct: number | null;
    positionCount: number | null;
    openCount: number | null;
    closedCount: number | null;
    inceptionDate: string | null;
    daysLive: number | null;
    annualizedReturnPct: number | null;
    annualizedStatus: string | null;
  };
  week: { bookChangePct: number | null; spyChangePct: number | null };
  periods: PeriodFact[];
  chart: ChartFact;
  holdings: HoldingFact[];
  sectors: { sector: string; count: number; sharePct: number }[];
  sectorBreadth: {
    sector: string;
    ratedCompanies: number;
    qualifiedCompanies: number;
    qualifiedSharePct: number;
    highRatingChange: number | null;
  }[];
  watchlistAsOf: string | null;
  watchlist: {
    ticker: string;
    name: string | null;
    sector: string | null;
    marketCap: number | null;
    quantRating: number;
    ratingChange: number | null;
    grades: Record<string, string>;
    fundamentals: {
      asOf: string;
      revenueGrowthTtmPct: number | null;
      epsGrowthTtmPct: number | null;
      revenueRevisionPct: number | null;
      epsRevisionPct: number | null;
      earningsReportDate: string | null;
    } | null;
  }[];
  /** Position-level events for the `events` slide — entries and exits, with embargoed tickers already redacted. */
  moves: { ticker: string | null; redacted: boolean; action: string; when: string }[];
  nextEvaluationDate: string | null;
}

/** One row of the day / week / month comparison the `periodBars` slide draws. */
export interface PeriodFact {
  id: "day" | "week" | "month";
  label: string;
  fromDate: string | null;
  bookReturnPct: number | null;
  spyReturnPct: number | null;
  openPicksReturnPct: number | null;
  openPicksPositions: number | null;
  openPicksExcludedNew: number | null;
}

/**
 * One point on the picks-vs-benchmarks line chart. Indexed by ticker rather
 * than fixed fields so `ChartFact.benchmarks` can name whichever benchmarks
 * the API returned without this type changing — the same shape the site's
 * `use-chart` hook already produces.
 */
export interface ChartRow { date: string; picks: number | null; [ticker: string]: string | number | null }

export interface ChartFact {
  rows: ChartRow[];
  benchmarks: { key: string; label: string; latestPct: number | null }[];
  picksLatestPct: number | null;
  startDate: string | null;
  latestDate: string | null;
}

/**
 * One row of the open book. `redacted` is load-bearing: when true every other
 * field except `sector` and `entryDate`'s week-granularity cousin has already
 * been stripped by `pack`, and the `holdings` slide is responsible for
 * rendering it as "New position - held back" rather than trusting the nulls
 * to look right by accident.
 */
export interface HoldingFact {
  redacted: boolean;
  ticker: string | null;
  name: string | null;
  sector: string | null;
  entryDate: string | null;
  pnlPct: number | null;
  quantRating: number | null;
  signal: string | null;
}

/**
 * The output of the `script` stage: narration and slide bindings for every
 * scene, in reading order. Nothing in here is a rendered value — `render`
 * still resolves each slide's data against the pack — this is the words and
 * the choice of which slide type says them.
 */
export interface Script {
  schemaVersion: 1;
  episodeId: string;
  title: string;
  subtitle: string;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  /** Groups scenes under one eyebrow label and one accent colour, e.g. "the week" or "the book". */
  chapter: string;
  accent: AccentName;
  narration: string;
  slide: SlideSpec;
}

/**
 * The closed set of slide layouts a scene can bind to. A discriminated union
 * rather than one loose `props: Record<string, unknown>` bag so `gate` and
 * the Remotion composition can both exhaustively switch over `type` and the
 * compiler catches a slide kind neither of them handles yet.
 */
export type SlideSpec =
  | { type: "title"; title: string; subtitle: string; periodLabel: string }
  | { type: "stat"; heading: string; stats: StatItem[] }
  | { type: "picksChart"; heading: string; caption?: string }
  | { type: "periodBars"; heading: string; caption?: string }
  | { type: "holdings"; heading: string; caption?: string; limit?: number }
  | { type: "sectors"; heading: string; caption?: string }
  | { type: "watchlist"; heading: string; ticker?: string; caption?: string }
  | { type: "events"; heading: string; items: { label: string; detail: string }[] }
  | { type: "bullets"; heading: string; items: string[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "outro"; heading: string; lines: string[] };

export interface StatItem { label: string; value: string; sub?: string; tone?: "up" | "down" | "neutral" }

/**
 * The output of the `voice` stage: one ElevenLabs render per scene, keyed by
 * a content fingerprint so editing one line of narration only re-bills that
 * scene rather than the whole episode. `render` reads `durationSec` out of
 * each file via `ffprobe` rather than trusting this field, but keeps it here
 * too so a stage that only needs a rough duration doesn't have to shell out.
 */
export interface AudioManifest {
  schemaVersion: 1;
  episodeId: string;
  voiceId: string;
  model: string;
  scenes: { id: string; file: string; durationSec: number; fingerprint: string; chars: number }[];
  totalDurationSec: number;
}

/** Everything the Remotion composition needs, assembled by the render stage. */
export interface DeckProps {
  pack: Pack;
  script: Script;
  audio: AudioManifest;
}
