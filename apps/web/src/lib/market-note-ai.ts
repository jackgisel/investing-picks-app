import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  CONTENT_DATE_AND_VISUAL_RULES,
  quantRatingPromptRules,
} from "@/lib/content-draft";
import {
  LETTER_COMMON_RULES,
  LETTER_MODEL,
  letterClient,
  researchNotes,
} from "@/lib/letter-ai";
import {
  composeMarketNoteBodyMd,
  MARKET_NOTE_WATCHLIST_MAX,
  MARKET_NOTE_WATCHLIST_MIN,
  normalizeDates,
  normalizeWatchlist,
} from "@/lib/market-note-preview";
import type {
  EditorialBrief,
  MarketNotePreviewDraft,
} from "@/lib/market-note-brief";

/**
 * The Monday market note, drafted by the model from our scoring snapshot plus
 * live web research, then left for a person to read and confirm.
 *
 * The radar is names we do not hold. The snapshot already excludes holdings,
 * and `restrictToRadar` drops anything the model adds that is not in it, so a
 * generation cannot smuggle in a ticker the route would later reject.
 */

const STYLE_GUIDE = `You write the Monday market note for ${SITE_NAME}, a free weekly email from a stock-research publication. It goes out before the US open.

## What you are given
- FACTS: our own scoring snapshot. A radar of up to ten companies we do NOT hold (quant rating, grades, revenue growth and revisions, next earnings date), sector breadth, and recent headlines on those names.
- RESEARCH: dated, sourced notes from a web search run this morning on the market backdrop and on the radar names.

## The note
Return these parts:
- \`subject\`: the email subject. A specific claim about this week, under 70 characters. No "Monday market note" prefix and no ticker as the whole subject.
- \`lede\`: one or two sentences opening the note. What this week turns on.
- \`watchlist\`: ${MARKET_NOTE_WATCHLIST_MIN} to ${MARKET_NOTE_WATCHLIST_MAX} companies, chosen ONLY from the radar in FACTS. Each has \`ticker\`, \`name\`, and \`note\`: one or two sentences on why it is on the radar this week, using its rating, its grades and one fact from RESEARCH where there is one. These are names we are looking at, not holdings and not recommendations. Never write "buy", "we recommend", or a price target.
- \`sectorsMd\`: a short markdown passage or bullet list on where sector breadth is moving, from the sector rows in FACTS. Say how many companies pass the screen and how that changed. Where the 7-day comparison is missing, say so.
- \`newsMd\`: a short bullet list of the stories that matter this week, from RESEARCH and the headlines in FACTS. Each bullet names the source.
- \`sentimentMd\`: a short passage titled by content, not heading, on what the market is worried about and what it is excited about this week, from RESEARCH. If RESEARCH does not support a read, write one honest sentence saying so.
- \`dates\`: the dated events ahead this week, as \`{ date, label }\`. Earnings dates for radar names come from FACTS. Macro releases and Fed events come from RESEARCH, and only when a source gives the date. Dates read "Tue Oct 6" or "October 6, 2026", never day-first.

The note is a Monday read, short. A reader should finish it in three minutes.

## Voice
Plain, specific, unhurried. Concrete nouns. Write for someone intelligent about business who is not a professional analyst. Report the week; do not forecast it.

${quantRatingPromptRules(SITE_URL)}

${CONTENT_DATE_AND_VISUAL_RULES}

${LETTER_COMMON_RULES}`;

const DraftSchema = z.object({
  subject: z.string().min(10).max(120),
  lede: z.string().min(30).max(500),
  watchlist: z
    .array(
      z.object({
        ticker: z.string().min(1).max(10),
        name: z.string().min(1).max(120),
        note: z.string().min(20).max(500),
      }),
    )
    .min(MARKET_NOTE_WATCHLIST_MIN)
    .max(MARKET_NOTE_WATCHLIST_MAX),
  sectorsMd: z.string().min(40).max(2500),
  newsMd: z.string().min(40).max(2500),
  sentimentMd: z.string().min(40).max(1800),
  dates: z
    .array(z.object({ date: z.string().min(3).max(40), label: z.string().min(3).max(160) }))
    .max(12),
});

export type MarketNoteAiDraft = MarketNotePreviewDraft & { subject: string };

/** Keep only radar names the snapshot actually offered. */
export function restrictToRadar<T extends { ticker: string }>(
  items: T[],
  brief: Pick<EditorialBrief, "watchlist">,
): T[] {
  const allowed = new Set(brief.watchlist.map((stock) => stock.ticker.toUpperCase()));
  const seen = new Set<string>();
  return items.filter((item) => {
    const ticker = item.ticker.trim().toUpperCase();
    if (!allowed.has(ticker) || seen.has(ticker)) return false;
    seen.add(ticker);
    return true;
  });
}

function researchBrief(brief: EditorialBrief, today: string): string {
  const names = brief.watchlist
    .map((stock) => `${stock.ticker} (${stock.name ?? "unnamed"}, ${stock.sector ?? "no sector"})`)
    .join("; ");
  return `Today is ${today}. We publish a Monday market note read before the US open.

Find, with sources and dates:
1. The US market backdrop going into this week: how the major indexes closed Friday, what moved rates, and the main worry and the main excitement among investors.
2. The macro calendar for this week: data releases, Fed speakers or meetings, Treasury auctions, with dates.
3. Anything material in the last seven days on these companies: ${names}. Earnings dates and results, guidance, deals, regulatory news.

Keep each finding to a bullet with its source.`;
}

export async function generateMarketNoteDraft(
  brief: EditorialBrief,
  now = new Date(),
): Promise<MarketNoteAiDraft> {
  if (!brief.rating_as_of || brief.watchlist.length < MARKET_NOTE_WATCHLIST_MIN) {
    throw new Error("The scoring snapshot is too thin to draft a market note");
  }
  const client = letterClient();
  const today = now.toISOString().slice(0, 10);
  const research = await researchNotes(client, researchBrief(brief, today));

  const response = await client.messages.parse({
    model: LETTER_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(DraftSchema) },
    system: [
      { type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `Write the Monday market note for the week starting after ${today}.\n\nFACTS:\n${JSON.stringify(brief, null, 2)}\n\nRESEARCH:\n${research}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Model returned no parseable draft (stop_reason: ${response.stop_reason})`,
    );
  }

  const radar = restrictToRadar(parsed.watchlist, brief);
  if (radar.length < MARKET_NOTE_WATCHLIST_MIN) {
    throw new Error(
      `Draft named too few radar names we can use (${radar.length} of ${MARKET_NOTE_WATCHLIST_MIN} needed)`,
    );
  }
  const watchlist = normalizeWatchlist(radar);
  const dates = normalizeDates(parsed.dates);
  const bodyMd =
    composeMarketNoteBodyMd({
      watchlist,
      sectorsMd: parsed.sectorsMd,
      sentimentMd: parsed.sentimentMd,
      newsMd: parsed.newsMd,
      dates,
    }) ?? "";

  return {
    subject: parsed.subject.trim(),
    lede: parsed.lede.trim(),
    watchlist,
    sectorsMd: parsed.sectorsMd.trim(),
    sentimentMd: parsed.sentimentMd.trim(),
    newsMd: parsed.newsMd.trim(),
    dates,
    bodyMd,
  };
}
