/**
 * The claims gate: two independent rules — embargo and evidence — combined
 * into one hard pass/fail. Both fail the build; neither is a warning. See
 * "The claims gate" in DESIGN.md for why: a leaked draft on disk is a leaked
 * draft, and a figure that can't be traced to the pack is not something this
 * channel is willing to say out loud.
 */

import type { Pack, Script } from "@/types";
import { findUnsupportedFigures, type FigureFinding } from "./figures";
import { findLeaks, type LeakFinding } from "./leaks";
import { findForbiddenPhrases, type PhraseFinding } from "./phrases";

export interface GateResult {
  ok: boolean;
  leaks: LeakFinding[];
  unsupportedFigures: FigureFinding[];
  forbiddenPhrases: PhraseFinding[];
}

export function runGate(script: Script, pack: Pack): GateResult {
  const leaks = findLeaks(script, pack.redaction);
  const unsupportedFigures = findUnsupportedFigures(script, pack);
  const forbiddenPhrases = findForbiddenPhrases(script);

  return {
    ok: leaks.length === 0 && unsupportedFigures.length === 0 && forbiddenPhrases.length === 0,
    leaks,
    unsupportedFigures,
    forbiddenPhrases,
  };
}

/** Renders a `GateResult` as lines of human-readable findings, for a CLI to print. */
export function formatGateResult(result: GateResult): string[] {
  const lines: string[] = [];

  for (const leak of result.leaks) {
    lines.push(`[leak] scene ${leak.sceneId} (${leak.field}): "${leak.term}" found in "${leak.context}"`);
  }
  for (const figure of result.unsupportedFigures) {
    lines.push(`[unsupported figure] scene ${figure.sceneId}: "${figure.token}" not traceable to the pack`);
  }
  for (const phrase of result.forbiddenPhrases) {
    lines.push(`[forbidden phrase] scene ${phrase.sceneId} (${phrase.field}): "${phrase.phrase}" found in "${phrase.context}"`);
  }

  if (lines.length === 0) lines.push("gate passed: no leaks, no unsupported figures, no forbidden phrases");
  return lines;
}
