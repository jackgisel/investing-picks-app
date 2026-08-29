/**
 * The evidence half of the claims gate: every number spoken in the
 * narration has to trace back to something in the pack. `pack.facts` and
 * `pack.source` are walked once into a flat set of numbers — including
 * numbers embedded inside strings (a date, a benchmark label like
 * "Nasdaq-100", a figure the source post already quoted) — because the gate
 * has no way to know which of those the model actually relied on, so
 * anything visible anywhere in the pack counts as reachable.
 */

import type { Pack, Script } from "@/types";

export interface FigureFinding {
  sceneId: string;
  /** The exact substring matched in the narration, e.g. "15.8%" or "139". */
  token: string;
  value: number;
}

// Percentages and ratings in this book are computed to two decimal places
// and the model is free to speak them rounded to one decimal or a whole
// number ("15.8%" for a pack value of 15.80, "1.7" for a quant rating of
// 1.743). The smallest gap that distinction can produce is 0.1, so 0.05 — half
// that gap — absorbs ordinary rounding without being loose enough to wave
// through a genuinely different figure.
const TOLERANCE = 0.05;

const YEAR_MIN = 1900;
const YEAR_MAX = 2099;

/**
 * Small bare integers are ignored: "one position", "six of eleven open
 * positions", "day one" all use a number under 13 as a counting word rather
 * than a claim that needs a source. A percentage or a decimal in the same
 * range ("6%", "4.0") is not exempted — those are always a claim.
 */
function isPlausiblyOrdinal(raw: string, value: number): boolean {
  return !raw.includes("%") && !raw.includes(".") && value >= 0 && value <= 12;
}

/** A bare four-digit integer in a normal calendar range reads as a year, not a figure that needs tracing. */
function isYear(raw: string, value: number): boolean {
  if (raw.includes("%") || raw.includes(".")) return false;
  const digits = raw.replace(/^-/, "");
  return digits.length === 4 && value >= YEAR_MIN && value <= YEAR_MAX;
}

function extractNarrationNumbers(narration: string): { raw: string; value: number }[] {
  const matches = narration.match(/-?\d+(?:,\d{3})*(?:\.\d+)?%?/g) ?? [];
  return matches
    .map((raw) => ({ raw, value: Number.parseFloat(raw.replace(/,/g, "").replace("%", "")) }))
    .filter((token) => Number.isFinite(token.value));
}

/**
 * Recursively collects every number reachable in `pack.facts` and
 * `pack.source`. Numbers are pulled out of strings as well as typed number
 * fields, since a benchmark label ("Nasdaq-100"), a date, or a figure the
 * source post already printed in prose all count as "in the pack" for the
 * purposes of this gate.
 *
 * Signs are dropped for numbers found inside strings, but not for typed
 * number fields: an ISO date like "2026-08-21" would otherwise read its
 * day-of-month as a negative number because of the hyphen separator, and
 * pack strings never carry a genuine negative figure written as text — real
 * negative values (a losing week, a down position) live in the typed
 * numeric fields, which keep their sign here. Narration figures are matched
 * against this set by absolute value (see `isSupported`) for the same
 * reason: the reference voice speaks a negative move as "fell 1.37%" rather
 * than "-1.37%", so the sign the pack carries and the sign the narration
 * omits are not expected to line up.
 */
function collectPackNumbers(pack: Pack): number[] {
  const numbers: number[] = [];
  const seen = new Set<object>();

  function walk(value: unknown): void {
    if (value === null || value === undefined) return;
    if (typeof value === "number") {
      if (Number.isFinite(value)) numbers.push(value);
      return;
    }
    if (typeof value === "string") {
      for (const raw of value.match(/\d+(?:\.\d+)?/g) ?? []) {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) numbers.push(n);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value === "object") {
      if (seen.has(value)) return;
      seen.add(value);
      for (const v of Object.values(value as Record<string, unknown>)) walk(v);
    }
  }

  walk(pack.facts);
  walk(pack.source);
  return numbers;
}

function isSupported(value: number, packNumbers: number[]): boolean {
  const target = Math.abs(value);
  return packNumbers.some((n) => Math.abs(Math.abs(n) - target) <= TOLERANCE);
}

export function findUnsupportedFigures(script: Script, pack: Pack): FigureFinding[] {
  const packNumbers = collectPackNumbers(pack);
  const findings: FigureFinding[] = [];

  for (const scene of script.scenes) {
    for (const token of extractNarrationNumbers(scene.narration)) {
      if (isPlausiblyOrdinal(token.raw, token.value)) continue;
      if (isYear(token.raw, token.value)) continue;
      if (!isSupported(token.value, packNumbers)) {
        findings.push({ sceneId: scene.id, token: token.raw, value: token.value });
      }
    }
  }

  return findings;
}
