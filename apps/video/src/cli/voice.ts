/**
 * `pnpm episode voice --episode=<id> [--dry-run] [--force] [--force-scenes=1,3] [--voice=<id>]`
 *
 * Synthesizes `out/<episodeId>/audio/*.mp3` and `audio/manifest.json` from
 * that episode's `script.json`. See `src/voice/render.ts` for the actual
 * synthesis/skip logic and DESIGN.md's "Voice" section for the design.
 */

import { readFile } from "node:fs/promises";

import type { Script } from "@/types";
import { outDir, scriptPath } from "@/lib/paths";
import { env } from "@/lib/env";

import { parseForceScenes } from "@/voice/opts";
import { renderVoiceover } from "@/voice/render";

const MODEL = "eleven_v3";
const OUTPUT_FORMAT = "mp3_44100_128";
const STABILITY = 1;

interface VoiceFlags {
  episode: string | null;
  dryRun: boolean;
  force: boolean;
  forceScenes: Set<number> | null;
  voiceOverride: string | null;
}

function parseVoiceFlags(args: string[]): VoiceFlags {
  const flags: VoiceFlags = {
    episode: null,
    dryRun: false,
    force: false,
    forceScenes: null,
    voiceOverride: null,
  };

  for (const arg of args) {
    if (arg.startsWith("--episode=")) {
      flags.episode = arg.slice("--episode=".length);
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--force") {
      flags.force = true;
    } else if (arg.startsWith("--force-scenes=")) {
      flags.forceScenes = parseForceScenes(arg.slice("--force-scenes=".length));
    } else if (arg.startsWith("--voice=")) {
      flags.voiceOverride = arg.slice("--voice=".length);
    }
    // Unrecognized flags (e.g. --kind=, --as-of=) are ignored here — they
    // were already validated by the global dispatcher in cli/index.ts and
    // this stage doesn't need them.
  }

  return flags;
}

/**
 * Resolves which ElevenLabs voice narrates this episode: `--voice=` first,
 * then `OUTPICK_ELEVENLABS_VOICE_ID`. Deliberately no further fallback — a
 * silent default once narrated an entire channel in another channel's voice
 * (see the comment on `resolve_voice_id` in
 * `~/Youtube/Library/_tools/generate_voiceover.py`), and this pipeline would
 * rather fail loudly here than ship that mistake into a rendered video.
 */
function resolveVoiceId(override: string | null): string {
  if (override) return override;
  try {
    return env.OUTPICK_ELEVENLABS_VOICE_ID();
  } catch {
    throw new Error(
      [
        "No ElevenLabs voice id set.",
        "Pass --voice=<id>, or set OUTPICK_ELEVENLABS_VOICE_ID in apps/video/.env.local.",
        "Run `pnpm episode voices` to list the account's voices, or listen to the",
        "candidates already recorded in apps/video/out/voice-samples/ and pick one.",
        "There is deliberately no fallback voice.",
      ].join("\n"),
    );
  }
}

export async function run(args: string[]): Promise<void> {
  const flags = parseVoiceFlags(args);

  if (!flags.episode) {
    console.error("voice requires --episode=<id>");
    process.exit(1);
  }

  let voiceId: string;
  try {
    voiceId = resolveVoiceId(flags.voiceOverride);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const apiKey = env.ELEVENLABS_API_KEY();

  const episodeScriptPath = scriptPath(flags.episode);
  let script: Script;
  try {
    script = JSON.parse(await readFile(episodeScriptPath, "utf8")) as Script;
  } catch (err) {
    console.error(`Could not read ${episodeScriptPath}: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Run `pnpm episode script --episode=<id>` first.");
    process.exit(1);
    return;
  }

  const manifest = await renderVoiceover({
    script,
    outDir: outDir(flags.episode),
    opts: {
      apiKey,
      voiceId,
      model: MODEL,
      outputFormat: OUTPUT_FORMAT,
      stability: STABILITY,
      force: flags.force,
      forceScenes: flags.forceScenes ?? undefined,
      dryRun: flags.dryRun,
    },
  });

  if (!flags.dryRun) {
    const minutes = Math.floor(manifest.totalDurationSec / 60);
    const seconds = Math.round(manifest.totalDurationSec % 60);
    console.log(`Wrote ${manifest.scenes.length} scenes, ${minutes}m${String(seconds).padStart(2, "0")}s total.`);
  }
}
