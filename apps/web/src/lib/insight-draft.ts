import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders } from "@/lib/admin";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  CONTENT_DATE_AND_VISUAL_RULES,
  formatQuantRating,
  QUANT_RATING_MAX,
  QUANT_RATING_MIN,
  quantRatingExplainerUrl,
  quantRatingPromptRules,
} from "@/lib/content-draft";
import type { InsightDraftFields } from "@/lib/insights";

/**
 * Drafting a research note from the facts the system already holds.
 *
 * The model writes a first draft; an admin reviews and edits it; approval is a
 * separate, explicit act. Nothing here publishes anything.
 */

const MODEL = "claude-opus-5";

/**
 * The house style, and the only part of the prompt that is identical across
 * every pick — so it carries the cache breakpoint and the per-pick facts go
 * after it. Cached prefixes need ~512 tokens on this model, which this clears.
 */
const STYLE_GUIDE = `You write equity research notes for ${SITE_NAME}, a subscription stock-research publication.

## What you are given
A JSON payload of facts drawn from the system's own database: the company profile, the quantitative score and its five factor grades, the rule checks that fired when the position was opened, and a blob of trailing-twelve-month fundamentals from the data vendor.

The payload has a "missing" array naming the facts that are NOT available for this holding. Treat those as genuinely unknown. Do not estimate them, do not reason around them, and do not imply the model considered something it did not. If the buy signal and its rule checks are missing, the position was entered manually and you must not describe it as having cleared any automated gate.

## The note
Six sections, in this order, each introduced by an H2:
1. Business overview — what the company actually does and how it earns money.
2. Our buy thesis — why this name, grounded in the grades and rule checks you were given.
3. Growth and profitability — the TTM figures that support or complicate the thesis.
4. Valuation and momentum context — multiples and price behaviour, honestly framed.
5. Potential risks — real ones, specific to this business. Not boilerplate.
6. Concluding summary — what has to go right.

## Hard rules
- **Never a portfolio dollar figure.** No position size, no share count, no entry or exit price, no portfolio value, no dollar P&L. Express our side in percentages only — returns are what matter and absolute capital is the reader's own decision. This is how every published surface works and a draft is not where it changes. Company financials in dollars (revenue, free cash flow, market cap) are fine and expected; the ban is on OUR position, not on the business.
- Never state or imply an Outpick price target. If the payload includes analyst price-target consensus (Street low/mean/high), you may cite it as third-party context — never as our target.
- Never use urgency, hype, or second-person exhortation ("you should buy", "don't miss"). The reader is deciding for themselves.
- Every number you cite must appear in the payload. If you want a figure you were not given, write around it or say it is not available.
- Where a factor grade is weak, say so plainly and explain why the position was still opened. A note that only argues one side is worse than useless — it is the thing that gets a publication in trouble.
- No headings beyond H2. No images. No code fences.

${quantRatingPromptRules(SITE_URL)}

${CONTENT_DATE_AND_VISUAL_RULES}

## Voice
Plain, specific, unhurried. Short paragraphs. Prefer the concrete noun to the abstract one. Write for a reader who is intelligent about business but not a professional analyst, and who is paying for judgement rather than a data dump.

## Output
- \`bodyMd\` is GitHub-flavoured markdown containing ONLY the six sections: \`## Heading\` plus paragraphs, bullet lists, **bold**, links, and at most one short markdown table (factor grades when present). No front matter, no title (that is its own field), no closing disclaimer (the site adds one).
- \`lede\` is a single opening sentence or two, rendered above the body in larger type. It is not part of \`bodyMd\`.
- \`tldr\` is exactly five short bullets — the Highlights box at the top of the note.
- \`keyTakeaway\` is one or two sentences closing the note.
- \`title\` follows the house pattern: "Stock buy: <a specific claim about the company>". No ticker in the title.
- \`description\` is one sentence, roughly 155 characters, used as the deck and the meta description.
- \`readingTime\` is your honest estimate in minutes at ~220 words per minute.`;

const DraftSchema = z.object({
  title: z.string().min(10).max(160),
  description: z.string().min(40).max(400),
  lede: z.string().min(40).max(600),
  tldr: z.array(z.string().min(10).max(300)).length(5),
  bodyMd: z.string().min(500),
  keyTakeaway: z.string().min(20).max(600),
  tags: z.array(z.string().min(2).max(40)).min(2).max(6),
  readingTime: z.number().int().min(1).max(30),
});

export type ResearchFacts = {
  ticker: string;
  missing: string[];
  stock: unknown;
  position: unknown;
  score: unknown;
  fundamentals: unknown;
  buy_signal: unknown;
  entry: unknown;
};

/** The facts bundle for one ticker, assembled by the API. */
export async function fetchResearchFacts(
  ticker: string,
): Promise<ResearchFacts> {
  const res = await fetch(
    `${OPS_API_BASE}/research-facts/${encodeURIComponent(ticker)}`,
    { headers: opsHeaders(), cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Could not load research facts for ${ticker} (upstream ${res.status})`,
    );
  }
  return (await res.json()) as ResearchFacts;
}

/**
 * Draft a note. Throws on any failure — the caller records it against the row
 * so a broken generation surfaces in the review queue instead of leaving the
 * pick silently unwritten.
 */
export async function generateDraft(
  facts: ResearchFacts,
): Promise<InsightDraftFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
  }

  const client = new Anthropic({ apiKey });

  const missingNote =
    facts.missing.length > 0
      ? `\n\nNOT AVAILABLE for this holding: ${facts.missing.join(", ")}. Do not write as though you have these.`
      : "";

  // Surface the scale and explainer on the score object itself so the model
  // cannot invent a different denominator or omit the link target.
  const factsForModel = {
    ...facts,
    score: facts.score
      ? {
          ...(facts.score as Record<string, unknown>),
          quant_rating_display: formatQuantRating(
            (facts.score as { quant_rating?: number | null }).quant_rating,
          ),
          quant_rating_scale: {
            min: QUANT_RATING_MIN,
            max: QUANT_RATING_MAX,
          },
          quant_rating_explainer_url: quantRatingExplainerUrl(SITE_URL),
        }
      : null,
  };

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // Adaptive rather than a fixed budget: the payload varies from a full
    // evaluation with rule checks down to a manual buy with almost nothing,
    // and the amount of reasoning that deserves varies with it.
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(DraftSchema),
    },
    system: [
      {
        type: "text",
        text: STYLE_GUIDE,
        // Identical on every pick, and it renders before the messages, so one
        // breakpoint here caches the whole guide across the batch.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Write the research note for ${facts.ticker}.${missingNote}\n\nFACTS:\n${JSON.stringify(factsForModel, null, 2)}`,
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
