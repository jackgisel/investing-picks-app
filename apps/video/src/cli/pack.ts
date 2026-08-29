/**
 * `pnpm episode pack --kind=<kind> [--as-of=...] [--week=...] [--from-file=...] [--out=...] [--force]`
 *
 * Builds `pack.json` and writes it to `out/<episodeId>/pack.json` (or `--out`).
 * The summary line never prints an embargoed ticker — it prints how many were
 * withheld and why, which is the whole point of the redaction: even the
 * operator running this command on their own machine doesn't get the name
 * back out of this stage.
 *
 * Resumable like every other stage (see `cli/make.ts`): once `pack.json`
 * exists for an episode it is never silently refreshed with today's live
 * numbers — a render three weeks later has to match the render on the day
 * (DESIGN.md, "Why a pipeline of files"). `--force` is the only way back in.
 * When `--week` pins the episode id up front, a cache hit skips `buildPack`
 * entirely (no DB/API call, not just no write); otherwise `buildPack` still
 * has to run once to discover the id, but its result is discarded in favor
 * of the on-disk file rather than overwriting it.
 *
 * Returns the episode id plus whether this call was a cache hit, so
 * `cli/make.ts` can hand the id to the next stage and decide whether a
 * cache hit anywhere upstream should force every downstream stage to rerun
 * even if its own artifact happens to already exist; every other caller
 * (the `pnpm episode` dispatcher) ignores the return value.
 */

import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { writeFile } from "node:fs/promises";
// Relative, not "@/..." — see the matching comment in pack/sources.ts.
import { buildPack } from "../pack/build.js";
import { ensureDir, packPath } from "../lib/paths.js";
import type { EpisodeKind, Pack } from "../types.js";

interface PackFlags {
  kind?: string;
  asOf?: string;
  week?: string;
  fromFile?: string;
  out?: string;
  force?: boolean;
}

function parseFlags(args: string[]): PackFlags {
  const flags: PackFlags = {};
  for (const arg of args) {
    if (arg.startsWith("--kind=")) flags.kind = arg.slice("--kind=".length);
    else if (arg.startsWith("--as-of=")) flags.asOf = arg.slice("--as-of=".length);
    else if (arg.startsWith("--week=")) flags.week = arg.slice("--week=".length);
    else if (arg.startsWith("--from-file=")) flags.fromFile = arg.slice("--from-file=".length);
    else if (arg.startsWith("--out=")) flags.out = arg.slice("--out=".length);
    else if (arg === "--force") flags.force = true;
  }
  return flags;
}

function isEpisodeKind(value: string | undefined): value is EpisodeKind {
  return value === "market-note" || value === "weekly-review";
}

/**
 * Prints the error, exits, and is typed `never` so the compiler knows the
 * call site can't fall through without `kind`/`pack` being set — a plain
 * `process.exit(1)` call is typed to return `void` in some `@types/node`
 * versions, which would otherwise leave later code needing a redundant guard.
 */
function fail(message: string): never {
  console.error(`[pack] ${message}`);
  process.exit(1);
  throw new Error(message);
}

export interface PackResult {
  episodeId: string;
  /** Whether `pack.json` was already on disk and reused as-is rather than rebuilt. */
  cached: boolean;
}

export async function run(args: string[]): Promise<PackResult> {
  const flags = parseFlags(args);
  if (!isEpisodeKind(flags.kind)) {
    fail(`requires --kind=market-note or --kind=weekly-review (got ${JSON.stringify(flags.kind ?? null)})`);
  }

  // When `--week` pins the episode id up front, a cache hit means `buildPack`
  // never has to run at all — no DB query, no API calls, and (more
  // importantly) no chance of quietly overwriting a frozen pack with today's
  // live numbers.
  if (flags.week && !flags.force) {
    const earlyId = `${flags.kind}-${flags.week}`;
    const earlyPath = flags.out ?? packPath(earlyId);
    if (existsSync(earlyPath)) {
      console.log(`[pack] skipped (cached): ${earlyPath}`);
      return { episodeId: earlyId, cached: true };
    }
  }

  let pack: Pack;
  try {
    pack = await buildPack({
      kind: flags.kind,
      asOf: flags.asOf,
      weekKey: flags.week,
      fromFile: flags.fromFile,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const outPath = flags.out ?? packPath(pack.episodeId);

  // The general case: the episode id wasn't known until `buildPack` ran, so
  // the cache check happens after the fact. A hit still discards the
  // freshly-built `pack` in favor of what's already on disk — the file, not
  // the live facts behind it, is the source of truth once it exists.
  if (!flags.force && existsSync(outPath)) {
    console.log(`[pack] skipped (cached): ${outPath}`);
    return { episodeId: pack.episodeId, cached: true };
  }

  await ensureDir(dirname(outPath));
  await writeFile(outPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");

  const withheldReasons = new Map<string, number>();
  for (const r of pack.redaction.reasons) {
    withheldReasons.set(r.reason, (withheldReasons.get(r.reason) ?? 0) + 1);
  }
  const withheldCount = pack.redaction.tickers.length;
  const reasonSummary = [...withheldReasons.entries()]
    .map(([reason, count]) => `${count} ${reason.replace(/_/g, " ")}`)
    .join(", ");

  console.log(`[pack] ${pack.episodeId} (${pack.kind})`);
  console.log(`  as-of: ${pack.asOf}`);
  console.log(`  positions: ${pack.facts.summary.positionCount ?? 0}`);
  console.log(
    withheldCount > 0
      ? `  withheld: ${withheldCount} holding${withheldCount === 1 ? "" : "s"} (${reasonSummary}) — ticker not printed`
      : `  withheld: 0 holdings`,
  );
  console.log(`  wrote ${outPath}`);

  return { episodeId: pack.episodeId, cached: false };
}
