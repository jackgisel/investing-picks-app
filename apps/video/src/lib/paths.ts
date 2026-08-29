/**
 * Every path the pipeline reads or writes, in one place. Each stage only
 * needs an `episodeId` to find its inputs and outputs — nothing here talks
 * to the filesystem beyond `mkdir`, so a stage can be re-run against an
 * episode's existing `out/` directory without any other stage having run in
 * the same process.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// `apps/video/src/lib/paths.ts` -> `apps/video/`, independent of cwd — the
// CLI can be invoked from the repo root or from inside apps/video and the
// out/ directory still lands in the same place either way.
const videoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function outDir(episodeId: string): string {
  return join(videoRoot, "out", episodeId);
}

export function packPath(episodeId: string): string {
  return join(outDir(episodeId), "pack.json");
}

export function scriptPath(episodeId: string): string {
  return join(outDir(episodeId), "script.json");
}

export function audioDir(episodeId: string): string {
  return join(outDir(episodeId), "audio");
}

export function audioManifestPath(episodeId: string): string {
  return join(audioDir(episodeId), "manifest.json");
}

export function videoPath(episodeId: string): string {
  return join(outDir(episodeId), "video.mp4");
}

/** Creates a directory (and any missing parents) if it does not already exist. */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}
