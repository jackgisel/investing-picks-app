/**
 * Beat the S&P 500 challenge: the rules and the arithmetic, with no I/O.
 *
 * An entry is 15 to 30 stocks, equally weighted, bought at the first close
 * after it is submitted and held untouched for ten years. It is scored against
 * SPY bought at the same close. Nothing is rebalanced, so a winner grows into a
 * larger share of the portfolio exactly as it would in a real account.
 */

export const MIN_PICKS = 15;
export const MAX_PICKS = 30;
export const HOLD_YEARS = 10;
/** Smaller companies are left out so a thinly traded stock cannot swing the board. */
export const MIN_MARKET_CAP = 300_000_000;
export const BENCHMARK = "SPY";
export const CHALLENGE_PATH = "/tools/beat-the-sp-500";
export const ENTER_PATH = `${CHALLENGE_PATH}/enter`;

export function entryPath(id: string): string {
  return `${CHALLENGE_PATH}/entry/${id}`;
}

const NY = "America/New_York";

/** The New York calendar date of an instant, as YYYY-MM-DD. */
export function nyDate(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** `2026-Q4` for any date in October to December 2026. */
export function cohortFor(isoDate: string): string {
  const year = isoDate.slice(0, 4);
  const month = Number(isoDate.slice(5, 7));
  return `${year}-Q${Math.ceil(month / 3)}`;
}

/** `2026-Q4` → `Q4 2026`. */
export function cohortLabel(cohort: string): string {
  const [year, q] = cohort.split("-");
  return q && year ? `${q} ${year}` : cohort;
}

export function isCohort(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-Q[1-4]$/.test(value);
}

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,15}$/;

export function normalizeTickers(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") return null;
    const v = t.trim().toUpperCase();
    if (!TICKER_RE.test(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Collapse spaces and trim; letters, digits, spaces and . _ ' - only. */
export function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s+/g, " ").trim();
  if (v.length < 2 || v.length > 30) return null;
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(v)) return null;
  // A name that is only punctuation reads as blank on the board.
  if (!/[\p{L}\p{N}]/u.test(v)) return null;
  return v;
}

export type EntryProblem =
  | { code: "too_few"; message: string }
  | { code: "too_many"; message: string }
  | { code: "bad_ticker"; message: string }
  | { code: "ineligible"; message: string; tickers: string[] }
  | { code: "bad_name"; message: string };

/**
 * Everything wrong with a submission, given which of its tickers are in the
 * eligible universe. An empty list means it can be saved.
 */
export function entryProblems(input: {
  tickers: string[] | null;
  displayName: string | null;
  eligible: ReadonlySet<string>;
}): EntryProblem[] {
  const problems: EntryProblem[] = [];
  if (input.displayName === null) {
    problems.push({
      code: "bad_name",
      message: "Pick a name for the leaderboard: 2 to 30 letters, numbers or spaces.",
    });
  }
  if (input.tickers === null) {
    problems.push({ code: "bad_ticker", message: "One of those tickers is not valid." });
    return problems;
  }
  if (input.tickers.length < MIN_PICKS) {
    problems.push({
      code: "too_few",
      message: `Pick at least ${MIN_PICKS} stocks. You have ${input.tickers.length}.`,
    });
  }
  if (input.tickers.length > MAX_PICKS) {
    problems.push({
      code: "too_many",
      message: `Pick at most ${MAX_PICKS} stocks. You have ${input.tickers.length}.`,
    });
  }
  const ineligible = input.tickers.filter((t) => !input.eligible.has(t));
  if (ineligible.length > 0) {
    problems.push({
      code: "ineligible",
      message: `${ineligible.join(", ")} ${ineligible.length > 1 ? "are" : "is"} not in the challenge universe. Only US listed operating companies above $300M in market value count.`,
      tickers: ineligible,
    });
  }
  return problems;
}

export type PickMark = {
  ticker: string;
  /** Close on the entry's first session, or null if the stock has no price yet. */
  start: number | null;
  /** Latest close on or before the as-of date. */
  last: number | null;
};

/**
 * A pick's growth factor since the start: 1.10 is +10%. A pick with no price
 * on record counts as flat, never as a gain, so a data gap cannot help an
 * entry up the board.
 */
export function pickGrowth(p: PickMark): number {
  if (!p.start || !p.last || p.start <= 0 || p.last <= 0) return 1;
  return p.last / p.start;
}

/** Equal weight at the start, no rebalancing: the mean of the growth factors, minus one. */
export function portfolioReturn(picks: PickMark[]): number | null {
  if (picks.length === 0) return null;
  return picks.reduce((sum, p) => sum + pickGrowth(p), 0) / picks.length - 1;
}

/** A pick's share of the entry's total return, in return points. */
export function pickContribution(p: PickMark, count: number): number {
  return count > 0 ? (pickGrowth(p) - 1) / count : 0;
}

/**
 * Compound annual rate. Below a year this would turn a lucky month into a
 * headline number, so it is null until the entry is a year old.
 */
export function annualized(totalReturn: number | null, days: number): number | null {
  if (totalReturn === null || days < 365) return null;
  return Math.pow(1 + totalReturn, 365 / days) - 1;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86_400_000,
  );
}

/** `+12.3%` / `-4.0%` / dash. */
export function formatPct(v: number | null | undefined, digits = 1): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

/** Return points against the benchmark: `+3.1 pts`. */
export function formatPts(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const pts = v * 100;
  return `${pts >= 0 ? "+" : ""}${pts.toFixed(1)} pts`;
}

/** Ten years after the start date, for "ends on". */
export function endDate(startIso: string): string {
  const year = Number(startIso.slice(0, 4)) + HOLD_YEARS;
  return `${year}${startIso.slice(4)}`;
}
