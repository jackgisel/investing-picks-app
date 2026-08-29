/**
 * Turns a `Pack` into a `Script` by prompting Claude, following the same
 * shape as `apps/web/src/lib/weekly-review-draft.ts`: the Anthropic SDK,
 * `client.messages.parse` with a zod output format, prompt caching on the
 * system block, adaptive thinking, and high effort.
 *
 * This machine isn't guaranteed to have `ANTHROPIC_API_KEY` set — the video
 * pipeline only ever runs on Jack's Mac, and the `claude` CLI there is
 * already authenticated — so when the key is absent, `generateScript` shells
 * out to `claude -p ... --output-format json` instead and parses the
 * structured result out of its envelope. Both paths are validated through
 * the same zod schema before anything downstream sees the result, so a
 * malformed generation fails loudly here rather than silently reaching the
 * gate with garbage.
 */

import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Pack, Script } from "@/types";
import { env } from "@/lib/env";
import { buildSystemPrompt } from "./prompt";

const MODEL = "claude-opus-5";

// The user's machine has `claude` at this fixed path and it's already
// authenticated — see the chunk brief. Not read from PATH, because a `-p`
// shell-out shouldn't depend on the invoking shell's PATH having resolved
// the same binary a human's interactive shell would.
const CLAUDE_CLI_PATH = "/Users/jackgisel/.local/bin/claude";

// Headless generation has no reason to touch the filesystem, run shell
// commands, or reach the network beyond the model call itself — the whole
// pack is already in the prompt. Disallowing tool use keeps the CLI path a
// pure text-in/JSON-out call instead of an agent that might go exploring.
const DISALLOWED_TOOLS = [
  "Bash",
  "Edit",
  "Write",
  "Read",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
  "Agent",
  "Artifact",
  "TodoWrite",
  "ExitPlanMode",
];

const AccentSchema = z.enum(["mint", "cyan", "lilac", "peach", "yellow"]);

const StatItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  sub: z.string().min(1).optional(),
  tone: z.enum(["up", "down", "neutral"]).optional(),
});

// Mirrors `SlideSpec` from `src/types.ts` field for field. `picksChart`,
// `periodBars`, `holdings`, and `sectors` deliberately carry no data fields
// beyond heading/caption/limit — those slides render straight from the
// pack, and giving the model a place to put numbers there would invite it
// to invent ones nobody checks.
const SlideSpecSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("title"),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    periodLabel: z.string().min(1),
  }),
  z.object({
    type: z.literal("stat"),
    heading: z.string().min(1),
    stats: z.array(StatItemSchema).min(1).max(4),
  }),
  z.object({
    type: z.literal("picksChart"),
    heading: z.string().min(1),
    caption: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("periodBars"),
    heading: z.string().min(1),
    caption: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("holdings"),
    heading: z.string().min(1),
    caption: z.string().min(1).optional(),
    limit: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("sectors"),
    heading: z.string().min(1),
    caption: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("watchlist"),
    heading: z.string().min(1),
    caption: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("events"),
    heading: z.string().min(1),
    items: z.array(z.object({ label: z.string().min(1), detail: z.string().min(1) })).min(1),
  }),
  z.object({
    type: z.literal("bullets"),
    heading: z.string().min(1),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("quote"),
    text: z.string().min(1),
    attribution: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("outro"),
    heading: z.string().min(1),
    lines: z.array(z.string().min(1)).min(1),
  }),
]);

const SceneSchema = z.object({
  id: z.string().min(1),
  chapter: z.string().min(1),
  accent: AccentSchema,
  narration: z.string().min(1),
  slide: SlideSpecSchema,
});

export const ScriptSchema = z.object({
  schemaVersion: z.literal(1),
  episodeId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  scenes: z.array(SceneSchema).min(1),
});

/**
 * The user message: the pack's facts and source, and nothing else.
 * `pack.redaction` is deliberately excluded — it names the embargoed ticker
 * and company outright, and the whole point of `pack` stripping those
 * before this stage runs is that the model never sees them at all. Every
 * figure the model needs is already reachable in `facts`/`source`, so
 * leaving `redaction` out costs it nothing.
 */
function buildUserPrompt(pack: Pack): string {
  const payload = {
    episodeId: pack.episodeId,
    kind: pack.kind,
    asOf: pack.asOf,
    periodLabel: pack.periodLabel,
    source: pack.source,
    facts: pack.facts,
  };
  return `Write the script for this episode from the pack below. Use "${pack.episodeId}" as the episodeId in your output.\n\nPACK:\n${JSON.stringify(payload, null, 2)}`;
}

async function generateViaApi(pack: Pack, apiKey: string): Promise<Script> {
  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(ScriptSchema),
      },
      system: [
        {
          type: "text",
          text: buildSystemPrompt(pack.kind),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(pack) }],
    });
  } catch (err) {
    throw new Error(
      `[script] Anthropic API generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `[script] Anthropic API generation returned no parseable script (stop_reason: ${response.stop_reason})`,
    );
  }
  return parsed;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

// The API path gets exact-shape enforcement for free from `zodOutputFormat`
// (the SDK turns the zod schema into the model's structured-output schema
// directly). The CLI path has no such mechanism — `claude -p` just returns
// text — so the schema is spelled out in the prompt instead. Without it, a
// scene meant to be a `stat` slide can drift toward the `items` shape a
// nearby `bullets`/`events` slide uses, which is exactly the kind of error
// this is here to prevent.
const CLI_SCHEMA_BLOCK = `## Required JSON Schema
Your response must be a single JSON object that validates against this JSON Schema exactly — field names, types, and which fields belong to which \`slide.type\` variant all matter. Do not add fields that aren't listed for the variant you're using, and do not omit required ones.

\`\`\`json
${JSON.stringify(z.toJSONSchema(ScriptSchema), null, 2)}
\`\`\``;

const MAX_CLI_ATTEMPTS = 2;

function runClaudeCli(systemPrompt: string, userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      CLAUDE_CLI_PATH,
      [
        "-p",
        userPrompt,
        "--output-format",
        "json",
        "--model",
        MODEL,
        "--effort",
        "high",
        "--system-prompt",
        systemPrompt,
        "--strict-mcp-config",
        "--disallowedTools",
        ...DISALLOWED_TOOLS,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      reject(new Error(`could not launch ${CLAUDE_CLI_PATH}: ${err.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${(stderr || stdout).slice(0, 2000)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function generateViaCli(pack: Pack): Promise<Script> {
  const systemPrompt = `${buildSystemPrompt(pack.kind)}\n\n${CLI_SCHEMA_BLOCK}`;
  const basePrompt = buildUserPrompt(pack);

  let lastFailure: string | null = null;

  for (let attempt = 1; attempt <= MAX_CLI_ATTEMPTS; attempt++) {
    // A repair pass on attempt 2: same facts, plus the previous attempt's
    // validation errors, asked to return a corrected object. Each `-p` call
    // is a fresh session, so the errors are handed back explicitly rather
    // than relied on to still be "in context."
    const userPrompt = lastFailure
      ? `${basePrompt}\n\nYour previous response failed schema validation:\n${lastFailure}\n\nReturn a corrected JSON object only — no commentary, no markdown fences.`
      : basePrompt;

    let stdout: string;
    try {
      stdout = await runClaudeCli(systemPrompt, userPrompt);
    } catch (err) {
      throw new Error(
        `[script] claude CLI generation failed (${CLAUDE_CLI_PATH}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let envelope: { is_error?: boolean; result?: string; subtype?: string };
    try {
      envelope = JSON.parse(stdout);
    } catch (err) {
      throw new Error(
        `[script] claude CLI generation failed: could not parse CLI envelope as JSON (${err instanceof Error ? err.message : String(err)}). Raw output: ${stdout.slice(0, 500)}`,
      );
    }

    if (envelope.is_error || typeof envelope.result !== "string") {
      throw new Error(
        `[script] claude CLI generation failed: subtype=${envelope.subtype ?? "unknown"}, result=${envelope.result ?? "(none)"}`,
      );
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(extractJsonText(envelope.result));
    } catch (err) {
      throw new Error(
        `[script] claude CLI generation failed: model output was not valid JSON (${err instanceof Error ? err.message : String(err)}). Output: ${envelope.result.slice(0, 500)}`,
      );
    }

    const result = ScriptSchema.safeParse(candidate);
    if (result.success) return result.data;

    lastFailure = result.error.message;
    if (attempt === MAX_CLI_ATTEMPTS) {
      throw new Error(
        `[script] claude CLI generation failed after ${MAX_CLI_ATTEMPTS} attempts: output did not match the Script schema: ${lastFailure}`,
      );
    }
  }

  // Unreachable: the loop above always either returns or throws.
  throw new Error("[script] claude CLI generation failed: exhausted attempts unexpectedly");
}

/**
 * Generates the script for a pack. Prefers the Anthropic API when
 * `ANTHROPIC_API_KEY` is configured in `.env.local`; falls back to shelling
 * out to the local `claude` CLI otherwise. `env.ANTHROPIC_API_KEY()` throws
 * rather than returning undefined when the key is unset — that's the
 * signal used here to pick the fallback path without duplicating
 * `src/lib/env.ts`'s parsing.
 */
export async function generateScript(pack: Pack): Promise<Script> {
  let apiKey: string | undefined;
  try {
    apiKey = env.ANTHROPIC_API_KEY();
  } catch {
    apiKey = undefined;
  }

  if (apiKey) {
    return generateViaApi(pack, apiKey);
  }
  return generateViaCli(pack);
}
