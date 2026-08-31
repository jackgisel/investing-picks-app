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
  containsUrl,
  countChars,
  DEFAULT_MAX_POST_CHARS,
  validateThread,
} from "@/lib/x-client";
import {
  fetchWeeklyReviewFacts,
  type WeeklyReviewFacts,
} from "@/lib/weekly-review-draft";
import { periodLabel } from "@/lib/weekly-summary";

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

/**
 * The widest post-count window across every kind.
 *
 * The window that actually constrains a draft is per-kind — see `POST_BOUNDS`.
 * A single-post hot take and a twelve-post weekly review are the same table
 * and the same posting path, so the type stays one shape and the bound is
 * applied when the schema is built.
 */
export const MIN_POSTS = 2;
export const MAX_POSTS = 13;

const ThreadSchema = z.object({
  posts: z.array(z.string().min(1).max(400)).min(MIN_POSTS).max(MAX_POSTS),
  summary: z.string().min(20).max(500),
});

export type XThreadDraft = z.infer<typeof ThreadSchema>;

const SHARED_RULES = `You write X (Twitter) threads for ${SITE_NAME}, a subscription stock-research publication that runs a real, publicly tracked virtual book.

## The format
- A thread: a hook, then a build of standalone value posts, then the payoff, then one closing CTA post. Every post before the CTA should work alone — worth a like, or worth screenshotting out of the thread — while still reading in sequence.
- **Hard limit ${DRAFT_TARGET_CHARS} characters per post.** Count carefully. Going over means the post is rejected by the API and the thread breaks in public. Shorter is fine; padding to the limit is not.
- **Post 1 is the whole ballgame.** Most of the people who see this thread read post 1 and nothing else, so it has to be the best line you have — not the setup for it. Lead with the number or the claim that makes someone stop: "our worst position this month is up 11%" earns a read; "here's how our week went" does not. Put the surprising word early, and if the post still reads fine starting at word nine, start at word nine.
- **The hook may be blunt, contrarian, or self-critical.** "We held this through a 22% drawdown and we were wrong the whole way down" is a good post 1. So is a number nobody expects. What it may never be is an overclaim — a hook is a real finding stated sharply, never a real finding stretched until it is interesting.
- A curiosity gap is fine — open on the tension, let post 2 resolve it — as long as post 2 actually resolves it. A teaser that withholds the claim entirely is not a hook, it is a wasted post.
- Never a templated opener: no "a thread 🧵", no "let's talk about", no "1/" prefix, no "buckle up".
- **One idea per middle post.** A single point, stated with the number or name that makes it concrete — not a bucket of three things loosely related. If a post needs "and also," split it.
- **Use line breaks inside a post.** One thought per line. A four-line post with breaks gets read; the same words as one paragraph get scrolled past. It is the cheapest formatting win available and it costs nothing against the character limit.
- **The post before the CTA is the payoff**, and it should be the single most quotable line in the thread — the one someone screenshots without the rest. The CTA post then closes it out (see "The closing post" below).
- Inviting a reply or a quote is welcome: a genuine question, "quote this if you'd argue it differently." Inviting a *trade* is not, ever — never ask anyone to buy, sell, follow a position, or act on anything. That line holds no matter how much reach is on the table.
- No hashtags — they read as 2015 and do nothing for reach. Emoji sparingly: at most two in the whole thread, and only where one genuinely marks structure or direction. Never a row of them, never one per line.
- **No links anywhere except the final CTA post.** See "The closing post" below for the one URL that belongs there. A link in the body costs 13× as much to post and gives the ranking model a reason to stop showing the thread.
- **No markdown tables, and no \`|\` or \`-\`-ruled layout of any kind**, even when the payload itself is tabular (a sector breakdown, a list of grades). X renders none of it — a pipe table posts as literal pipes and dashes. Say the same numbers as sentences: "Financial Services led at six positions and a 35% mean gain; Industrials lagged at -12%."

## Hard rules on what you may say
- **Never a portfolio dollar figure.** No position size, no share count, no entry or exit price, no portfolio value, no dollar P&L. Our side of things is percentages only. Company financials in dollars (revenue, free cash flow, market cap) are fine when the payload has them — the ban is on OUR book, not on the businesses.
- Never state or imply an ${SITE_NAME} price target. Third-party analyst consensus may be cited as third-party context if it is in the payload.
- **Every number you cite must appear in the payload.** If you want a figure you were not given, write around it or say plainly that you do not have it. Do not estimate, interpolate, or reason your way to a number.
- The payload has a "missing" array naming facts that are NOT available. Those are genuinely unknown. Do not write as though you have them.
- **No cherry-picking.** If the thread cites the return of any individual holding, it must also state how the book as a whole did over a comparable period. Posting winners without the aggregate is the thing this rule exists to prevent.
- Where a position is down, or a grade is weak, or the week was bad, say so in the same voice you use for the good weeks.
- No urgency, no hype, no second-person exhortation about the position or the trade ("you should buy", "don't miss", "load up"). The reader is deciding for themselves. This is distinct from the closing engagement line above — inviting a reply or a quote is fine; inviting a trade is not, ever.
- Never promise or imply future performance.

${CONTENT_DATE_AND_VISUAL_RULES}

The "Visuals" paragraph just above is shared with the blog, the email and the
video pipeline, where a markdown table is the right call. On X it is not, and
X is what you are writing: its table advice does not apply here, and the
no-table rule in "The format" wins. A ranked list is one item per LINE BREAK,
never a table.

## Quant ratings
- Quant ratings run ${QUANT_RATING_MIN}–${QUANT_RATING_MAX}. Write one as \`X.X/${QUANT_RATING_MAX}\` (for example \`4.2/${QUANT_RATING_MAX}\`). The explainer link does not fit here, so do not link it — just keep the denominator.
- Do not invent a rating that is absent from the payload.

## Voice
You are posting to win the scroll. This is not a corporate account and it must not read like one — it is one person with a real, publicly tracked book, posting like they actually want to be read. Write the way you would to a friend who also reads filings and is three drinks in.

- **Open on the number, not the run-up.** Cut every clause before the interesting part. "Interestingly, when we look at the data, financials led" becomes "Financials led."
- **Fragments are fine.** Sentence length should vary hard: a nine-word sentence, then a three-word one. Uniform medium-length sentences are the single clearest tell of writing nobody wants to read.
- **Have an opinion out loud.** "Nobody is pricing this" and "we were wrong about this for six months" both belong here. "It is worth noting that" does not.
- **One qualifier per claim, maximum.** "May potentially suggest" is three stacked hedges and it kills the line. Pick the honest one and drop the others.
- **Concrete nouns, real names, real numbers.** A specific ticker beats "a position." A percentage beats "meaningfully."
- Contractions, yes. Exclamation marks, no.
- Banned wherever they appear: "Let's talk about", "Here's the thing", "The reality is", "Make no mistake", "It's worth noting", "In today's market", "the bottom line", "buckle up". Also banned: the "X isn't Y — it's Z" construction, and any sentence whose only job is to announce what the next sentence will say.

What does NOT change under any of this: every number is real, every bad week gets said out loud in the same voice as a good one, and someone who disagrees with the position should still finish the thread thinking it was argued honestly. Loud is a delivery choice about *how* a true thing is said. It is never licence to overclaim, to imply certainty you do not have, or to shade a figure toward the more interesting version — a thread that buys reach that way has failed worse than one nobody read.

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
A daily deep dive into ONE thing: a name our screen rates highly that we do NOT hold, a sector reading from the same screen, or a recent headline about one of those non-held names. The payload's \`spotlight.focus\` names which one today is — write that one, not the others, even if another looks like a better story.

**This is never a pick, a buy, or a recommendation, and you must say so plainly, in your own words, near the top — not as a buried disclaimer.** It is a quantitative screen's output, nothing more: the screen can be wrong, a name here can fail another buy gate, run into a sector limit, or simply never enter the book.

If \`spotlight.focus\` is "candidate": use \`spotlight.candidate\`. What the business does, why the grades (valuation, growth, profitability, momentum, revisions) land where they do, and — required — what would have to be true for the screen's rating to be wrong about it. Do not write as though we hold it: no entry date, no P&L, because there is none.

If \`spotlight.focus\` is "sector": use \`spotlight.sector\`. How much of the sector clears the current screen, how that share has moved, and what would need to change before that showed up as an actual position in the book — not a prediction that it will.

If \`spotlight.focus\` is "news": use \`spotlight.newsItem\`. Report what the headline actually says — do not speculate past it, and do not turn it into a forecast ("this means the stock will..."). Connect it to why the name is on our screen at all (its grades, from \`spotlight.candidates\`, if that same ticker appears there) if you can do that honestly; if the connection is not there, just report the news and say so. This is a report on a story, not a trade thesis.

**Never cite an individual holding's return next to this name, sector, or headline.** If you give any sense of scale from our own book, use its OVERALL return for the period, never a single position's — this thread is already at risk of reading like a stock tip, and naming one of our winners beside it makes that worse, not better.`;

const SUNDAY_REVIEW_BRIEF = `## This thread
The Sunday week-ahead thread. Written the evening before the week starts, about a week that has not happened yet.

You have \`macro.yields\` (Treasury constant-maturity yields, with the change over the past week in basis points) and \`macro.calendar\` (scheduled US economic releases for the coming week, with consensus and previous where the vendor carries them). That is the entire set of macro numbers you may cite. You do NOT have Fed funds pricing, rate-decision odds, index levels, sector indices, breadth, flows, positioning, or earnings dates — none of those are in the payload, and every one of them is a number a thread like this is tempted to invent. If you want one, write around it.

**A week-ahead thread is a thesis, not a calendar.** Listing Tuesday's ISM and Friday's payrolls in order is what every other account posts and nobody reads. Find the tension in what you actually have — a front-end yield moving against a long-end one, a consensus that implies something the previous print contradicts, a release the rest of the week hangs on — and argue it. The calendar is evidence for the argument, not the argument.

Structure that works: open on the tension. Say what the week turns on and why. Walk the two or three ways it can break, naming what each would mean. Then say plainly what would have to happen for our own positioning to change, which is usually nothing — the strategy does not trade the macro calendar, and saying so is more honest than implying we do.

**Never forecast a level, a direction, or a return.** "A hot print makes the front end's move look early" is a reading. "Stocks fall if payrolls beat" is a prediction, and it is not something we publish. The distinction is the whole reason this thread is allowed to exist: you are describing what is at stake, never what will happen.

The CTA post points at the free Market Note, which is what the shared rules already hand you as this thread's closing link. It goes out Monday morning, it is free, and it covers what our model is scoring across the US market — say that plainly and once.

Our book is context here, not the subject. The screen has no view on a payroll number, and the thread should say so rather than implying our positioning anticipates the week. If you cite our own performance at all, it is the overall book return for a period, never a single holding's.`;


const HOT_TAKE_BRIEF = `## This thread
A single post, then the CTA. Not a thread. One post.

This is the cheapest thing the account posts and the highest-variance, so take a real swing. Find the one fact in the payload that would stop someone who scrolls past every other finance post: a number that contradicts the consensus story, two figures nobody puts side by side, or something about our own book that a promotional account would never admit.

Shapes that work:
- **The contrast.** Two real figures from the payload set against each other, no commentary. "Our screen rates 41% of Financial Services investable. For Technology it's 6%. Same screen, same morning."
- **The confession.** Something true and unflattering about our own record, stated flatly. These outperform victory laps, consistently, and we have the data to say them honestly.
- **The count.** One surprising tally from the book or the screen.

Rules specific to this one:
- **One idea.** If a second sentence is needed to explain why the first one matters, the first one is not the post.
- No preamble and no wind-up. The first word is part of the claim.
- Every factual rule above still holds. A hot take is a true number stated without cushioning — never a number stripped of context that changes what it means.
- If the payload has nothing sharp today, write the most interesting true thing in it and let it be a quiet day. A manufactured hot take is worse than a dull one.`;

const LEADERBOARD_BRIEF = `## This thread
A ranked list of the highest-rated names our screen does NOT hold, from \`spotlight.candidates\`. List posts get saved and re-shared far more than prose, which is the entire reason this format exists.

Structure:
- Post 1: a framing line, then the list — ticker and rating, one per line, no commentary. If the whole list will not fit, post 1 carries the framing and the first names and post 2 carries the rest.
- Then one post, at most two, on what the list actually shows: the sector that dominates it, the name whose rating moved most, or what these names have in common. One observation, not a tour of all of them.
- Then the CTA.

**Required, and near the top, in your own words:** these are screen outputs, not picks and not positions. We do not hold them. The screen can be wrong, and a name on this list may fail another gate or never enter the book at all.

Format the list as ticker then rating, one per line — \`AAAA 4.7\` — with a real line break between each. No pipes, no dashes, no table; X renders none of it.

Never a price target, never a return for any of these names, and never an implication that a high rating says anything about what happens next. If you give any sense of scale from our own book, use its overall return for the period, never a single holding's.`;

const POLL_PROMPT_BRIEF = `## This thread
Two posts: one genuine question, then the CTA. Replies weigh heavily in what gets shown, and a real question from an account that shows its work is how you earn them.

The question must be anchored to a real number in the payload. That is the whole line between this and engagement farming, and it is not a subtle one. "What's everyone watching this week?" is farming. "Our model has held this through a 22% drawdown and back to flat — at what point does conviction just become being wrong slowly?" is a question, because it costs us something to ask it.

Rules specific to this one:
- **Post 1 is the number, then the question.** Two or three lines. The number is what makes the question worth answering.
- Ask something you do not already know the answer to. A question with an obvious right answer reads as a quiz and gets ignored.
- The best version puts our own book on the hook rather than asking readers to judge somebody else's.
- **Never invite a trade.** No "what should we buy next", no "which of these would you own". Ask about method, about judgement, about what a number means — never about what to do.
- Text only. We do not create X's poll object from this pipeline, so do not write as though there are options to vote on.`;

const BRIEFS = {
  weekly_review: WEEKLY_BRIEF,
  market: MARKET_BRIEF,
  pick: PICK_BRIEF,
  spotlight: SPOTLIGHT_BRIEF,
  sunday_review: SUNDAY_REVIEW_BRIEF,
  hot_take: HOT_TAKE_BRIEF,
  leaderboard: LEADERBOARD_BRIEF,
  poll_prompt: POLL_PROMPT_BRIEF,
} as const;

export type ThreadKind = keyof typeof BRIEFS;

/**
 * How many posts each kind runs to, INCLUDING its closing CTA post.
 *
 * The three reach formats are deliberately tiny. A hot take is one post and a
 * link; stretching it into a thread is exactly what makes it stop working,
 * so the ceiling is the enforcement rather than a note in the brief the model
 * can talk itself out of.
 */
export const POST_BOUNDS: Record<ThreadKind, { min: number; max: number }> = {
  weekly_review: { min: 5, max: 13 },
  market: { min: 5, max: 13 },
  pick: { min: 5, max: 13 },
  spotlight: { min: 5, max: 13 },
  sunday_review: { min: 5, max: 13 },
  hot_take: { min: 2, max: 2 },
  leaderboard: { min: 3, max: 5 },
  poll_prompt: { min: 2, max: 2 },
};

/**
 * Where each kind's closing post sends people, and what to promise is there.
 *
 * Only routes that exist — a CTA to a 404 is worse than no CTA at all. Kinds
 * that argue from the book land on the track record; the two that argue from
 * the screen land on the strategy page, because a reader arriving from a list
 * of names we do NOT own needs the page explaining what the rating is before
 * the page showing what we bought.
 */
export const CTA_DESTINATIONS: Record<
  ThreadKind,
  { url: string; what: string }
> = {
  weekly_review: {
    url: `${SITE_URL}/track-record`,
    what: "every position in the book and what it has done, updated as it moves",
  },
  market: {
    url: `${SITE_URL}/track-record`,
    what: "every position in the book and what it has done, updated as it moves",
  },
  pick: {
    url: `${SITE_URL}/track-record`,
    what: "every position in the book and what it has done, updated as it moves",
  },
  spotlight: {
    url: `${SITE_URL}/strategy`,
    what: "how the screen works and what it actually scores",
  },
  sunday_review: {
    url: `${SITE_URL}/market-note`,
    what: "the free Monday Market Note",
  },
  hot_take: {
    url: `${SITE_URL}/track-record`,
    what: "every position in the book and what it has done, updated as it moves",
  },
  leaderboard: {
    url: `${SITE_URL}/strategy`,
    what: "how the screen works and what it actually scores",
  },
  poll_prompt: {
    url: `${SITE_URL}/track-record`,
    what: "every position in the book and what it has done, updated as it moves",
  },
};

/** Only the long kinds need talking out of padding; the short ones are capped. */
const LENGTH_NOTES: Partial<Record<ThreadKind, string>> = {
  weekly_review: " Aim for the long end.",
  market: " Aim for the long end.",
  pick: " Aim for the long end.",
  spotlight: " Aim for the long end.",
  sunday_review: " Aim for the long end.",
};

/**
 * The per-kind half of the system prompt: how long, and where the CTA points.
 *
 * Built here rather than written into each brief so that adding a kind cannot
 * silently ship a thread with no closing link — the record types make the
 * compiler ask for both.
 */
export function kindDirectives(kind: ThreadKind): string {
  const { min, max } = POST_BOUNDS[kind];
  const cta = CTA_DESTINATIONS[kind];
  const length =
    min === max ? `exactly ${min} posts` : `between ${min} and ${max} posts`;
  const note =
    LENGTH_NOTES[kind] ??
    " This is a short format on purpose; do not stretch it.";

  return `## Length
Write ${length}, counting the closing CTA post.${note} Padding to reach a count is worse than posting short.

## The closing post
- The LAST post is the CTA and nothing else. It is the only post in the thread allowed to contain a link, and that link must be exactly: ${cta.url}
- Write one line of payoff, then the URL. Say what is actually on the other side — ${cta.what} — never "link in bio", never "read more", never "check it out".
- It does not have to be the sharpest line in the thread; the post before it does. This post's only job is converting someone who has already decided they liked what they read.
- No URL in any other post, in any form, including a bare domain.`;
}

/** The schema a draft is parsed against: this kind's window, not the union of every kind's. */
function threadSchemaFor(kind: ThreadKind) {
  const { min, max } = POST_BOUNDS[kind];
  return z.object({
    posts: z.array(z.string().min(1).max(400)).min(min).max(max),
    summary: z.string().min(20).max(500),
  });
}

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

/** A headline for a non-held name our screen tracks. Never a held ticker — see `/ops/editorial-brief`. */
export type SpotlightNewsItem = {
  ticker: string | null;
  headline: string;
  publisher: string | null;
  published_at: string;
};

type EditorialBrief = {
  rating_as_of: string | null;
  sectors: SpotlightSectorReading[];
  watchlist: SpotlightCandidate[];
  news: SpotlightNewsItem[];
};

export type SpotlightFocus = "candidate" | "sector" | "news";

/** One constant-maturity Treasury series. Shape matches `/ops/macro-brief`. */
export type MacroYield = {
  series: string;
  as_of: string;
  percent: number | null;
  week_ago_percent: number | null;
  change_bp: number | null;
  week_ago_as_of: string | null;
};

/** A scheduled US economic release. `actual` is null until it happens. */
export type MacroCalendarEvent = {
  event: string;
  date: string;
  actual: number | null;
  consensus: number | null;
  previous: number | null;
  unit: string | null;
};

type MacroBrief = {
  rates_as_of: string | null;
  yields: MacroYield[];
  calendar: MacroCalendarEvent[];
};

export type XThreadFacts = WeeklyReviewFacts & {
  thread_kind: ThreadKind;
  periods: PeriodRow[];
  sectors: SectorRollup[];
  macro?: MacroBrief;
  spotlight?: {
    rating_as_of: string | null;
    focus: SpotlightFocus | null;
    candidate: SpotlightCandidate | null;
    sector: SpotlightSectorReading | null;
    newsItem: SpotlightNewsItem | null;
    /** Full lists, in case the model needs surrounding context for the one it's writing about. */
    candidates: SpotlightCandidate[];
    sectors: SpotlightSectorReading[];
    news: SpotlightNewsItem[];
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
 * Macro facts for the Sunday thread, from what the worker ingested.
 *
 * Same ops-key path as `fetchEditorialBrief`. A null return is an ordinary
 * outcome — the ingest job has not run, or the FMP plan does not carry those
 * endpoints — and the caller records it in `missing` rather than failing the
 * draft, because a thinner thread beats no thread and beats an invented one.
 */
async function fetchMacroBrief(): Promise<MacroBrief | null> {
  const key = process.env.OPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${OPS_API_BASE}/macro-brief`, {
      headers: { "X-Ops-Key": key },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MacroBrief;
  } catch {
    return null;
  }
}

/**
 * Kinds whose payload needs the screener watchlist.
 *
 * The spotlight argues one name from it, the leaderboard ranks the whole
 * list, and the hot take goes looking through it for a contrast. Every other
 * kind writes from the book alone and skips the extra ops-key round trip.
 */
const SCREEN_KINDS: ThreadKind[] = ["spotlight", "hot_take", "leaderboard"];

export type SpotlightCounts = { candidate: number; sector: number; news: number };

/**
 * Which candidate, sector, or news item today's spotlight covers.
 *
 * Deterministic in the day, not random: a re-fired draft job must land on the
 * same subject it already wrote about, and `createThreadDraft`'s dedupe only
 * works if two calls on the same day agree. Rotates evenly across whichever
 * of the three sources actually has something today — a day with no news
 * ingested falls back to candidate/sector only, rather than the rotation
 * skipping a slot and drifting out of sync with which source it "should" be.
 * The index within whichever source is picked advances once per full cycle
 * through the sources, so a short list does not repeat every time its source
 * comes back around.
 */
export function pickSpotlightIndex(
  now: Date,
  counts: SpotlightCounts,
): { focus: SpotlightFocus; index: number } | null {
  const available = (["candidate", "sector", "news"] as const).filter(
    (focus) => counts[focus] > 0,
  );
  if (available.length === 0) return null;
  const dayNumber = Math.floor(now.getTime() / 86_400_000);
  const focus = available[dayNumber % available.length];
  const index = Math.floor(dayNumber / available.length) % counts[focus];
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

/**
 * Re-label a Sunday payload onto the week it is about.
 *
 * `fetchWeeklyReviewFacts` exists to write Friday's review, so its
 * `period_label` and `week_key` name the week that just ended. Spreading those
 * into the Sunday payload put "write the sunday review thread for August
 * 25-31" in the prompt, and the model wrote exactly that — a backward-looking
 * book review under a WEEK AHEAD header.
 *
 * Emptying `holdings` and `moves` is the other half. The brief says the book is
 * context rather than the subject, but a payload listing every position's P&L
 * is an invitation no brief outweighs. Aggregate returns survive in `week`,
 * `periods` and `sectors`, so the no-cherry-picking rule keeps its denominator.
 */
export function weekAheadFraming(now: Date) {
  const monday = new Date(now.getTime() + 86_400_000);
  return {
    week_key: isoWeekKey(monday),
    // periodLabel takes the week's END; the thread's week ends six days on.
    period_label: periodLabel(new Date(monday.getTime() + 6 * 86_400_000)),
    holdings: [] as WeeklyReviewFacts["holdings"],
    moves: [] as WeeklyReviewFacts["moves"],
  };
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
  // Named for every kind, not just the Sunday one: the other briefs must not
  // start reaching for rates either, and the model only knows a fact is off
  // limits if the payload says so.
  let macro: MacroBrief | undefined;
  if (kind === "sunday_review") {
    const brief = await fetchMacroBrief();
    if (!brief || (brief.yields.length === 0 && brief.calendar.length === 0)) {
      missing.push("treasury_yields", "economic_calendar");
    } else {
      macro = brief;
      if (brief.yields.length === 0) missing.push("treasury_yields");
      if (brief.calendar.length === 0) missing.push("economic_calendar");
    }
  } else {
    missing.push("treasury_yields", "economic_calendar");
  }
  // Never in any payload. Listed because these are the numbers a macro thread
  // reaches for by reflex, and an unnamed gap is one the model fills itself.
  missing.push("fed_funds_pricing", "rate_decision_odds", "index_levels");

  let spotlight: XThreadFacts["spotlight"];
  if (SCREEN_KINDS.includes(kind)) {
    const brief = await fetchEditorialBrief();
    if (!brief?.rating_as_of) {
      missing.push("screener_watchlist", "news");
    } else {
      // Only the spotlight rotates onto ONE subject per day. The hot take and
      // the leaderboard read the whole list — one hunting a contrast worth
      // posting, the other because the list is itself the post — so they get
      // the brief with no focus set and `pickSpotlightIndex` never runs.
      const counts: SpotlightCounts = {
        candidate: brief.watchlist.length,
        sector: brief.sectors.length,
        news: brief.news.length,
      };
      const pick = kind === "spotlight" ? pickSpotlightIndex(now, counts) : null;
      if (kind === "spotlight" && !pick) {
        missing.push("screener_watchlist", "news");
      } else {
        spotlight = {
          rating_as_of: brief.rating_as_of,
          focus: pick?.focus ?? null,
          candidate:
            pick?.focus === "candidate" ? brief.watchlist[pick.index] : null,
          sector: pick?.focus === "sector" ? brief.sectors[pick.index] : null,
          newsItem: pick?.focus === "news" ? brief.news[pick.index] : null,
          candidates: brief.watchlist,
          sectors: brief.sectors,
          news: brief.news,
        };
        // Not an error, just the ingest job having found nothing recent —
        // name it so the model does not invent a catalyst that isn't there.
        if (brief.news.length === 0) missing.push("news");
      }
    }
  } else {
    // No other thread kind's brief references news at all.
    missing.push("news");
  }

  // The base facts describe the week that just ENDED — `fetchWeeklyReviewFacts`
  // exists to write Friday's review. Handing those straight to the Sunday
  // thread told it, in the prompt's own words, to write "the sunday review
  // thread for August 25-31", and it dutifully wrote a backward-looking book
  // review under a WEEK AHEAD header. Relabel to the week the thread is about.
  //
  // The per-holding array goes too. The brief says the book is context and not
  // the subject, but a payload carrying every position's P&L is an invitation
  // the brief cannot outweigh — the first draft argued FIX, LLY, GEV and SKWD
  // one by one. Aggregate returns stay (`week`, `periods`, `sectors`) so the
  // no-cherry-picking rule still has its denominator.
  const framing = kind === "sunday_review" ? weekAheadFraming(now) : {};

  return {
    ...base,
    ...framing,
    missing,
    thread_kind: kind,
    periods: (periodsBody?.periods ?? []).map((p) => ({
      ...p,
      book_return_pct: round2(p.book_return_pct),
      spy_return_pct: round2(p.spy_return_pct),
      open_picks_return_pct: round2(p.open_picks_return_pct),
    })),
    sectors: rollUpSectors(base.holdings),
    macro,
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
  const key =
    // Both draft every weekday, so the day is the natural unit; a re-fired
    // job on the same morning finds the draft it already wrote.
    kind === "spotlight" || kind === "hot_take"
      ? dayKey(now)
      : kind === "sunday_review"
        ? // ISO weeks end on Sunday, so a thread drafted Sunday evening about
          // the week that STARTS tomorrow would otherwise be filed under the
          // week that just finished — the same key as Friday's weekly review,
          // and a label naming the wrong week in the prompt. Key on the day
          // after, which is the Monday the thread is actually about; a manual
          // redraft on Sunday or Monday both land on that same week.
          isoWeekKey(new Date(now.getTime() + 86_400_000))
        : isoWeekKey(now);
  return suffix ? `${key}:${suffix}` : key;
}

/**
 * The CTA rule, checked rather than trusted.
 *
 * Two failures matter here and a length check sees neither. A thread whose
 * last post lost the link drives no page views at all, which is the only
 * reason these threads are posted. And a link in the BODY is billed per post
 * at `COST_PER_LINK_POST_USD` — thirteen times the plain rate — so a model
 * that helpfully repeats the URL in three posts turns a $0.35 thread into a
 * $0.80 one, and buries the thread's reach on the way.
 *
 * `containsUrl` matches bare domains as well as `https://` ones, so a body
 * post saying "outpick.xyz/track-record" is caught the same as a real link.
 */
export function validateCta(posts: string[], url: string): string[] {
  const problems: string[] = [];
  const last = posts.length - 1;
  posts.forEach((post, i) => {
    if (i !== last && containsUrl(post)) {
      problems.push(
        `post ${i + 1} contains a link — only the last post may have one`,
      );
    }
  });
  if (last >= 0 && !posts[last].includes(url)) {
    problems.push(`the last post does not carry the CTA link ${url}`);
  }
  return problems;
}

/**
 * Ask the model for a thread, then check the lengths and the CTA ourselves.
 *
 * One retry, with every problem named at once. Models are unreliable
 * character counters and drift on where the link goes, and a single
 * corrective pass fixes nearly all of both; looping further would burn tokens
 * on a draft a human is about to read and edit anyway.
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

  const cta = CTA_DESTINATIONS[facts.thread_kind];
  const system = `${SHARED_RULES}\n\n${kindDirectives(facts.thread_kind)}\n\n${BRIEFS[facts.thread_kind]}`;
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
        format: zodOutputFormat(threadSchemaFor(facts.thread_kind)),
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

    const problems = [
      ...validateThread(parsed.posts, maxChars).map(
        (e) => `post ${e.index + 1} is ${e.chars} characters, over the ${maxChars} limit`,
      ),
      ...validateCta(parsed.posts, cta.url),
    ];
    if (problems.length === 0) return parsed;

    if (attempt === 1) {
      throw new Error(
        `Model could not satisfy the thread rules after a retry: ${problems.join("; ")}`,
      );
    }

    messages.push(
      { role: "assistant", content: JSON.stringify(parsed) },
      {
        role: "user",
        content:
          `Fix these and return the whole thread again: ${problems.join("; ")}. ` +
          `Every post must be at or under ${DRAFT_TARGET_CHARS} characters, the last ` +
          `post must contain ${cta.url}, and no other post may contain a link or a ` +
          `bare domain. Cut words rather than dropping the argument, and keep every ` +
          `figure you cited.`,
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
