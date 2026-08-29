/**
 * The `voice` stage: turns `script.json`'s scenes into `audio/*.mp3` plus
 * `audio/manifest.json`, one ElevenLabs request per scene that actually
 * changed since the last run.
 *
 * Ported from `~/Youtube/Library/_tools/generate_voiceover.py`, which does
 * the same job for the rest of the channel roster — per-chunk synthesis,
 * content fingerprinting so an unchanged scene isn't re-billed, a
 * `--dry-run` that reports the plan without spending anything, and a real
 * `ffprobe` duration rather than an estimate. See DESIGN.md, "Voice".
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AudioManifest, Script } from "@/types";

import { measureDurationSec } from "./duration.js";
import { synthesize } from "./elevenlabs.js";
import { fingerprintScene } from "./fingerprint.js";

export interface VoiceOpts {
  apiKey: string;
  voiceId: string;
  model: string;
  outputFormat: string;
  stability: number;
  /** Re-synthesize every scene regardless of fingerprint match. */
  force?: boolean;
  /** Re-synthesize only these 1-based scene numbers, regardless of fingerprint match. */
  forceScenes?: Set<number>;
  /** Compute the plan and print it; call the API and touch disk for nothing. */
  dryRun?: boolean;
}

interface StoredManifest {
  schemaVersion: 1;
  episodeId: string;
  voiceId: string;
  model: string;
  scenes: { id: string; file: string; durationSec: number; fingerprint: string; chars: number }[];
  totalDurationSec: number;
}

function sceneFileName(index: number, sceneId: string): string {
  return `scene-${String(index + 1).padStart(2, "0")}-${sceneId}.mp3`;
}

async function loadExistingManifest(manifestPath: string): Promise<StoredManifest | null> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    return JSON.parse(raw) as StoredManifest;
  } catch {
    // Missing file (first run) or corrupt JSON (interrupted previous write) —
    // either way there is nothing to diff against, so every scene synthesizes.
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function writeManifestAtomically(manifestPath: string, manifest: StoredManifest): Promise<void> {
  const tempPath = `${manifestPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(tempPath, manifestPath);
}

function formatChars(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Renders (or plans, under `--dry-run`) the voiceover for every scene in
 * `script`. `outDir` is the episode's output directory (`out/<episodeId>`,
 * see `src/lib/paths.ts`'s `outDir()`) — this function owns the `audio/`
 * subdirectory and its `manifest.json` underneath it.
 */
export async function renderVoiceover({
  script,
  outDir,
  opts,
}: {
  script: Script;
  outDir: string;
  opts: VoiceOpts;
}): Promise<AudioManifest> {
  const audioOutDir = join(outDir, "audio");
  const manifestPath = join(audioOutDir, "manifest.json");
  const previousManifest = await loadExistingManifest(manifestPath);
  const previousById = new Map(previousManifest?.scenes.map((s) => [s.id, s]) ?? []);

  if (!opts.dryRun) {
    await mkdir(audioOutDir, { recursive: true });
  }

  const rows: {
    id: string;
    file: string;
    absolutePath: string;
    chars: number;
    fingerprint: string;
    forced: boolean;
    cached: boolean;
  }[] = [];

  for (const [index, scene] of script.scenes.entries()) {
    const fileName = sceneFileName(index, scene.id);
    const file = `audio/${fileName}`;
    const absolutePath = join(audioOutDir, fileName);
    const fingerprint = fingerprintScene(scene, opts.voiceId, opts.model, opts.stability);
    const forced = Boolean(opts.force) || Boolean(opts.forceScenes?.has(index + 1));
    const previous = previousById.get(scene.id);
    const onDisk = opts.dryRun ? true : await fileExists(absolutePath);
    const cached = !forced && onDisk && previous?.fingerprint === fingerprint;

    rows.push({
      id: scene.id,
      file,
      absolutePath,
      chars: scene.narration.length,
      fingerprint,
      forced,
      cached,
    });
  }

  if (opts.dryRun) {
    const billableChars = rows.filter((r) => !r.cached).reduce((sum, r) => sum + r.chars, 0);
    const totalChars = rows.reduce((sum, r) => sum + r.chars, 0);

    console.log(`Voice: ${opts.voiceId}`);
    console.log(`Model: ${opts.model}`);
    console.log(`Scenes: ${rows.length}`);
    console.log("");
    for (const row of rows) {
      const status = row.forced ? "forced" : row.cached ? "cached" : "will synthesize";
      console.log(
        `  ${row.file.padEnd(40)} ${formatChars(row.chars).padStart(6)} chars  fp:${row.fingerprint}  [${status}]`,
      );
    }
    console.log("");
    console.log(`Total narration characters: ${formatChars(totalChars)}`);
    console.log(`Billable characters (would synthesize): ${formatChars(billableChars)}`);
    console.log("Dry run complete; no API calls or files written.");

    const scenes = rows.map((row) => ({
      id: row.id,
      file: row.file,
      durationSec: row.cached ? (previousById.get(row.id)?.durationSec ?? 0) : 0,
      fingerprint: row.fingerprint,
      chars: row.chars,
    }));
    return {
      schemaVersion: 1,
      episodeId: script.episodeId,
      voiceId: opts.voiceId,
      model: opts.model,
      scenes,
      totalDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
    };
  }

  const finishedScenes: AudioManifest["scenes"] = [];

  for (const [i, row] of rows.entries()) {
    const scene = script.scenes[i]!;

    if (row.cached) {
      const previous = previousById.get(row.id)!;
      console.log(`[${i + 1}/${rows.length}] Cached: ${row.id}`);
      finishedScenes.push({
        id: row.id,
        file: row.file,
        durationSec: previous.durationSec,
        fingerprint: row.fingerprint,
        chars: row.chars,
      });
    } else {
      console.log(`[${i + 1}/${rows.length}] Synthesizing: ${row.id} (${formatChars(row.chars)} chars)`);
      const audio = await synthesize({
        text: scene.narration,
        voiceId: opts.voiceId,
        apiKey: opts.apiKey,
        model: opts.model,
        outputFormat: opts.outputFormat,
        stability: opts.stability,
      });
      const tempPath = `${row.absolutePath}.part`;
      await writeFile(tempPath, audio);
      await rename(tempPath, row.absolutePath);

      const durationSec = await measureDurationSec(row.absolutePath);
      finishedScenes.push({
        id: row.id,
        file: row.file,
        durationSec,
        fingerprint: row.fingerprint,
        chars: row.chars,
      });
    }

    // Written after every scene, not just at the end, so an interrupted run
    // (rate limit, network drop, Ctrl-C) leaves a manifest that reflects
    // exactly the scenes that were actually synthesized — the next run picks
    // up from there instead of re-billing everything already paid for.
    const manifestSoFar: StoredManifest = {
      schemaVersion: 1,
      episodeId: script.episodeId,
      voiceId: opts.voiceId,
      model: opts.model,
      scenes: finishedScenes,
      totalDurationSec: finishedScenes.reduce((sum, s) => sum + s.durationSec, 0),
    };
    await writeManifestAtomically(manifestPath, manifestSoFar);
  }

  return {
    schemaVersion: 1,
    episodeId: script.episodeId,
    voiceId: opts.voiceId,
    model: opts.model,
    scenes: finishedScenes,
    totalDurationSec: finishedScenes.reduce((sum, s) => sum + s.durationSec, 0),
  };
}
