import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SITE_NAME } from "@/lib/constants";
import { HOUSE_WRITING_RULES } from "@/lib/content-draft";
import { LETTER_MODEL, letterClient } from "@/lib/letter-ai";

/**
 * Short model-written copy: alert paragraphs, social captions, drafts for the
 * admin pages. No web research here; the model sees only the facts it is given.
 *
 * Output that reaches subscribers without a person in the loop (alerts, queued
 * captions) goes through `numbersGrounded` and `looksClean`. When either fails,
 * or the model is unavailable, `writeShort` returns null and the caller keeps
 * its template. A template line is better than an invented figure.
 */

const SHORT_RULES = `## Rules
- Use only the numbers in FACTS. Never add, derive, or round a number into a different claim. Do not write dates.
- No urgency, hype, advice, or price targets. Report what happened.
- State the downside as plainly as the upside.

${HOUSE_WRITING_RULES}`;

const TextSchema = z.object({ text: z.string().min(1).max(2000) });

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

function numbersIn(text: string): number[] {
  return (text.match(NUMBER) ?? [])
    .map((n) => Number(n.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

/** Every number in `text` must appear in `facts`, allowing rounding and sign. */
export function numbersGrounded(text: string, facts: unknown): boolean {
  const allowed = new Set<number>();
  for (const n of numbersIn(JSON.stringify(facts))) {
    for (const digits of [0, 1, 2]) {
      allowed.add(Number(n.toFixed(digits)));
    }
    allowed.add(n);
  }
  return numbersIn(text).every((n) => allowed.has(n));
}

/** House rules a checker can enforce: no dashes as punctuation. */
export function looksClean(text: string): boolean {
  return !/[—–]|--/.test(text);
}

export type ShortArgs = {
  /** What the piece is and who reads it, one or two sentences. */
  role: string;
  /** The exact ask, including length. */
  ask: string;
  facts: unknown;
  /** Require every number to come from `facts`. Default true. */
  grounded?: boolean;
  maxChars?: number;
};

/** Returns the copy, or null when the model is unavailable or the output fails the checks. */
export async function writeShort(args: ShortArgs): Promise<string | null> {
  try {
    const client = letterClient();
    const response = await client.messages.parse({
      model: LETTER_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(TextSchema) },
      system: [
        {
          type: "text",
          text: `You write for ${SITE_NAME}, a stock-research publication. ${args.role}\n\n${SHORT_RULES}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `${args.ask}\n\nFACTS:\n${JSON.stringify(args.facts, null, 2)}`,
        },
      ],
    });
    const text = response.parsed_output?.text.trim();
    if (!text) return null;
    if (args.maxChars && text.length > args.maxChars) return null;
    if (!looksClean(text)) return null;
    if (args.grounded !== false && !numbersGrounded(text, args.facts)) return null;
    return text;
  } catch {
    return null;
  }
}

/** Add a one-sentence model read under a templated social caption. */
export async function withAiRead(
  caption: string,
  facts: unknown,
  limit = 280,
): Promise<string> {
  const room = limit - caption.length - 2;
  if (room < 40) return caption;
  const read = await writeShort({
    role: "You add one line under a data graphic caption on X.",
    ask: `Write one sentence of at most ${Math.min(room, 160)} characters that says what the figures in the caption mean for the business. Do not repeat the caption. Do not use hashtags or emoji. CAPTION:\n${caption}`,
    facts: { caption, ...(typeof facts === "object" && facts ? facts : {}) },
    maxChars: room,
  });
  return read ? `${caption}\n\n${read}` : caption;
}
