/**
 * `pnpm episode render --episode=<id> [--concurrency=<n|n%>] [--quality=<1-100>]`
 *
 * Renders `out/<episodeId>/video.mp4` from that episode's `pack.json`,
 * `script.json`, and (if it exists) `audio/manifest.json`, via the `Deck`
 * composition in `src/remotion/`. See DESIGN.md's "render" stage and
 * `src/remotion/timeline.ts`'s `buildTimeline`, which this and the
 * composition both use so the video is sized identically either way.
 *
 * `audio/manifest.json` is optional on purpose: being able to preview the
 * deck's animation and slide timing before spending ElevenLabs characters on
 * narration is the whole point of keeping `render` a separate, cheap,
 * infinitely-repeatable stage (DESIGN.md, "Why a pipeline of files"). When
 * it's missing, every scene falls back to `buildTimeline`'s word-count
 * estimate at `FALLBACK_WORDS_PER_MINUTE` and the render is silent.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import type { AudioManifest, DeckProps, Pack, Script } from "@/types";
import { audioManifestPath, ensureDir, outDir, packPath, scriptPath, videoPath } from "@/lib/paths";
import { VIDEO } from "@/theme";
import { FALLBACK_WORDS_PER_MINUTE } from "@/remotion/timeline";

interface RenderFlags {
  episode: string | null;
  concurrency: string | number | null;
  jpegQuality: number | null;
}

function parseRenderFlags(args: string[]): RenderFlags {
  const flags: RenderFlags = { episode: null, concurrency: null, jpegQuality: null };
  for (const arg of args) {
    if (arg.startsWith("--episode=")) {
      flags.episode = arg.slice("--episode=".length);
    } else if (arg.startsWith("--concurrency=")) {
      const raw = arg.slice("--concurrency=".length);
      flags.concurrency = raw.endsWith("%") ? raw : Number(raw);
    } else if (arg.startsWith("--quality=")) {
      const raw = Number(arg.slice("--quality=".length));
      if (!Number.isFinite(raw) || raw < 1 || raw > 100) {
        throw new Error(`--quality must be a number from 1-100 (got "${arg.slice("--quality=".length)}")`);
      }
      flags.jpegQuality = raw;
    }
    // Unrecognized flags (e.g. --kind=, --as-of=) were already validated by
    // the global dispatcher in cli/index.ts and aren't needed here.
  }
  return flags;
}

async function readJson<T>(path: string, hint: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (err) {
    console.error(`Could not read ${path}: ${err instanceof Error ? err.message : String(err)}`);
    console.error(hint);
    process.exit(1);
    throw err; // unreachable, keeps TypeScript's control-flow analysis happy
  }
}

/**
 * An empty manifest makes `buildTimeline` (shared with the composition
 * itself) estimate every scene's duration from its narration's word count
 * instead of throwing — see `src/remotion/timeline.ts`.
 */
function silentAudioManifest(episodeId: string): AudioManifest {
  return {
    schemaVersion: 1,
    episodeId,
    voiceId: "",
    model: "",
    scenes: [],
    totalDurationSec: 0,
  };
}

function formatProgress(label: string, progress: number): string {
  const pct = Math.round(progress * 100);
  const barWidth = 24;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = "#".repeat(filled) + "-".repeat(barWidth - filled);
  return `[${bar}] ${String(pct).padStart(3)}% ${label}`;
}

export async function run(args: string[]): Promise<void> {
  const flags = parseRenderFlags(args);

  if (!flags.episode) {
    console.error("render requires --episode=<id>");
    process.exit(1);
    return;
  }

  const episode = flags.episode;

  const pack = await readJson<Pack>(packPath(episode), "Run `pnpm episode pack --episode=<id>` first.");
  const script = await readJson<Script>(
    scriptPath(episode),
    "Run `pnpm episode script --episode=<id>` first.",
  );

  const episodeAudioManifestPath = audioManifestPath(episode);
  let audio: AudioManifest;
  let silent: boolean;
  if (existsSync(episodeAudioManifestPath)) {
    audio = await readJson<AudioManifest>(episodeAudioManifestPath, "");
    silent = false;
  } else {
    audio = silentAudioManifest(episode);
    silent = true;
    console.log(
      `No audio/manifest.json found for ${episode} — rendering SILENT, with scene durations estimated ` +
        `at ${FALLBACK_WORDS_PER_MINUTE} words per minute. Run \`pnpm episode voice --episode=${episode}\` ` +
        "and re-render for narrated output.",
    );
  }

  await ensureDir(outDir(episode));

  console.log("Bundling the Remotion composition...");
  const entryPoint = new URL("../remotion/index.ts", import.meta.url).pathname;
  const serveUrl = await bundle({
    entryPoint,
    // Scenes reference their audio as `audio/<file>.mp3`, relative to the
    // episode's out/ directory (see `src/voice/render.ts`'s `sceneFileName`
    // / manifest `file` field) — pointing the bundle's public dir at that
    // directory is what makes `staticFile(scene.file)` in `Deck.tsx`
    // resolve to the right mp3 without copying anything.
    publicDir: outDir(episode),
    onProgress: (progress) => {
      process.stdout.write(`\r${formatProgress("bundling", progress / 100)}`);
    },
  });
  process.stdout.write("\n");

  const inputProps: DeckProps = { pack, script, audio };

  console.log("Resolving the Deck composition...");
  const composition = await selectComposition({
    serveUrl,
    id: "Deck",
    inputProps: inputProps as unknown as Record<string, unknown>,
  });

  const outputLocation = videoPath(episode);
  console.log(
    `Rendering ${composition.durationInFrames} frames at ${composition.width}x${composition.height}` +
      `@${composition.fps}fps${silent ? " (silent)" : ""} -> ${outputLocation}`,
  );

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps: inputProps as unknown as Record<string, unknown>,
    concurrency: flags.concurrency,
    jpegQuality: flags.jpegQuality ?? undefined,
    onProgress: ({ renderedFrames, encodedFrames, progress, stitchStage }) => {
      const label =
        stitchStage === "muxing"
          ? "muxing"
          : `rendered ${renderedFrames}/${composition.durationInFrames} frames, encoded ${encodedFrames}`;
      process.stdout.write(`\r${formatProgress(label, progress)}`);
    },
  });
  process.stdout.write("\n");

  console.log(`Wrote ${outputLocation}`);
  if (composition.width !== VIDEO.width || composition.height !== VIDEO.height) {
    console.warn(
      `Warning: rendered at ${composition.width}x${composition.height}, expected ${VIDEO.width}x${VIDEO.height}.`,
    );
  }
}
