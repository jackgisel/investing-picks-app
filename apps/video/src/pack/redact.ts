/**
 * The embargo decision (DESIGN.md, "The claims gate"), kept pure and
 * separate from `sources.ts`/`build.ts` so it is trivial to unit-test without
 * a database or an API.
 *
 * CRITICAL INVARIANT: redaction happens here, before `pack.json` is ever
 * serialized — not later, and not at render time. `build.ts` calls
 * `applyRedaction` as the last step before returning the `Pack`, so an
 * embargoed ticker or company name never exists anywhere in `pack.facts` on
 * disk. The only place it survives at all is `pack.redaction.tickers` /
 * `.names`, and that is deliberate: it exists so `gate` has something to
 * scan the finished narration against. If `script` or `render` only ever see
 * `pack.facts`, they physically cannot leak a name they were never given.
 */

// Relative, not "@/types" — see the matching comment in sources.ts.
import type { HoldingFact, PackFacts, Redaction } from "../types.js";
import type { SourcePost } from "./sources.js";
import { embargoTerms, escapeRegExp } from "../lib/embargo-terms.js";

export interface RedactionHoldingInput {
  ticker: string;
  name: string | null;
  /** YYYY-MM-DD */
  entryDate: string;
}

export interface DecideRedactionInput {
  holdings: RedactionHoldingInput[];
  /** Upper-cased tickers with an approved `pick` note — see `loadApprovedPickTickers`. */
  pickNotes: Set<string>;
  /** YYYY-MM-DD — the day the episode's numbers describe. */
  asOf: string;
  embargoDays: number;
}

/** `dateStr` (YYYY-MM-DD) shifted by `days`, computed at UTC midnight so month/year rollovers are correct. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A position is embargoed when its entry is still inside the evaluation
 * cadence (strictly newer than `asOf - embargoDays`) OR its pick note has not
 * been approved yet. Either is sufficient; when both apply, `recent_entry`
 * wins because it is the reason that will resolve on its own as the position
 * ages, whereas `note_unpublished` on an old position is closer to a bug in
 * the pipeline.
 */
export function decideRedaction(input: DecideRedactionInput): Redaction {
  const { holdings, pickNotes, asOf, embargoDays } = input;
  const cutoff = shiftDate(asOf, -embargoDays);

  const tickers: string[] = [];
  const names: string[] = [];
  const reasons: Redaction["reasons"] = [];

  for (const holding of holdings) {
    const ticker = holding.ticker.toUpperCase();
    const recentEntry = holding.entryDate > cutoff;
    const noteApproved = pickNotes.has(ticker);

    if (!recentEntry && noteApproved) continue;

    tickers.push(ticker);
    if (holding.name) names.push(holding.name);
    reasons.push({
      ticker,
      reason: recentEntry ? "recent_entry" : "note_unpublished",
      entryDate: holding.entryDate ?? null,
    });
  }

  return { embargoDays, tickers, names, reasons };
}

/**
 * Strips every embargoed name out of `facts`. Sector and the entry month
 * (YYYY-MM, not the day) deliberately survive on a redacted holding —
 * aggregates like the sector-weight chart are already public on the site, and
 * dropping them here would make the video's numbers stop adding up to totals
 * a subscriber can already see. Everything that could identify the specific
 * position — ticker, name, P&L, rating, signal, the exact entry day — does not.
 */
export function applyRedaction(facts: PackFacts, redaction: Redaction): PackFacts {
  const embargoed = new Set(redaction.tickers);

  const holdings: HoldingFact[] = facts.holdings.map((holding) => {
    if (!holding.ticker || !embargoed.has(holding.ticker)) return holding;
    return {
      redacted: true,
      ticker: null,
      name: null,
      sector: holding.sector,
      entryDate: holding.entryDate ? holding.entryDate.slice(0, 7) : null,
      pnlPct: null,
      quantRating: null,
      signal: null,
    };
  });

  const moves = facts.moves.map((move) => {
    if (!move.ticker || !embargoed.has(move.ticker)) return move;
    return { ticker: null, redacted: true, action: move.action, when: move.when };
  });

  return { ...facts, holdings, moves };
}

/**
 * `pack.source` is the published blog post — the paywalled review names the
 * new pick because its readers already paid for it. `bodyMd` is fed to the
 * script-writing model verbatim, so it needs exactly the same stripping
 * `applyRedaction` gives `facts`, or the embargo is fiction: the model reads
 * the name straight out of the source text and `gate` only catches it after
 * a wasted generation. See DESIGN.md, "The claims gate" — "the source post
 * *does* name the new pick... the redaction is the whole difference."
 *
 * The matching rules — the ticker on word boundaries, the full company name
 * as a phrase, and distinctive name tokens — live in `../lib/embargo-terms.js`,
 * shared with the post-generation scanner in `src/gate/leaks.ts`, so the
 * stripper here and the scanner there cannot disagree about what counts as a
 * leak.
 */

const REDACTION_PLACEHOLDER = "a new position (name withheld)";

// A private-use character, never legitimately present in narration, marks a
// stripped span until every term has had a pass — using it instead of the
// final placeholder text avoids a later, shorter term matching words inside
// the placeholder itself.
const SENTINEL = "";

/**
 * Strips every embargoed ticker, company name, and distinctive name token
 * out of free text and substitutes a neutral placeholder. The result reads a
 * little awkwardly at the seams — "the new a new position (name withheld)
 * position adds a healthcare name..." is not a sentence anyone would write.
 * That is fine and worth stating plainly: `script`'s model rewrites this
 * material into narration rather than quoting it, so an awkward sentence
 * that cannot leak beats a fluent one that can.
 */
export function redactProse(text: string, redaction: Redaction): string {
  const terms = embargoTerms(redaction);
  if (!text || terms.length === 0) return text;

  let out = text;
  let matched = false;
  for (const term of terms) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    out = out.replace(pattern, () => {
      matched = true;
      return SENTINEL;
    });
  }
  if (!matched) return text;

  // Collapse a run of hits that landed next to each other — e.g. the full
  // name immediately followed by a bare mention of its own distinctive token
  // ("Eli Lilly and Company (Lilly)") — into one placeholder rather than
  // emitting it twice in a row, which reads as an obvious seam and hints
  // that more than one name was stripped from the same clause.
  const filler = "(?:['’]s)?[\\s,.()-]*(?:and|or|the|of)?[\\s,.()-]*";
  const collapse = new RegExp(`${SENTINEL}${filler}${SENTINEL}`, "gi");
  let prev: string;
  do {
    prev = out;
    out = out.replace(collapse, SENTINEL);
  } while (out !== prev);

  return out.split(SENTINEL).join(REDACTION_PLACEHOLDER);
}

/**
 * The `source` half of redaction (see the comment above `redactProse`).
 * `slug` and `publishedAt` are identifiers, not prose, and pass through
 * unchanged — an embargoed name cannot hide in a URL slug or a timestamp,
 * and the gate's scan is over on-screen/spoken strings, not these.
 */
export function redactSource(source: SourcePost, redaction: Redaction): SourcePost {
  return {
    ...source,
    title: redactProse(source.title, redaction),
    lede: source.lede != null ? redactProse(source.lede, redaction) : source.lede,
    tldr: source.tldr.map((line) => redactProse(line, redaction)),
    bodyMd: redactProse(source.bodyMd, redaction),
    keyTakeaway: source.keyTakeaway != null ? redactProse(source.keyTakeaway, redaction) : source.keyTakeaway,
  };
}
