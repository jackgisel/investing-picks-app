import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { OPS_API_BASE } from "@/lib/api-config";
import { SITE_NAME } from "@/lib/constants";
import { CONTENT_DATE_AND_VISUAL_RULES } from "@/lib/content-draft";
import type { EditorialBrief } from "@/lib/market-note-brief";
import {
  LETTER_COMMON_RULES,
  LETTER_MODEL,
  letterClient,
  researchNotes,
} from "@/lib/letter-ai";

/**
 * Model-written drafts for the two free letters that are not the Monday note:
 * the twice-monthly market analysis and the Wednesday spotlight on a holding.
 * Both land in `editorial_issue` unconfirmed for a person to review.
 */

const LetterSchema = z.object({
  subject: z.string().min(10).max(120),
  bodyMd: z.string().min(500),
});

export type EditorialAiDraft = z.infer<typeof LetterSchema>;

const ANALYSIS_GUIDE = `You write the twice-monthly market analysis for ${SITE_NAME}, a free email from a stock-research publication.

## What you are given
- FACTS: our scoring snapshot (sector breadth across the rated universe) and, when available, Treasury yields and the economic calendar from our own data.
- RESEARCH: dated, sourced notes from a web search on how markets, rates and the economy have moved over the last two weeks and what is scheduled in the next two.

## The letter
About 600 to 800 words, four H2 sections in this order:
1. What happened: how markets moved over the period, and why, per RESEARCH.
2. Rates and the economy: what yields and data said. Quote yields only from FACTS or RESEARCH.
3. Under the surface: what sector breadth in FACTS says about where the market is strong or narrow. Say how many companies pass our screen and how that changed. Say when a comparison is missing.
4. The next two weeks: scheduled events with dates, and what would change the picture.

This is commentary, not a pick and not a recommendation. Do not name a stock as something to buy. Do not forecast; describe what would matter.

## Output
- \`subject\`: a specific claim about the period, under 70 characters.
- \`bodyMd\`: the four sections as markdown. No title, no disclaimer (the email adds one).

## Voice
Plain, specific, unhurried. Concrete nouns. Short paragraphs. Write for someone intelligent about business who is not a professional analyst.

${CONTENT_DATE_AND_VISUAL_RULES}

${LETTER_COMMON_RULES}`;

const SPOTLIGHT_GUIDE = `You write the Wednesday spotlight for ${SITE_NAME}, a free email from a stock-research publication. Each week it looks closely at one business we hold.

## What you are given
- FACTS: the holding's ticker, its return since we bought it (percent), the date we bought it, and workforce and revenue growth figures where we have them.
- RESEARCH: dated, sourced notes from a web search on the company: what it sells, who pays, how its last results went, and what could go wrong.

## The letter
About 450 to 650 words, three H2 sections in this order:
1. The business: what it sells and to whom, in plain terms.
2. How it is doing: the latest results and the return since we bought it. Our return is a percentage only.
3. What could go wrong: the real risks, from RESEARCH. Not boilerplate.

We hold this stock, so say so once, plainly. Do not tell the reader to buy, hold or sell. Never state a position size, share count, entry or exit price, or any dollar figure for our book. The ban is on our book, not on the company's revenue or profit.

## Output
- \`subject\`: the holding named with something specific, under 70 characters.
- \`bodyMd\`: the three sections as markdown. No title, no disclaimer (the email adds one).

## Voice
Plain, specific, unhurried. Write for someone intelligent about business who is not a professional analyst.

${CONTENT_DATE_AND_VISUAL_RULES}

${LETTER_COMMON_RULES}`;

async function writeLetter(
  guide: string,
  request: string,
  facts: unknown,
  research: string,
): Promise<EditorialAiDraft> {
  const client = letterClient();
  const response = await client.messages.parse({
    model: LETTER_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(LetterSchema) },
    system: [{ type: "text", text: guide, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `${request}\n\nFACTS:\n${JSON.stringify(facts, null, 2)}\n\nRESEARCH:\n${research}`,
      },
    ],
  });
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Model returned no parseable draft (stop_reason: ${response.stop_reason})`,
    );
  }
  return { subject: parsed.subject.trim(), bodyMd: parsed.bodyMd.trim() };
}

async function opsJson<T>(path: string): Promise<T | null> {
  const key = process.env.OPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${OPS_API_BASE}${path}`, {
      headers: { "X-Ops-Key": key },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function generateAnalysisDraft(
  periodKey: string,
  today: string,
): Promise<EditorialAiDraft> {
  const [brief, macro] = await Promise.all([
    opsJson<EditorialBrief>("/editorial-brief"),
    opsJson<Record<string, unknown>>("/macro-brief"),
  ]);
  const facts = {
    period_key: periodKey,
    sector_breadth: brief?.rating_as_of ? { as_of: brief.rating_as_of, sectors: brief.sectors } : null,
    macro: macro ?? null,
    missing: [
      ...(brief?.rating_as_of ? [] : ["sector breadth"]),
      ...(macro ? [] : ["treasury yields and economic calendar"]),
    ],
  };
  const client = letterClient();
  const research = await researchNotes(
    client,
    `Today is ${today}. Find, with sources and dates: how US stocks, Treasury yields and the dollar moved over the last two weeks and the main reasons given; the key economic data released in that time; and what is scheduled over the next two weeks (data releases, Fed events, major earnings).`,
  );
  return writeLetter(
    ANALYSIS_GUIDE,
    `Write the market analysis for the period ${periodKey}. Today is ${today}.`,
    facts,
    research,
  );
}

export async function generateSpotlightDraft(args: {
  ticker: string;
  pnlPct: number;
  entryDate: string | null;
  revenuePct: number | null;
  employeesPct: number | null;
  openingsChange90d: number | null;
  today: string;
}): Promise<EditorialAiDraft> {
  const facts = {
    ticker: args.ticker,
    return_since_we_bought_pct: Math.round(args.pnlPct * 10) / 10,
    bought_on: args.entryDate,
    revenue_growth_latest_year_pct: args.revenuePct,
    headcount_growth_year_pct: args.employeesPct,
    open_roles_change_90d_pct: args.openingsChange90d,
  };
  const client = letterClient();
  const research = await researchNotes(
    client,
    `Today is ${args.today}. Research ${args.ticker} for a reader who has not heard of it. Find, with sources and dates: what the company sells and to whom; its most recent quarterly results and guidance; what has driven the stock over the last six months; and the main risks analysts and the company itself name.`,
    6,
  );
  return writeLetter(
    SPOTLIGHT_GUIDE,
    `Write this week's spotlight on ${args.ticker}. Today is ${args.today}.`,
    facts,
    research,
  );
}
