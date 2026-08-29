/**
 * The single definition of what counts as a mention of an embargoed holding.
 *
 * `pack/redact.ts` uses `embargoTerms` to strip these strings out of the
 * source post before the script-writing model ever sees it — the control.
 * `gate/leaks.ts` uses the same function to re-scan the finished narration
 * and every on-screen string for the same strings — the proof the control
 * worked (DESIGN.md, "The claims gate": "Stripping is the control; the scan
 * is the proof."). Those two are only a proof of each other if they agree on
 * what a "mention" is, so the rule lives here exactly once. Do not duplicate
 * it back into either caller: if the stripper and the scanner drift, the
 * stripper could miss a name the scanner also misses, and a withheld holding
 * reaches a published video with nothing having caught it.
 */

import type { Redaction } from "@/types";

// Corporate suffixes and connector words stripped before a company name is
// split into "distinctive tokens" — the words worth searching for on their
// own. "Eli Lilly and Company" should yield "Lilly" (and drop "Eli" as too
// short to be worth flagging on its own — see the length filter below), not
// "Eli Lilly and Company" as a single four-word phrase nobody would say.
const CORP_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "holdings",
  "holding",
  "company",
  "co",
  "llc",
  "ltd",
  "limited",
  "group",
  "plc",
  "nv",
  "sa",
  "lp",
  "ag",
  "sarl",
  "gmbh",
]);

const CONNECTOR_WORDS = new Set(["and", "the", "of", "&"]);

// Tokens shorter than this are too common to search for on their own — "Eli"
// or "WT" as bare words would false-positive on ordinary narration. The full
// ticker is still checked separately with no length floor, since a ticker
// like "WT" is exactly the string the embargo exists to catch.
const MIN_TOKEN_LENGTH = 4;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A `\b`-anchored, case-insensitive pattern for one literal term. */
export function wordBoundaryPattern(term: string, flags = "i"): RegExp {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, flags);
}

function distinctiveTokens(name: string): string[] {
  return name
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => {
      const lower = word.toLowerCase();
      return !CONNECTOR_WORDS.has(lower) && !CORP_SUFFIXES.has(lower);
    })
    .filter((word) => word.length >= MIN_TOKEN_LENGTH);
}

/**
 * Every literal string worth searching for: each embargoed ticker, each
 * full company name, and each name's distinctive tokens — deduped, longest
 * first so a full name is consumed before a token inside it could split the
 * match (matters to the caller that replaces text; harmless to the caller
 * that only tests for presence).
 */
export function embargoTerms(redaction: Redaction): string[] {
  const terms = new Set<string>();
  for (const ticker of redaction.tickers) {
    if (ticker) terms.add(ticker);
  }
  for (const name of redaction.names) {
    if (!name) continue;
    terms.add(name);
    for (const token of distinctiveTokens(name)) terms.add(token);
  }
  return [...terms].sort((a, b) => b.length - a.length);
}
