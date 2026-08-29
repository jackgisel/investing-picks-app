/**
 * The hype-language half of the claims gate. Mirrors
 * `editorial.forbiddenPatterns` from `~/Youtube/Library/_tools/channels/
 * outpick.yaml` verbatim — that file is the source of truth for the
 * channel's editorial rules, and this list is a copy of it, not a
 * reinterpretation. If the channel profile changes, update both.
 */

import type { Script } from "@/types";
import { collectSceneStrings } from "./text";

export const FORBIDDEN_PATTERNS: readonly string[] = [
  "This could 10x",
  "Not financial advice, but",
  "Nobody is talking about",
  "Load up",
  "To the moon",
  "Guaranteed",
  "Easy money",
  "You need to buy",
  "Before it's too late",
  "Smart money is",
];

export interface PhraseFinding {
  sceneId: string;
  field: string;
  phrase: string;
  context: string;
}

export function findForbiddenPhrases(
  script: Script,
  patterns: readonly string[] = FORBIDDEN_PATTERNS,
): PhraseFinding[] {
  const findings: PhraseFinding[] = [];
  for (const scene of script.scenes) {
    for (const { field, value } of collectSceneStrings(scene)) {
      const lower = value.toLowerCase();
      for (const phrase of patterns) {
        if (lower.includes(phrase.toLowerCase())) {
          findings.push({ sceneId: scene.id, field, phrase, context: value });
        }
      }
    }
  }
  return findings;
}
