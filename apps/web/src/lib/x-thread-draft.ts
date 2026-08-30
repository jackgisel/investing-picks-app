import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { OPS_API_BASE, PUBLIC_API_BASE } from "@/lib/api-config";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  CONTENT_DATE_AND_VISUAL_RULES,
  formatQuantRating,
  QUANT_RATING_MAX,
  QUANT_RATING_MIN,
} from "@/lib/content-draft";
import { isoWeekKey } from "@/lib/email-dispatch";
import {
  countChars,
  DEFAULT_MAX_POST_CHARS,
  validateThread,
} from "@/lib/x-client";
import {
  fetchWeeklyReviewFacts,
  type WeeklyReviewFacts,
} from "@/lib/weekly-review-draft";

/**
 * Drafting long-form X threads from the same facts the weekly review runs on.
 *
 * Deliberately built on `fetchWeeklyReviewFacts` rather than its own fetcher.
 * The thread and the Friday note make claims about the same book in the same
 * week, and two independent assemblies of "how did we do" is how they end up
 * quoting different numbers in public on the same afternoon.
 *
 * Nothing here posts. The model writes a draft, an admin reads it, and only
 * then does the posting job get a claim.
 */

const MODEL = "claude-opus-5";

/**
 * Leave headroom under the real limit. The model is a poor character counter
 * and a draft that measures 279 locally is one stray emoji from being
 * rejected by the API mid-thread.
 */
export const DRAFT_TARGET_CHARS = 260;

/** How many posts a thread may run to. Long enough to argue, short enough to read. */
export const MIN_POSTS = 4;
export const MAX_POSTS = 12;

const ThreadSchema = z.object({
  posts: z
    .array(z.string().min(1).max(400))
    .min(MIN_POSTS)
    .max(MAX_POSTS),
  summary: z.string().min(20).max(500),
});

export type XThreadDraft = z.infer<typeof ThreadSchema>;

const SHARED_RULES = `You write X (Twitter) threads for ${SITE_NAME}, a subscription stock-research publication that runs a real, publicly tracked virtual book.

## The format
- A thread: an opening post, then replies that continue the argument. Each post stands on its own line of thought but reads in sequence.
- **Hard limit ${DRAFT_TARGET_CHARS} characters per post.** Count carefully. Going over means the post is rejected by the API and the thread breaks in public. Shorter is fine; padding to the limit is not.
- ${MIN_POSTS}–${MAX_POSTS} posts.
- The first post has to earn the second. State the actual claim — a number, a position, a change of mind — not a teaser. Never "a thread 🧵", never "let's talk about", never a numbered "1/" prefix.
- No hashtags. At most one emoji in the whole thread, and only if it genuinely marks structure.
- **No links in any post.** Links are priced differently by the API and the profile bio already carries the site. If you want to point at the full note, say where it lives in words.

## Hard rules on what you may say
- **Never a portfolio dollar figure.** No position size, no share count, no entry or exit price, no portfolio value, no dollar P&L. Our side of things is percentages only. Company financials in dollars (revenue, free cash flow, market cap) are fine when the payload has them — the ban is on OUR book, not on the businesses.
- Never state or imply an ${SITE_NAME} price target. Third-party analyst consensus may be cited as third-party context if it is in the payload.
- **Every number you cite must appear in the payload.** If you want a figure you were not given, write around it or say plainly that you do not have it. Do not estimate, interpolate, or reason your way to a number.
- The payload has a "missing" array naming facts that are NOT available. Those are genuinely unknown. Do not write as though you have them.
- **No cherry-picking.** If the thread cites the return of any individual holding, it must also state how the book as a whole did over a comparable period. Posting winners without the aggregate is the thing this rule exists to prevent.
- Where a position is down, or a grade is weak, or the week was bad, say so in the same voice you use for the good weeks.
- No urgency, no hype, no second-person exhortation ("you should buy", "don't miss", "load up"). The reader is deciding for themselves.
- Never promise or imply future performance.

${CONTENT_DATE_AND_VISUAL_RULES}

## Quant ratings
- Quant ratings run ${QUANT_RATING_MIN}–${QUANT_RATING_MAX}. Write one as \`X.X/${QUANT_RATING_MAX}\` (for example \`4.2/${QUANT_RATING_MAX}\`). The explainer link does not fit here, so do not link it — just keep the denominator.
- Do not invent a rating that is absent from the payload.

## Voice
Plain, specific, unhurried, and a little dry. Short sentences. Concrete nouns. You are a practitioner showing your work to other people who read filings, not a marketer. The measure of a good thread here is that someone who disagrees with the position still thinks it was argued honestly.

## Output
- \`posts\` is the ordered array of post bodies. Plain text only — no markdown, no numbering, no "1/n".
- \`summary\` is one line for the ops queue describing what this thread argues. It is never posted.`;

const WEEKLY_BRIEF = `## This thread
The week in the book. Open with what actually happened — the book's week against the S&P 500 — then the names that drove it in either direction, then what you are watching into the next evaluation. Most weeks the strategy holds and does nothing; that is a real answer and saying so plainly is better than manufacturing activity.`;

const MARKET_BRIEF = `## This thread
Market conditions and sectors, read through our own book.

Be careful about scope. You have our book's returns by period, our holdings and their sectors, and the S&P 500 over the same periods. You do NOT have broad-market sector indices, breadth, rates, or flows unless they appear in the payload — so write about what our positioning says and how it fared, not about sector rotation you cannot see. "Our industrials names carried the week while the book's tech weight lagged" is supportable. "Capital is rotating out of tech" is not, and must not appear.

Open with the market's shape as our numbers show it. Then sectors: where the book is concentrated, what that did this period, and what it means for what we own. Close on what would have to change for the positioning to change.`;

const PICK_BRIEF = `## This thread
One position, argued at length. What the business is, what the strategy saw in it, what its factor grades say, how it has done since entry, and — required — what would make this wrong. A pick thread with no disconfirming case is not publishable.

State how the book as a whole has done as well, so a reader is not being shown one name in isolation.`;

const SPOTLIGHT_BRIEF = `## This thread
A daily deep dive into ONE thing from the current screen: either a name it rates highly that we do NOT hold, or a sector reading from the same screen. The payload's \`spotlight.focus\` names which one today is — write that one, not the other, even if the other looks like a better story.

**This is never a pick, a buy, or a recommendation, and you must say so plainly, in your own words, near the top — not as a buried disclaimer.** It is a quantitative screen's output, nothing more: the screen can be wrong, a name here can fail another buy gate, run into a sector limit, or simply never enter the book.

If \`spotlight.focus\` is "candidate": use \`spotlight.candidate\`. What the business does, why the grades (valuation, growth, profitability, momentum, revisions) land where they do, and — required — what would have to be true for the screen's rating to be wrong about it. Do not write as though we hold it: no entry date, no P&L, because there is none.

If \`spotlight.focus\` is "sector": use \`spotlight.sector\`. How much of the sector clears the current screen, how that share has moved, and what would need to change before that showed up as an actual position in the book — not a prediction that it will.

**Never cite an individual holding's return next to this name or sector.** If you give any sense of scale from our own book, use its OVERALL return for the period, never a single position's — this thread is already at risk of reading like a stock tip, and naming one of our winners beside it makes that worse, not better.`;

const BRIEFS = {
  weekly_review: WEEKLY_BRIEF,
  market: MARKET_BRIEF,
  pick: PICK_BRIEF,
  spotlight: SPOTLIGHT_BRIEF,
} as const;

export type ThreadKind = keyof typeof BRIEFS;

type PeriodRow = {
  id?: string;
  label?: string;
  from_date?: string | null;
  book_return_pct?: number | null;
  spy_return_pct?: number | null;
  open_picks_return_pct?: number | null;
  open_picks_positions?: number | null;
  open_picks_excluded_new?: number | null;
};

export type SectorRollup = {
  sector: string;
  positions: number;
  /** Mean position P&L since entry, in percent. Equal-weighted, not by value. */
  mean_pnl_pct: number | null;
};

/** A screen-rated name we do not hold. Shape matches `/ops/editorial-brief`. */
export type SpotlightCandidate = {
  ticker: string;
  name: string | null;
  sector: string | null;
  market_cap: number | null;
  quant_rating: number;
  rating_change: number | null;
  grades: Record<string, string | null>;
  fundamentals: {
    revenue_growth_ttm_pct: number | null;
    revenue_revision_pct: number | null;
    earnings_report_date: string | null;
  } | null;
};

export type SpotlightSectorReading = {
  sector: string;
  rated_companies: number;
  qualified_companies: number;
  qualified_share_pct: number;
  high_rating_change: number | null;
};

type EditorialBrief = {
  rating_as_of: string | null;
  sectors: SpotlightSectorReading[];
  watchlist: SpotlightCandidate[];
};

export type SpotlightFocus = "candidate" | "sector";

export type XThreadFacts = WeeklyReviewFacts & {
  thread_kind: ThreadKind;
  periods: PeriodRow[];
  sectors: SectorRollup[];
  spotlight?: {
    rating_as_of: string | null;
    focus: SpotlightFocus | null;
    candidate: SpotlightCandidate | null;
    sector: SpotlightSectorReading | null;
    /** Full lists, in case the model needs surrounding context for the one it's writing about. */
    candidates: SpotlightCandidate[];
    sectors: SpotlightSectorReading[];
  };
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The same non-held watchlist the Monday market note and the video pipeline
 * already draw on (`market-note-brief.ts`, `apps/video`'s editorial brief
 * bridge). Fetched directly rather than through their helpers because both of
 * those return pre-formatted prose; the model here needs the raw fields.
 */
async function fetchEditorialBrief(): Promise<EditorialBrief | null> {
  const key = process.env.OPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${OPS_API_BASE}/editorial-brief`, {
      headers: { "X-Ops-Key": key },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as EditorialBrief;
  } catch {
    return null;
  }
}

/**
 * Which candidate or sector today's spotlight covers.
 *
 * Deterministic in the day, not random: a re-fired draft job must land on the
 * same subject it already wrote about, and `createThreadDraft`'s dedupe only
 * works if two calls on the same day agree. Candidate and sector focus
 * alternate day to day, and the index within whichever list advances every
 * other day so a short watchlist does not repeat on consecutive
 * candidate-days.
 */
export function pickSpotlightIndex(
  now: Date,
  candidateCount: number,
  sectorCount: number,
): { focus: SpotlightFocus; index: number } | null {
  if (candidateCount === 0 && sectorCount === 0) return null;
  const dayNumber = Math.floor(now.getTime() / 86_400_000);
  if (candidateCount === 0) return { focus: "sector", index: dayNumber % sectorCount };
  if (sectorCount === 0) return { focus: "candidate", index: dayNumber % candidateCount };
  const focus: SpotlightFocus = dayNumber % 2 === 0 ? "candidate" : "sector";
  const index =
    focus === "candidate"
      ? Math.floor(dayNumber / 2) % candidateCount
      : Math.floor(dayNumber / 2) % sectorCount;
  return { focus, index };
}

function round2(n: number | null | undefined): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Group the open book by sector.
 *
 * Equal-weighted mean of each holding's P&L, and named as such in the field.
 * A value-weighted number would be the better statistic but needs position
 * weights the payload deliberately does not carry off the public API in every
 * case; publishing an equal-weighted figure labelled honestly beats publishing
 * a value-weighted one assembled from a weight that might be missing.
 */
export function rollUpSectors(
  holdings: WeeklyReviewFacts["holdings"],
): SectorRollup[] {
  const buckets = new Map<string, number[]>();
  for (const h of holdings) {
    const sector = h.sector?.trim() || "Unclassified";
    const bucket = buckets.get(sector) ?? [];
    if (typeof h.pnl_pct === "number" && Number.isFinite(h.pnl_pct)) {
      bucket.push(h.pnl_pct);
    }
    buckets.set(sector, bucket);
  }

  return [...buckets.entries()]
    .map(([sector, pnls]) => ({
      sector,
      positions: holdings.filter(
        (h) => (h.sector?.trim() || "Unclassified") === sector,
      ).length,
      mean_pnl_pct: pnls.length
        ? round2(pnls.reduce((a, b) => a + b, 0) / pnls.length)
        : null,
    }))
    .sort((a, b) => b.positions - a.positions);
}

/** Assemble the payload. `missing` names every gap; it is never padded over. */
export async function fetchThreadFacts(
  kind: ThreadKind,
  now: Date = new Date(),
): Promise<XThreadFacts> {
  const base = await fetchWeeklyReviewFacts(now);
  const periodsBody = await getJson<{ periods?: PeriodRow[] }>(
    "/period-returns",
  );

  const missing = [...base.missing];
  if (!periodsBody?.periods?.length) missing.push("period_returns");
  // Named explicitly so the model cannot mistake our own sector rollup for a
  // read on the wider market. This gap is permanent until we ingest sector
  // indices, and the market thread's brief is written around it.
  missing.push("broad_market_sector_performance");
  // No news source is wired into any app yet. Named here, unconditionally,
  // so the spotlight brief cannot write as though it has a catalyst it does
  // not — the same discipline as the sector gap above.
  missing.push("news");

  let spotlight: XThreadFacts["spotlight"];
  if (kind === "spotlight") {
    const brief = await fetchEditorialBrief();
    if (!brief?.rating_as_of) {
      missing.push("screener_watchlist");
    } else {
      const pick = pickSpotlightIndex(now, brief.watchlist.length, brief.sectors.length);
      if (!pick) {
        missing.push("screener_watchlist");
      } else {
        spotlight = {
          rating_as_of: brief.rating_as_of,
          focus: pick.focus,
          candidate: pick.focus === "candidate" ? brief.watchlist[pick.index] : null,
          sector: pick.focus === "sector" ? brief.sectors[pick.index] : null,
          candidates: brief.watchlist,
          sectors: brief.sectors,
        };
      }
    }
  }

  return {
    ...base,
    missing,
    thread_kind: kind,
    periods: (periodsBody?.periods ?? []).map((p) => ({
      ...p,
      book_return_pct: round2(p.book_return_pct),
      spy_return_pct: round2(p.spy_return_pct),
      open_picks_return_pct: round2(p.open_picks_return_pct),
    })),
    sectors: rollUpSectors(base.holdings),
    spotlight,
  };
}

/** UTC calendar date, so a server in any timezone derives the same key. */
function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Stable dedupe key so a re-fired job finds the existing draft.
 *
 * The spotlight kind keys on the day rather than the week — it drafts daily,
 * and `pickSpotlightIndex` already guarantees a re-fired job on the same day
 * lands on the same subject, so no suffix is needed to keep same-day reruns
 * idempotent.
 */
export function threadDedupeKey(
  kind: ThreadKind,
  now: Date = new Date(),
  suffix?: string,
): string {
  const key = kind === "spotlight" ? dayKey(now) : isoWeekKey(now);
  return suffix ? `${key}:${suffix}` : key;
}

/**
 * Ask the model for a thread, then check the lengths ourselves.
 *
 * One retry, and only for over-length posts, with the offending posts named.
 * Models are unreliable character counters and a single corrective pass fixes
 * nearly all of it; looping further would burn tokens on a draft a human is
 * about to read and edit anyway.
 */
export async function generateThreadDraft(
  facts: XThreadFacts,
  opts: { maxChars?: number } = {},
): Promise<XThreadDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
  }
  const maxChars = opts.maxChars ?? DEFAULT_MAX_POST_CHARS;
  const client = new Anthropic({ apiKey });

  const system = `${SHARED_RULES}\n\n${BRIEFS[facts.thread_kind]}`;
  const missingNote =
    facts.missing.length > 0
      ? `\n\nNOT AVAILABLE: ${facts.missing.join(", ")}. Do not write as though you have these.`
      : "";
  const userText = `Write the ${facts.thread_kind.replace("_", " ")} thread for ${facts.period_label} (${facts.week_key}).${missingNote}\n\nFACTS:\n${JSON.stringify(facts, null, 2)}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userText },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(ThreadSchema),
      },
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error(
        `Model returned no parseable thread (stop_reason: ${response.stop_reason})`,
      );
    }

    const tooLong = validateThread(parsed.posts, maxChars);
    if (tooLong.length === 0) return parsed;

    if (attempt === 1) {
      throw new Error(
        `Model could not keep posts under ${maxChars} chars after a retry: ` +
          tooLong.map((e) => `post ${e.index + 1} = ${e.chars}`).join(", "),
      );
    }

    messages.push(
      { role: "assistant", content: JSON.stringify(parsed) },
      {
        role: "user",
        content:
          `These posts are over the ${maxChars}-character limit: ` +
          tooLong
            .map((e) => `post ${e.index + 1} (${e.chars} chars)`)
            .join(", ") +
          `. Rewrite the thread with every post at or under ${DRAFT_TARGET_CHARS} characters. ` +
          `Cut words rather than dropping the argument, and keep every figure you cited.`,
      },
    );
  }

  throw new Error("unreachable");
}

/** Per-post character counts for the ops editor. */
export function postLengths(posts: string[]): number[] {
  return posts.map(countChars);
}

export { SITE_URL };
