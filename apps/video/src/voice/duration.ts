/**
 * Measures a rendered mp3's real duration via `ffprobe`. Kept as its own
 * module — rather than inlined in `render.ts` — so tests can mock it without
 * shelling out, and so it's obvious that this, not a character-count
 * estimate, is the only source of truth `render.ts` uses. Estimating from
 * text length was the tempting shortcut: `eleven_v3` doesn't narrate at a
 * fixed pace, so an estimate would drift the deck's per-scene timing out of
 * sync with the actual voice track, which is exactly the failure mode this
 * pipeline exists to avoid (see DESIGN.md, "Voice").
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function measureDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const value = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(value)) {
    throw new Error(`ffprobe returned a non-numeric duration for ${filePath}: "${stdout.trim()}"`);
  }
  return value;
}
