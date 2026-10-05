import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SITE_NAME } from "@/lib/constants";
import { HOUSE_WRITING_RULES } from "@/lib/content-draft";
import { fetchHeldTickers } from "@/lib/held-tickers";
import { LETTER_MODEL, letterClient, researchNotes } from "@/lib/letter-ai";
import { looksClean } from "@/lib/short-copy";

/**
 * First drafts for the pages a person writes into: product update emails and
 * X campaign copy. Always returned to the editor for review, never saved as
 * sent, never scheduled.
 */

const UpdateSchema = z.object({
  subject: z.string().min(5).max(120),
  bodyMd: z.string().min(80).max(6000),
});

export async function draftProductUpdate(
  notes: string,
): Promise<z.infer<typeof UpdateSchema>> {
  const client = letterClient();
  const response = await client.messages.parse({
    model: LETTER_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(UpdateSchema) },
    system: [
      {
        type: "text",
        text: `You write product update emails for ${SITE_NAME}, a stock-research subscription. The reader is a member who wants to know what changed and why it matters to them.

## Rules
- Use only what is in NOTES. Do not invent features, dates, numbers or benefits.
- Lead with the change that matters most. Short paragraphs, plain language, no marketing voice.
- Markdown with ## headings, - bullets, **bold** and [links](url) only. About 150 to 300 words.
- subject: specific, under 70 characters.
- No investment advice and no performance claims.

${HOUSE_WRITING_RULES}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: `NOTES:\n${notes}` }],
  });
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(`Model returned no parseable draft (stop_reason: ${response.stop_reason})`);
  }
  if (!looksClean(parsed.subject) || !looksClean(parsed.bodyMd)) {
    throw new Error("Draft broke the dash rule. Redraft.");
  }
  return { subject: parsed.subject.trim(), bodyMd: parsed.bodyMd.trim() };
}

const CampaignSchema = z.object({
  posts: z.array(z.string().min(20).max(280)).min(1).max(10),
});

export async function draftCampaign(
  topic: string,
  thread: boolean,
): Promise<{ posts: string[] }> {
  const client = letterClient();
  const research = await researchNotes(
    client,
    `Research for an X post about: ${topic}. Find, with sources and dates, the company-reported facts and figures that matter, and the other companies in the same supply chain. Facts only.`,
    5,
  );
  const response = await client.messages.parse({
    model: LETTER_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(CampaignSchema) },
    system: [
      {
        type: "text",
        text: `You write X posts for ${SITE_NAME}, a stock-research publication.

## Style
- Plain, specific, dry. Concrete nouns. Cashtags like $MOD for tickers.
- Name companies in a supply chain, not stocks to buy. These names are not holdings and never a recommendation. Say so when it is not obvious ("Supply chain, not a book entry").
- Each post is 280 characters or fewer. ${thread ? "Write a thread of 4 to 8 posts. The first post must stand alone." : "Write a single post."}
- Every figure must come from RESEARCH and be described as company-reported. No price targets, no urgency, no emoji, no hashtags.

${HOUSE_WRITING_RULES}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user", content: `TOPIC: ${topic}\n\nRESEARCH:\n${research}` },
    ],
  });
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(`Model returned no parseable draft (stop_reason: ${response.stop_reason})`);
  }
  const posts = parsed.posts.map((p) => p.trim());
  if (!posts.every(looksClean)) throw new Error("Draft broke the dash rule. Redraft.");

  const held = await fetchHeldTickers();
  if (!held) throw new Error("Could not check the book, so a holding might slip into the copy.");
  const hit = posts
    .flatMap((p) => p.match(/\$[A-Za-z]{1,6}/g) ?? [])
    .map((t) => t.slice(1).toUpperCase())
    .find((t) => held.has(t));
  if (hit) throw new Error(`${hit} is in the book. Campaign copy is for names we do not hold. Redraft.`);
  return { posts };
}
