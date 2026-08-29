/**
 * `pnpm episode make --kind=<kind> [--as-of=...] [--week=...] [--from-file=...]
 *   [--episode=<id>] [--skip-voice] [--force] [--concurrency=...] [--quality=...]`
 *
 * Runs `pack -> script -> voice -> render` for one episode. `gate` isn't
 * called separately here — `cli/script.ts` already runs it on the generated
 * script and refuses to write `script.json` on a failure, so a gate failure
 * surfaces as a failed `script` stage.
 *
 * Resumable stage by stage, because `script` spends Anthropic tokens and
 * `voice` spends ElevenLabs characters: each stage is skipped, with a
 * `skipped (cached)` line naming the path, when its artifact already exists
 * and neither `--force` nor an upstream cache miss forces it to rerun. That
 * last part matters — if `pack` or `script` actually rebuilds (not a cache
 * hit), every stage after it reruns too even if its own artifact happens to
 * still be sitting on disk, because that artifact was built from an input
 * that just changed underneath it. `--force` short-circuits all of this and
 * rebuilds everything.
 *
 * `--skip-voice` skips the `voice` stage outright (not just when cached) and
 * `render` falls through to its own silent, word-count-estimated path — see
 * `cli/render.ts`. That's the fast, free way to preview a deck's slides and
 * timing before spending ElevenLabs characters on it.
 */

import { existsSync } from "node:fs";

import { audioManifestPath, packPath, scriptPath, videoPath } from "@/lib/paths";
import { measureDurationSec } from "@/voice/duration";

import { run as packRun } from "./pack.js";
import { run as scriptRun } from "./script.js";
import { run as voiceRun } from "./voice.js";
import { run as renderRun } from "./render.js";

interface MakeFlags {
  kind: string | null;
  asOf: string | null;
  week: string | null;
  fromFile: string | null;
  episode: string | null;
  skipVoice: boolean;
  force: boolean;
  /** Raw `--concurrency=...` arg, forwarded to `render` verbatim. */
  concurrencyArg: string | null;
  /** Raw `--quality=...` arg, forwarded to `render` verbatim. */
  qualityArg: string | null;
}

function parseMakeFlags(args: string[]): MakeFlags {
  const flags: MakeFlags = {
    kind: null,
    asOf: null,
    week: null,
    fromFile: null,
    episode: null,
    skipVoice: false,
    force: false,
    concurrencyArg: null,
    qualityArg: null,
  };
  for (const arg of args) {
    if (arg.startsWith("--kind=")) flags.kind = arg.slice("--kind=".length);
    else if (arg.startsWith("--as-of=")) flags.asOf = arg.slice("--as-of=".length);
    else if (arg.startsWith("--week=")) flags.week = arg.slice("--week=".length);
    else if (arg.startsWith("--from-file=")) flags.fromFile = arg.slice("--from-file=".length);
    else if (arg.startsWith("--episode=")) flags.episode = arg.slice("--episode=".length);
    else if (arg === "--skip-voice") flags.skipVoice = true;
    else if (arg === "--force") flags.force = true;
    else if (arg.startsWith("--concurrency=")) flags.concurrencyArg = arg;
    else if (arg.startsWith("--quality=")) flags.qualityArg = arg;
  }
  return flags;
}

function buildPackArgv(flags: MakeFlags): string[] {
  const argv: string[] = [`--kind=${flags.kind}`];
  if (flags.asOf) argv.push(`--as-of=${flags.asOf}`);
  if (flags.week) argv.push(`--week=${flags.week}`);
  if (flags.fromFile) argv.push(`--from-file=${flags.fromFile}`);
  // Pin the output at the caller-requested episode id (rather than whatever
  // id `buildPack` would derive from kind/week on its own) so an existing
  // `--episode=` directory is the one that gets (re)written.
  if (flags.episode) argv.push(`--out=${packPath(flags.episode)}`);
  if (flags.force) argv.push("--force");
  return argv;
}

function fmtElapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m${String(s).padStart(2, "0")}s`;
}

function banner(label: string): void {
  console.log(`\n=== ${label} ===`);
}

function stageDone(label: string, startedAt: number): void {
  console.log(`[make] ${label}: ${fmtElapsed(Date.now() - startedAt)}`);
}

export async function run(args: string[]): Promise<void> {
  const flags = parseMakeFlags(args);

  if (!flags.kind && !flags.episode) {
    console.error("[make] requires --kind=<market-note|weekly-review> (or --episode=<existing id>)");
    process.exit(1);
    return;
  }

  const pipelineStart = Date.now();
  console.log(
    `[make] ${flags.episode ?? flags.kind}${flags.skipVoice ? " (silent preview — no voice)" : ""}`,
  );

  // Once anything upstream actually rebuilds (not a cache hit), everything
  // downstream has to rebuild too, regardless of whether its own file is
  // still sitting on disk — that file was built from an input that just
  // changed. `--force` starts the whole run in this state.
  let dirty = flags.force;
  let episodeId: string;

  // ---------------------------------------------------------------- pack --
  {
    banner("pack");
    const start = Date.now();
    const cachedPath = flags.episode ? packPath(flags.episode) : null;
    if (cachedPath && !dirty && existsSync(cachedPath)) {
      console.log(`[pack] skipped (cached): ${cachedPath}`);
      episodeId = flags.episode!;
    } else {
      if (!flags.kind) {
        console.error(
          `[make] --episode=${flags.episode} has no cached pack.json and no --kind was given to build one.`,
        );
        process.exit(1);
        return;
      }
      const result = await packRun(buildPackArgv(flags));
      episodeId = flags.episode ?? result.episodeId;
      if (!result.cached) dirty = true;
    }
    stageDone("pack", start);
  }

  // -------------------------------------------------------------- script --
  {
    banner("script");
    const start = Date.now();
    const target = scriptPath(episodeId);
    if (!dirty && existsSync(target)) {
      console.log(`[script] skipped (cached): ${target}`);
    } else {
      // `--force` here is unconditional, not `flags.force` — this call only
      // ever happens because we already decided (missing file, upstream
      // cache miss, or the user's own `--force`) that script.json needs to
      // be (re)written, so script's own "already exists" guard would only
      // be in the way.
      await scriptRun([`--episode=${episodeId}`, "--force"]);
      dirty = true;
    }
    stageDone("script", start);
  }

  // --------------------------------------------------------------- voice --
  {
    banner("voice");
    const start = Date.now();
    if (flags.skipVoice) {
      console.log("[voice] skipped (--skip-voice) — render will fall back to a silent, estimated-timing preview");
    } else {
      const target = audioManifestPath(episodeId);
      if (!dirty && existsSync(target)) {
        console.log(`[voice] skipped (cached): ${target}`);
      } else {
        // Unlike script, voice's own per-scene content fingerprinting (see
        // `src/voice/render.ts`) already means calling it here only re-bills
        // scenes whose narration actually changed — so `--force` is passed
        // through only when the user explicitly asked for it, not merely
        // because an upstream stage rebuilt.
        const voiceArgv = [`--episode=${episodeId}`];
        if (flags.force) voiceArgv.push("--force");
        await voiceRun(voiceArgv);
        dirty = true;
      }
    }
    stageDone("voice", start);
  }

  // -------------------------------------------------------------- render --
  {
    banner("render");
    const start = Date.now();
    const target = videoPath(episodeId);
    if (!dirty && existsSync(target)) {
      console.log(`[render] skipped (cached): ${target}`);
    } else {
      const renderArgv = [`--episode=${episodeId}`];
      if (flags.concurrencyArg) renderArgv.push(flags.concurrencyArg);
      if (flags.qualityArg) renderArgv.push(flags.qualityArg);
      await renderRun(renderArgv);
    }
    stageDone("render", start);
  }

  // ------------------------------------------------------------- summary --
  const finalVideoPath = videoPath(episodeId);
  let durationLabel = "unknown duration";
  if (existsSync(finalVideoPath)) {
    try {
      durationLabel = fmtDuration(await measureDurationSec(finalVideoPath));
    } catch (err) {
      console.warn(`[make] could not measure ${finalVideoPath}'s duration: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n=== ${episodeId} ===`);
  console.log(`video: ${finalVideoPath} (${durationLabel})`);
  console.log(`total: ${fmtElapsed(Date.now() - pipelineStart)}`);
}
