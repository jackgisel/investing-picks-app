/**
 * `pnpm episode gate --episode=<id>`
 *
 * Re-runs the claims gate (`src/gate`) over an episode's existing
 * `pack.json` and `script.json` and prints the findings. Useful on its own
 * after hand-editing a script, or to re-check an episode whose pack changed
 * underneath it. Exits 1 on any finding — embargo leak, unsupported figure,
 * or forbidden phrase — same as the automatic gate `cli/script.ts` runs
 * after generation.
 */

import { readFile } from "node:fs/promises";

import type { Pack, Script } from "@/types";
import { packPath, scriptPath } from "@/lib/paths";
import { formatGateResult, runGate } from "@/gate";

interface GateFlags {
  episode: string | null;
}

function parseGateFlags(args: string[]): GateFlags {
  const flags: GateFlags = { episode: null };
  for (const arg of args) {
    if (arg.startsWith("--episode=")) {
      flags.episode = arg.slice("--episode=".length);
    }
    // Unrecognized flags (e.g. --kind=, --as-of=) were already validated by
    // the global dispatcher in cli/index.ts and aren't needed here.
  }
  return flags;
}

export async function run(args: string[]): Promise<void> {
  const flags = parseGateFlags(args);

  if (!flags.episode) {
    console.error("gate requires --episode=<id>");
    process.exit(1);
    return;
  }

  const episodePackPath = packPath(flags.episode);
  const episodeScriptPath = scriptPath(flags.episode);

  let pack: Pack;
  try {
    pack = JSON.parse(await readFile(episodePackPath, "utf8")) as Pack;
  } catch (err) {
    console.error(`Could not read ${episodePackPath}: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Run `pnpm episode pack --episode=<id>` first.");
    process.exit(1);
    return;
  }

  let script: Script;
  try {
    script = JSON.parse(await readFile(episodeScriptPath, "utf8")) as Script;
  } catch (err) {
    console.error(`Could not read ${episodeScriptPath}: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Run `pnpm episode script --episode=<id>` first.");
    process.exit(1);
    return;
  }

  const result = runGate(script, pack);
  for (const line of formatGateResult(result)) {
    console.log(line);
  }

  if (!result.ok) {
    process.exit(1);
  }
}
