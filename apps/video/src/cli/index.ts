#!/usr/bin/env node
/**
 * `pnpm episode <subcommand> [--kind=...] [--episode=...] [--as-of=...]`
 *
 * One dispatcher for the whole pipeline rather than seven separate bin
 * entries, because the five stages plus `make` and `voices` share the same
 * global flags and the same "episode directory" concept — see
 * `src/lib/paths.ts`. Each subcommand is its own module purely so a later
 * chunk can grow `pack.ts` or `voice.ts` independently without this file
 * changing shape.
 */

import { parseGlobalFlags } from "./args.js";

const SUBCOMMANDS = ["pack", "script", "gate", "voice", "render", "make", "voices"] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

function isSubcommand(value: string): value is Subcommand {
  return (SUBCOMMANDS as readonly string[]).includes(value);
}

function printUsage(): void {
  console.log(`Usage: pnpm episode <subcommand> [options]

Subcommands:
  pack      Build pack.json from the source post and portfolio facts
  script    Turn pack.json into script.json (narration + slide bindings)
  gate      Verify script.json against pack.json (embargo + evidence)
  voice     Synthesize audio/*.mp3 from script.json
  render    Render video.mp4 from pack + script + audio
  make      Run pack -> script -> gate -> voice -> render
  voices    List available ElevenLabs voices

Options:
  --kind=<market-note|weekly-review>   Which episode kind to build
  --episode=<id>                       Episode id (out/<id>/)
  --as-of=<ISO date>                   The date the episode's numbers describe

Example:
  pnpm episode make --kind=weekly-review`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exit(1);
  }

  if (!isSubcommand(command)) {
    console.error(`Unknown subcommand "${command}"\n`);
    printUsage();
    process.exit(1);
  }

  // Parsed here purely to fail fast on a malformed --kind/--as-of before any
  // stage-specific work starts; the raw args still go to the subcommand so
  // it can do its own parsing once its real implementation lands.
  try {
    parseGlobalFlags(rest);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const mod = await import(`./${command}.js`);
  await mod.run(rest);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
