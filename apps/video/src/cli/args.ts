/**
 * Global flag parsing shared by every subcommand. `pnpm episode <cmd>
 * --kind=... --episode=... --as-of=...` is the shape every stage takes these
 * three from, so validating them once here means a typo in `--kind` fails
 * with a message before any stage-specific work (an API call, a Claude
 * request, a render) has spent anything.
 */

import type { EpisodeKind } from "@/types";

const EPISODE_KINDS: readonly EpisodeKind[] = ["market-note", "weekly-review"];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/;

export interface GlobalFlags {
  kind: EpisodeKind | null;
  episode: string | null;
  asOf: string | null;
  /** Positional args and any flags this parser doesn't own, in original order. */
  rest: string[];
}

export function parseGlobalFlags(args: string[]): GlobalFlags {
  const flags: GlobalFlags = { kind: null, episode: null, asOf: null, rest: [] };

  for (const arg of args) {
    if (arg.startsWith("--kind=")) {
      const value = arg.slice("--kind=".length);
      if (!EPISODE_KINDS.includes(value as EpisodeKind)) {
        throw new Error(
          `--kind must be one of ${EPISODE_KINDS.join(", ")} (got "${value}")`,
        );
      }
      flags.kind = value as EpisodeKind;
    } else if (arg.startsWith("--episode=")) {
      flags.episode = arg.slice("--episode=".length);
    } else if (arg.startsWith("--as-of=")) {
      const value = arg.slice("--as-of=".length);
      if (!ISO_DATE_RE.test(value)) {
        throw new Error(`--as-of must be an ISO date, e.g. 2026-08-24 (got "${value}")`);
      }
      flags.asOf = value;
    } else {
      flags.rest.push(arg);
    }
  }

  return flags;
}
