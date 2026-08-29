/**
 * `pnpm episode voices`
 *
 * Lists the ElevenLabs account's voices as a table, so the operator can pick
 * one for `OUTPICK_ELEVENLABS_VOICE_ID` (or a one-off `--voice=` override)
 * without guessing an id blind. Requires only `ELEVENLABS_API_KEY` — no
 * episode, no voice id, since the whole point is to find one.
 */

import { env } from "@/lib/env";
import { listVoices } from "@/voice/elevenlabs";

const LABEL_KEYS = ["accent", "age", "gender", "use_case", "descriptive"] as const;

function labelSummary(labels: Record<string, string>): string {
  return LABEL_KEYS.map((key) => labels[key])
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

export async function run(_args: string[]): Promise<void> {
  const apiKey = env.ELEVENLABS_API_KEY();
  const voices = await listVoices(apiKey);

  if (voices.length === 0) {
    console.log("No voices found on this account.");
    return;
  }

  const idWidth = Math.max(...voices.map((v) => v.id.length), "id".length);
  const nameWidth = Math.max(...voices.map((v) => v.name.length), "name".length);
  const categoryWidth = Math.max(...voices.map((v) => v.category.length), "category".length);

  const header = `${"id".padEnd(idWidth)}  ${"name".padEnd(nameWidth)}  ${"category".padEnd(categoryWidth)}  labels`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const voice of voices) {
    console.log(
      `${voice.id.padEnd(idWidth)}  ${voice.name.padEnd(nameWidth)}  ${voice.category.padEnd(categoryWidth)}  ${labelSummary(voice.labels)}`,
    );
  }
  console.log("");
  console.log(`${voices.length} voice(s).`);
}
