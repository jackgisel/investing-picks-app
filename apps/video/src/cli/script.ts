/**
 * `pnpm episode script --episode=<id> [--force]`
 *
 * Turns that episode's `pack.json` into `script.json` — narration and slide
 * bindings, see `src/script/generate.ts` — plus a human-readable `script.md`
 * beside it. Runs the claims gate (`src/gate`) on the generated script
 * before writing anything: a leaked draft on disk is a leaked draft, so a
 * gate failure here is a hard exit, not a warning with a written file next
 * to it.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Pack } from "@/types";
import { ensureDir, outDir, packPath, scriptPath } from "@/lib/paths";
import { formatGateResult, runGate } from "@/gate";
import { generateScript } from "@/script/generate";
import { renderScriptMarkdown } from "@/script/markdown";

interface ScriptFlags {
  episode: string | null;
  force: boolean;
}

function parseScriptFlags(args: string[]): ScriptFlags {
  const flags: ScriptFlags = { episode: null, force: false };
  for (const arg of args) {
    if (arg.startsWith("--episode=")) {
      flags.episode = arg.slice("--episode=".length);
    } else if (arg === "--force") {
      flags.force = true;
    }
    // Unrecognized flags (e.g. --kind=, --as-of=) were already validated by
    // the global dispatcher in cli/index.ts and aren't needed here.
  }
  return flags;
}

export async function run(args: string[]): Promise<void> {
  const flags = parseScriptFlags(args);

  if (!flags.episode) {
    console.error("script requires --episode=<id>");
    process.exit(1);
    return;
  }

  const episodePackPath = packPath(flags.episode);
  let pack: Pack;
  try {
    pack = JSON.parse(await readFile(episodePackPath, "utf8")) as Pack;
  } catch (err) {
    console.error(`Could not read ${episodePackPath}: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Run `pnpm episode pack --episode=<id>` first.");
    process.exit(1);
    return;
  }

  const episodeScriptPath = scriptPath(flags.episode);
  if (!flags.force && existsSync(episodeScriptPath)) {
    console.error(`${episodeScriptPath} already exists. Pass --force to regenerate.`);
    process.exit(1);
    return;
  }

  console.log(`Generating script for ${flags.episode} (${pack.kind})...`);
  const script = await generateScript(pack);

  const gateResult = runGate(script, pack);
  if (!gateResult.ok) {
    console.error(`Claims gate failed for ${flags.episode} — refusing to write script.json or script.md.`);
    for (const line of formatGateResult(gateResult)) {
      console.error(`  ${line}`);
    }
    process.exit(1);
    return;
  }

  await ensureDir(outDir(flags.episode));
  await writeFile(episodeScriptPath, `${JSON.stringify(script, null, 2)}\n`, "utf8");

  const episodeScriptMdPath = join(outDir(flags.episode), "script.md");
  await writeFile(episodeScriptMdPath, renderScriptMarkdown(script), "utf8");

  console.log(`Gate passed: ${script.scenes.length} scenes, no leaks, no unsupported figures, no forbidden phrases.`);
  console.log(`Wrote ${episodeScriptPath}`);
  console.log(`Wrote ${episodeScriptMdPath}`);
}
