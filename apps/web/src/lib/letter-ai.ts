import Anthropic from "@anthropic-ai/sdk";
import { HOUSE_WRITING_RULES } from "@/lib/content-draft";

/**
 * Shared plumbing for the free letters, which are written by the model and
 * reviewed by a person. Nothing here sends anything: every caller saves a draft
 * and leaves it unconfirmed.
 *
 * Two steps on purpose. Research runs first with live web search and returns
 * plain notes with sources. The draft step then sees only those notes and our
 * own facts, with no tools, so it can be held to "every number appears in the
 * payload or the notes".
 */

export const LETTER_MODEL = "claude-opus-5-5";

const MAX_PAUSES = 6;

export function letterClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
  }
  return new Anthropic({ apiKey });
}

const RESEARCH_SYSTEM = `You are the research desk for a free weekly stock-research email. You are given a topic and a set of facts from our own system. Use web search to find what a careful reader would want to know before writing about it.

Return plain notes, not prose for publication:
- One bullet per finding. Each bullet states the fact, the date it applies to, and the source name and URL.
- Prefer primary sources (company filings and releases, the Fed, BLS, Treasury, exchanges) and major news wires over blogs.
- Mark anything you could not confirm as UNCONFIRMED. Never fill a gap from memory.
- Do not give investment advice, price targets, or opinions. Facts and dates only.
- Keep to what is current for the period you are given. Skip stale stories.`;

/**
 * Run a web-search research pass and return the notes as text.
 * `pause_turn` is the server telling us the search loop needs another turn.
 */
export async function researchNotes(
  client: Anthropic,
  brief: string,
  maxSearches = 8,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: brief }];

  for (let turn = 0; turn <= MAX_PAUSES; turn += 1) {
    const stream = client.messages.stream({
      model: LETTER_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: RESEARCH_SYSTEM,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: maxSearches },
      ],
      messages,
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") {
      throw new Error("Research step was declined by the model");
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Research step returned no notes");
    return text;
  }
  throw new Error("Research step did not finish");
}

/** Rules every free letter shares, appended to each letter's own guide. */
export const LETTER_COMMON_RULES = `## Facts and sourcing
- Our own numbers (ratings, returns, dates, counts) come only from the FACTS payload. Do not round them into a different claim.
- Outside facts come only from the RESEARCH notes. Never use a fact marked UNCONFIRMED, and never add one from memory.
- Every number you cite must appear in FACTS or RESEARCH. If you want a figure you were not given, write around it.
- Never state or imply an Outpick price target. Third-party analyst targets may be cited as context only when RESEARCH contains them.
- No urgency, hype, or second-person exhortation ("you should buy", "don't miss"). The reader is deciding for themselves.
- Say plainly where something is weak, down, or uncertain. A letter that argues one side is worse than none.
- Name the source in prose when you cite an outside fact ("the Labor Department said"). No footnotes, no bare URLs.
- No headings beyond H2. No images. No code fences. Plain markdown only.

${HOUSE_WRITING_RULES}`;
