import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders } from "@/lib/admin";
import { SITE_NAME } from "@/lib/constants";
import { CONTENT_DATE_AND_VISUAL_RULES } from "@/lib/content-draft";
import type { InsightDraftFields } from "@/lib/insights";

/**
 * Drafting an exit note — the other half of `insight-draft.ts`.
 *
 * A pick note argues why a position was opened. This one accounts for how it
 * ended, including when that is badly. Same contract as the buy side: the model
 * writes a first draft, an admin reviews it, approval is a separate act, and
 * nothing here publishes anything.
 */

const MODEL = "claude-opus-5";

/**
 * The house style for exits. Identical on every note, so it carries the cache
 * breakpoint and the per-exit facts go after it.
 */
const STYLE_GUIDE = `You write exit notes for ${SITE_NAME}, a subscription stock-research publication.

An exit note is published when a position closes. Its job is to account for the round trip honestly — what we owned, why we bought it, what changed, and what the rule that closed it actually was. Members read these to learn how the framework behaves, not to be congratulated.

## What you are given
A JSON payload of facts drawn from the system's own database: the company profile, the round trip (entry date, exit date, days held, return percentage), the exit trade and its reason, the sell signal with the rule checks that fired, and the quantitative score and fundamentals as they stood at the time of the exit.

The payload has a "missing" array naming the facts that are NOT available. Treat those as genuinely unknown. Do not estimate them and do not reason around them. In particular: if the sell signal and its rule checks are missing, the position was closed manually and you must not describe any automated rule as having fired.

The score and fundamentals in the payload are AS OF THE EXIT, not today. Write about them in the past tense — this is the evidence that existed when the decision was made.

## The note
Six sections, in this order, each introduced by an H2:
1. What we owned — the business, briefly. Assume the reader may not have read the buy note.
2. Why we bought it — the original case, stated fairly, in the past tense.
3. What changed — what moved between entry and exit. If nothing about the business changed and the exit was mechanical (a trim, a recycle, a weight rule), say exactly that rather than inventing a narrative.
4. The rule that closed it — the specific rule checks from the payload. Name them. This is the section that makes the exit checkable.
5. What it returned — the round trip in percentage terms and how long it was held.
6. What we took from it — the honest lesson. On a loss this is the whole point of the note.

## Hard rules
- **Never a portfolio dollar figure.** No position size, no share count, no entry or exit price, no portfolio value, no dollar P&L. Express our side in percentages only. Company financials in dollars (revenue, free cash flow, market cap) are fine and expected; the ban is on OUR position, not on the business.
- Never state or imply an ${SITE_NAME} price target, and never suggest what the reader should do about the stock now. The position is closed; this is a record, not a new call.
- Every number you cite must appear in the payload. If you want a figure you were not given, write around it or say it is not available.
- **On a loss, do not soften it.** Do not open with what went right, do not describe a loss as a "learning opportunity", and do not imply the framework was really correct. State what the position returned, state what the rule did, and say plainly what the framework got wrong or failed to see. A note that only argues one side is worse than useless — it is the thing that gets a publication in trouble.
- Equally, do not claim skill on a gain that came from a mechanical rule. If the position was trimmed because it breached a weight cap, that is what happened.
- Distinguish a full exit from a partial one. \`action\` is one of full_sell, partial_sell, trim, recycle_trim — a trim is not a closed position and must not be written as one.
- No urgency, no hype, no second-person exhortation.
- No headings beyond H2. No images. No code fences.

${CONTENT_DATE_AND_VISUAL_RULES}

## Voice
Plain, specific, unhurried. Short paragraphs. Prefer the concrete noun to the abstract one. Write for a reader who is intelligent about business but not a professional analyst, and who is paying for judgement rather than a data dump.

## Output
- \`bodyMd\` is GitHub-flavoured markdown containing ONLY the six sections: \`## Heading\` plus paragraphs, bullet lists, **bold**, links, and at most one short markdown table. No front matter, no title (that is its own field), no closing disclaimer (the site adds one).
- \`lede\` is a single opening sentence or two, rendered above the body in larger type. It is not part of \`bodyMd\`.
- \`tldr\` is exactly five short bullets — the Highlights box at the top of the note.
- \`keyTakeaway\` is one or two sentences closing the note.
- \`title\` follows the house pattern: "Stock sale: <a specific claim about what happened>". No ticker in the title. It must not read as a victory lap on a loss.
- \`description\` is one sentence, roughly 155 characters, used as the deck and the meta description.
- \`readingTime\` is your honest estimate in minutes at ~220 words per minute.`;

/** Mirrors `DraftSchema` in insight-draft.ts — the row shape is the same. */
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

export type ExitFacts = {
  ticker: string;
  missing: string[];
  stock: unknown;
  round_trip: {
    entry_date: string | null;
    exit_date: string;
    held_days: number | null;
    return_pct: number | null;
    outcome: "gain" | "loss" | null;
    closes_position: boolean;
  };
  exit_trade: unknown;
  entry: unknown;
  score_at_exit: unknown;
  fundamentals: unknown;
  sell_signal: unknown;
};

/** The facts bundle for one closed round trip, assembled by the API. */
export async function fetchExitFacts(
  ticker: string,
  exitDate: string,
): Promise<ExitFacts> {
  const res = await fetch(
    `${OPS_API_BASE}/exit-facts/${encodeURIComponent(ticker)}?exit_date=${encodeURIComponent(exitDate)}`,
    { headers: opsHeaders(), cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Could not load exit facts for ${ticker} on ${exitDate} (upstream ${res.status})`,
    );
  }
  return (await res.json()) as ExitFacts;
}

/**
 * Draft an exit note. Throws on any failure — the caller records it against the
 * row so a broken generation surfaces in the review queue rather than leaving
 * the exit silently unwritten.
 */
export async function generateExitDraft(
  facts: ExitFacts,
): Promise<InsightDraftFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
  }

  const client = new Anthropic({ apiKey });

  const missingNote =
    facts.missing.length > 0
      ? `\n\nNOT AVAILABLE for this round trip: ${facts.missing.join(", ")}. Do not write as though you have these.`
      : "";

  // Stated separately from the JSON as well as inside it. A loss is the case
  // the style guide is strictest about, and burying the sign in a nested
  // object is how a model talks itself into an upbeat opening.
  const outcomeNote =
    facts.round_trip.outcome === "loss"
      ? "\n\nTHIS ROUND TRIP LOST MONEY. Do not open with what went right. Say what the framework got wrong."
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
        content: `Write the exit note for ${facts.ticker}, closed ${facts.round_trip.exit_date}.${missingNote}${outcomeNote}\n\nFACTS:\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Model returned no parseable exit draft (stop_reason: ${response.stop_reason})`,
    );
  }
  return parsed;
}
