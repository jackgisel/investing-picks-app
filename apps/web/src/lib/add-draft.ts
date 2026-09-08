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
import { getInsightByTicker } from "@/lib/insights-db";

/**
 * Drafting a conviction-add note — the sibling of `insight-draft.ts` and
 * `exit-draft.ts`.
 *
 * A pick note argues why a position was opened. This one argues why we added
 * to a name we already hold. The original thesis stays put; this is a second
 * event, not a rewrite.
 */

const MODEL = "claude-opus-5";

const STYLE_GUIDE = `You write conviction-add notes for ${SITE_NAME}, a subscription stock-research publication.

A conviction add is published when the framework buys more of a name already in the book. The original pick note still stands. This note's job is to say what has to be true for an add, what the rule actually checked, and what has changed since the first buy — honestly, including when the case is weaker than it was.

## What you are given
A JSON payload of facts drawn from the system's own database: the company profile, the first entry date and how long the name had been held when we added, the current holding return, the add trade and its reason, the double-buy signal with the rule checks that fired, the quantitative score and fundamentals as they stood at the add, and a link to the original pick note when one exists.

The payload has a "missing" array naming the facts that are NOT available. Treat those as genuinely unknown. Do not estimate them and do not reason around them. In particular: if the add signal and its rule checks are missing, the add was entered manually and you must not describe any automated rule as having fired.

The score and fundamentals in the payload are AS OF THE ADD, not today. Write about them in the past tense — this is the evidence that existed when the decision was made.

## The note
Six sections, in this order, each introduced by an H2:
1. What we already owned — the business, briefly. Assume the reader may not have read the original pick note. Link that note when \`original_pick.url\` is present.
2. Why we bought it the first time — the original case, stated fairly, in the past tense.
3. What has changed — what moved between the first entry and the add. Grades, return, the business. If little changed and the add is mechanical (the name cleared the same buy gates and was up enough), say exactly that.
4. The rule that added — the specific rule checks from the payload. Name them. This is the section that makes the add checkable. A conviction add requires the name to already be held, to have gained at least the minimum in the payload, and to still clear the buy criteria.
5. Where the holding stands — the return since first entry, in percentage terms, and how long it has been held. Not a victory lap.
6. What has to stay true — what would make this add look wrong.

## Hard rules
- **Never a portfolio dollar figure.** No position size, no share count, no entry or exit price, no portfolio value, no dollar P&L. Express our side in percentages only. Company financials in dollars (revenue, free cash flow, market cap) are fine and expected; the ban is on OUR position, not on the business.
- Never state or imply an ${SITE_NAME} price target. If the payload includes analyst price-target consensus (Street low/mean/high), you may cite it as third-party context — never as our target.
- Every number you cite must appear in the payload. If you want a figure you were not given, write around it or say it is not available.
- This is an add, not a new pick. Do not write as though the position was just opened. Do not tell the reader to buy more.
- Where a factor grade is weak, say so. A note that only argues one side is worse than useless.
- No urgency, no hype, no second-person exhortation.
- No headings beyond H2. No images. No code fences.

${quantRatingPromptRules(SITE_URL)}

${CONTENT_DATE_AND_VISUAL_RULES}

## Voice
Plain, specific, unhurried. Short paragraphs. Prefer the concrete noun to the abstract one. Write for a reader who is intelligent about business but not a professional analyst, and who is paying for judgement rather than a data dump.

## Output
- \`bodyMd\` is GitHub-flavoured markdown containing ONLY the six sections: \`## Heading\` plus paragraphs, bullet lists, **bold**, links, and at most one short markdown table. No front matter, no title (that is its own field), no closing disclaimer (the site adds one).
- \`lede\` is a single opening sentence or two, rendered above the body in larger type. It is not part of \`bodyMd\`.
- \`tldr\` is exactly five short bullets — the Highlights box at the top of the note.
- \`keyTakeaway\` is one or two sentences closing the note.
- \`title\` follows the house pattern: "Stock add: <a specific claim about why we added>". No ticker in the title.
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

export type AddFacts = {
  ticker: string;
  missing: string[];
  stock: unknown;
  holding: {
    entry_date: string | null;
    add_date: string;
    days_held_at_add: number | null;
    still_open: boolean;
    return_pct: number | null;
  };
  add_trade: unknown;
  entry: unknown;
  score_at_add: unknown;
  fundamentals: unknown;
  add_signal: unknown;
  original_pick: {
    slug: string;
    title: string | null;
    url: string;
  } | null;
};

/** The facts bundle for one conviction add, assembled by the API plus the original pick slug. */
export async function fetchAddFacts(
  ticker: string,
  addDate: string,
): Promise<AddFacts> {
  const res = await fetch(
    `${OPS_API_BASE}/add-facts/${encodeURIComponent(ticker)}?add_date=${encodeURIComponent(addDate)}`,
    { headers: opsHeaders(), cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Could not load add facts for ${ticker} on ${addDate} (upstream ${res.status})`,
    );
  }
  const facts = (await res.json()) as Omit<AddFacts, "original_pick"> & {
    original_pick?: AddFacts["original_pick"];
    missing: string[];
  };

  const original = await getInsightByTicker(ticker);
  const original_pick = original
    ? {
        slug: original.slug,
        title: original.title,
        url: `${SITE_URL}/dashboard/insights/${original.slug}`,
      }
    : null;
  const missing = [...facts.missing];
  if (!original_pick) missing.push("original_pick_note");

  return { ...facts, missing, original_pick };
}

/**
 * Draft an add note. Throws on any failure — the caller records it against the
 * row so a broken generation surfaces in the review queue rather than leaving
 * the add silently unwritten.
 */
export async function generateAddDraft(
  facts: AddFacts,
): Promise<InsightDraftFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
  }

  const client = new Anthropic({ apiKey });

  const missingNote =
    facts.missing.length > 0
      ? `\n\nNOT AVAILABLE for this add: ${facts.missing.join(", ")}. Do not write as though you have these.`
      : "";

  const factsForModel = {
    ...facts,
    score_at_add: facts.score_at_add
      ? {
          ...(facts.score_at_add as Record<string, unknown>),
          quant_rating_display: formatQuantRating(
            (facts.score_at_add as { quant_rating?: number | null })
              .quant_rating,
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
        content: `Write the conviction-add note for ${facts.ticker}, added ${facts.holding.add_date}.${missingNote}\n\nFACTS:\n${JSON.stringify(factsForModel, null, 2)}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Model returned no parseable add draft (stop_reason: ${response.stop_reason})`,
    );
  }
  return parsed;
}
