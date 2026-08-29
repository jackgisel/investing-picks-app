/**
 * The embargo half of the claims gate. `pack` has already stripped every
 * embargoed ticker and company name before `script` saw the payload — this
 * is the proof that the stripping worked, not the control itself. It
 * re-scans the *finished* narration and every on-screen string for the
 * embargoed ticker, the embargoed company name, and the company name's
 * distinctive tokens ("Eli Lilly" must catch a scene that only says
 * "Lilly"), and fails the build on any hit.
 */

import type { Redaction, Script } from "@/types";
import { embargoTerms, wordBoundaryPattern } from "@/lib/embargo-terms";
import { collectSceneStrings } from "./text";

export interface LeakFinding {
  sceneId: string;
  field: string;
  /** The embargoed ticker, full name, or name token that matched. */
  term: string;
  /** The full string the term was found inside, for a human to eyeball. */
  context: string;
}

export function findLeaks(script: Script, redaction: Redaction): LeakFinding[] {
  const terms = embargoTerms(redaction).map((label) => ({ label, pattern: wordBoundaryPattern(label) }));
  if (terms.length === 0) return [];

  const findings: LeakFinding[] = [];
  for (const scene of script.scenes) {
    for (const { field, value } of collectSceneStrings(scene)) {
      for (const term of terms) {
        if (term.pattern.test(value)) {
          findings.push({ sceneId: scene.id, field, term: term.label, context: value });
        }
      }
    }
  }
  return findings;
}
