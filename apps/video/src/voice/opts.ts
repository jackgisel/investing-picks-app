/**
 * Small, dependency-free parsers shared by the `voice` CLI and its tests.
 * Split out from `src/cli/voice.ts` so the parsing logic can be covered by a
 * vitest file under `src/voice/` without importing a CLI entry point.
 */

/**
 * Parses `--force-scenes=1,3` into the set `{1, 3}`. Scene numbers are
 * 1-based and refer to a scene's position in `script.scenes` — the same `NN`
 * that appears in its `scene-<NN>-<sceneId>.mp3` filename — not the scene's
 * `id` string, so a typo'd id can't silently match nothing and skip the
 * force.
 */
export function parseForceScenes(raw: string): Set<number> {
  const numbers = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const value = Number(part);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--force-scenes must be comma-separated positive integers (got "${part}")`);
      }
      return value;
    });

  if (numbers.length === 0) {
    throw new Error("--force-scenes requires at least one scene number, e.g. --force-scenes=1,3");
  }

  return new Set(numbers);
}
