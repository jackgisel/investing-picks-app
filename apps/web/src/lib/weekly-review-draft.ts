import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  CONTENT_DATE_AND_VISUAL_RULES,
  formatQuantRating,
  QUANT_RATING_MAX,
  QUANT_RATING_MIN,
  quantRatingExplainerUrl,
  quantRatingPromptRules,
} from "@/lib/content-draft";
import { isoWeekKey } from "@/lib/email-dispatch";
import type { InsightDraftFields } from "@/lib/insights";
import {
  movesInWeek,
  periodLabel,
  weekChangePct,
} from "@/lib/weekly-summary";

/**
 * Drafting the Friday portfolio review from facts the public API already
 * publishes.
 *
 * Percentages only. The payload the model sees is the same shape a subscriber
 * can already read on the dashboard — no cash, no share counts, no dollar
 * P&L — so a leaky generation cannot invent a figure we refuse to print.
 *
 * The model writes a first draft; an admin reviews and confirms; noon sends.
 * Nothing here publishes anything.
 */

const MODEL = "claude-opus-5";

const STYLE_GUIDE = `You write the weekly portfolio review for ${SITE_NAME}, a subscription stock-research publication.

## What you are given
A JSON payload of facts drawn from the system's own public API: the book's week and since-inception returns, a SPY comparison over the same week, the open holdings with percentage P&L, weight, sector and quantitative rating, the week's buys and sells, and the next evaluation date.

The payload has a "missing" array naming the facts that are NOT available. Treat those as genuinely unknown. Do not estimate them, do not reason around them, and do not imply the model considered something it did not.

## The note
Five sections, in this order, each introduced by an H2:
1. The week — how the book and the picks did, honestly, including versus the S&P 500 when that figure is present.
2. What moved — buys and sells this week, or a plain statement that there were none. The strategy evaluates on a fixed cadence and holds through the weeks in between; most weeks look like that, and saying so is not a failure.
3. Holdings — the open book. Call out names that moved, grades that matter, and anything that has gone wrong. Do not list every position as a table.
4. What we are watching — the next evaluation, concentration, weak grades, anything that has to be true for the book to keep working.
5. Closing — one or two paragraphs. What this week actually said.

## Hard rules
- **Never a portfolio dollar figure.** No position size, no share count, no entry or exit price, no portfolio value, no dollar P&L. Express our side in percentages only. Company financials in dollars (revenue, free cash flow, market cap) are fine if they appear in the payload; the ban is on OUR book, not on the businesses.
- Never state or imply an Outpick price target. If the payload includes analyst price-target consensus (Street low/mean/high), you may cite it as third-party context — never as our target.
- Never use urgency, hype, or second-person exhortation ("you should buy", "don't miss"). The reader is deciding for themselves.
- Every number you cite must appear in the payload. If you want a figure you were not given, write around it or say it is not available.
- Where a holding is down or a grade is weak, say so. A review that only argues one side is worse than useless.
- No headings beyond H2. No images. No code fences.

${quantRatingPromptRules(SITE_URL)}

${CONTENT_DATE_AND_VISUAL_RULES}

## Voice
Plain, specific, unhurried. Short paragraphs. Prefer the concrete noun to the abstract one. Write for a reader who is intelligent about business but not a professional analyst, and who is paying for judgement rather than a data dump. This is a review of a week, not a victory lap and not an apology.

## Output
- \`bodyMd\` is GitHub-flavoured markdown containing ONLY the five sections: \`## Heading\` plus paragraphs, bullet lists, **bold**, links, and at most one short markdown table (largest movers when it helps). No front matter, no title (that is its own field), no closing disclaimer (the site adds one).
- \`lede\` is a single opening sentence or two, rendered above the body in larger type. It is not part of \`bodyMd\`.
- \`tldr\` is exactly five short bullets — the Highlights box at the top of the note.
- \`keyTakeaway\` is one or two sentences closing the note.
- \`title\` follows the house pattern: "Weekly review: <a specific claim about this week>". No ticker-as-title.
- \`description\` is one sentence, roughly 155 characters, used as the deck and the meta description.
- \`readingTime\` is your honest estimate in minutes at ~220 words per minute.`;

const DraftSchema = z.object({
  title: z.string().min(10).max(160),
  description: z.string().min(40).max(400),
  lede: z.string().min(40).max(600),
  tldr: z.array(z.string().min(10).max(300)).length(5),
  bodyMd: z.string().min(400),
  keyTakeaway: z.string().min(20).max(600),
  tags: z.array(z.string().min(2).max(40)).min(2).max(6),
  readingTime: z.number().int().min(1).max(30),
});

type PerformancePoint = {
  date?: string;
  return_pct?: number | null;
  spy_return_pct?: number | null;
};

type PerformanceSummary = {
  picks_return_pct?: number | null;
  total_return_pct?: number | null;
  position_count?: number | null;
};

type Holding = {
  ticker?: string | null;
  entry_date?: string | null;
  pnl_pct?: number | null;
  weight_pct?: number | null;
  sector?: string | null;
};

type PickRow = {
  ticker?: string | null;
  status?: string | null;
  pnl_pct?: number | null;
  quant_rating?: number | null;
  signal?: string | null;
  entry_date?: string | null;
};

type ApiTrade = {
  ticker?: string | null;
  side?: string | null;
  date?: string | null;
};

export type WeeklyReviewFacts = {
  week_key: string;
  period_label: string;
  missing: string[];
  week: {
    book_change_pct: number | null;
    spy_change_pct: number | null;
    picks_return_pct: number | null;
    total_return_pct: number | null;
    position_count: number | null;
  };
  holdings: {
    ticker: string;
    pnl_pct: number | null;
    weight_pct: number | null;
    sector: string | null;
    quant_rating: number | null;
    quant_rating_display: string | null;
    signal: string | null;
    entry_date: string | null;
  }[];
  moves: { ticker: string; action: string; when: string }[];
  next_evaluation_date: string | null;
  quant_rating_scale: { min: number; max: number };
  quant_rating_explainer_url: string;
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

function roundPct(n: number | null | undefined): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Assemble the week's facts. Always returns a payload; `missing` names the
 * gaps. A caller that cannot draft without numbers should check `missing`.
 */
export async function fetchWeeklyReviewFacts(
  now: Date = new Date(),
): Promise<WeeklyReviewFacts> {
  const missing: string[] = [];
  const [perf, strategy, picksBody, tradesBody] = await Promise.all([
    getJson<{
      summary?: PerformanceSummary;
      series?: PerformancePoint[];
    }>("/performance"),
    getJson<{
      holdings?: Holding[];
      next_evaluation_date?: string | null;
      portfolio?: { picks_return_pct?: number | null };
    }>("/strategy"),
    getJson<{ picks?: PickRow[] }>("/picks?status=active"),
    getJson<{ trades?: ApiTrade[] }>("/trades?limit=100"),
  ]);

  if (!perf?.summary) missing.push("performance_summary");
  if (!perf?.series?.length) missing.push("equity_curve");
  if (!strategy?.holdings) missing.push("holdings");
  if (!picksBody?.picks) missing.push("ratings");
  if (!tradesBody?.trades) missing.push("trades");

  const bookChange = weekChangePct(perf?.series ?? []);
  const spyChange = weekChangePct(
    (perf?.series ?? []).map((p) => ({
      date: p.date,
      return_pct: p.spy_return_pct,
    })),
  );
  if (bookChange === null) missing.push("week_book_change");
  if (spyChange === null) missing.push("week_spy_change");

  const ratings = new Map<string, PickRow>();
  for (const p of picksBody?.picks ?? []) {
    if (p.ticker) ratings.set(p.ticker.toUpperCase(), p);
  }

  const holdings = (strategy?.holdings ?? [])
    .filter((h): h is Holding & { ticker: string } => Boolean(h.ticker))
    .map((h) => {
      const pick = ratings.get(h.ticker.toUpperCase());
      const quantRating = roundPct(pick?.quant_rating);
      return {
        ticker: h.ticker.toUpperCase(),
        pnl_pct: roundPct(h.pnl_pct),
        weight_pct: roundPct(h.weight_pct),
        sector: h.sector ?? null,
        quant_rating: quantRating,
        quant_rating_display: formatQuantRating(quantRating),
        signal: pick?.signal ?? null,
        entry_date: h.entry_date ?? pick?.entry_date ?? null,
      };
    });

  return {
    week_key: isoWeekKey(now),
    period_label: periodLabel(now),
    missing,
    week: {
      book_change_pct: roundPct(bookChange),
      spy_change_pct: roundPct(spyChange),
      picks_return_pct: roundPct(perf?.summary?.picks_return_pct),
      total_return_pct: roundPct(perf?.summary?.total_return_pct),
      position_count:
        typeof perf?.summary?.position_count === "number"
          ? perf.summary.position_count
          : holdings.length || null,
    },
    holdings,
    moves: movesInWeek(tradesBody?.trades ?? [], now),
    next_evaluation_date: strategy?.next_evaluation_date ?? null,
    quant_rating_scale: { min: QUANT_RATING_MIN, max: QUANT_RATING_MAX },
    quant_rating_explainer_url: quantRatingExplainerUrl(SITE_URL),
  };
}

export async function generateWeeklyReviewDraft(
  facts: WeeklyReviewFacts,
): Promise<InsightDraftFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
  }

  const client = new Anthropic({ apiKey });
  const missingNote =
    facts.missing.length > 0
      ? `\n\nNOT AVAILABLE this week: ${facts.missing.join(", ")}. Do not write as though you have these.`
      : "";

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(DraftSchema),
    },
    system: [
      {
        type: "text",
        text: STYLE_GUIDE,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Write the weekly portfolio review for ${facts.period_label} (${facts.week_key}).${missingNote}\n\nFACTS:\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Model returned no parseable draft (stop_reason: ${response.stop_reason})`,
    );
  }
  return parsed;
}
