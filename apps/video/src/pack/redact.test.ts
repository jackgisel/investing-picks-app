import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PackFacts } from "../types.js";
import type { SourcePost } from "./sources.js";
import { applyRedaction, decideRedaction, redactProse, redactSource } from "./redact.js";

const FIXTURE_PATH = fileURLToPath(new URL("../__fixtures__/pack.sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

const ASOF = "2026-08-21";
const EMBARGO_DAYS = 14;

describe("decideRedaction", () => {
  it("embargoes a position entered inside the window", () => {
    const redaction = decideRedaction({
      holdings: [{ ticker: "LLY", name: "Eli Lilly and Company", entryDate: "2026-08-21" }],
      pickNotes: new Set(["LLY", "SEZL"]),
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });
    expect(redaction.tickers).toEqual(["LLY"]);
    expect(redaction.names).toEqual(["Eli Lilly and Company"]);
    expect(redaction.reasons).toEqual([{ ticker: "LLY", reason: "recent_entry", entryDate: "2026-08-21" }]);
  });

  it("leaves a position entered outside the window alone", () => {
    // Exactly `embargoDays` back — the boundary is "strictly after", so a
    // position entered exactly on the cutoff is public.
    const redaction = decideRedaction({
      holdings: [{ ticker: "GEV", name: "GE Vernova Inc.", entryDate: "2026-08-07" }],
      pickNotes: new Set(["GEV"]),
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });
    expect(redaction.tickers).toEqual([]);
    expect(redaction.reasons).toEqual([]);
  });

  it("embargoes an old position whose pick note isn't approved yet", () => {
    const redaction = decideRedaction({
      holdings: [{ ticker: "SEZL", name: "Sezzle Inc.", entryDate: "2026-04-10" }],
      pickNotes: new Set(), // no approved notes at all
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });
    expect(redaction.tickers).toEqual(["SEZL"]);
    expect(redaction.reasons).toEqual([
      { ticker: "SEZL", reason: "note_unpublished", entryDate: "2026-04-10" },
    ]);
  });

  it("reports recent_entry when both rules apply to the same position", () => {
    const redaction = decideRedaction({
      holdings: [{ ticker: "LLY", name: "Eli Lilly and Company", entryDate: "2026-08-21" }],
      pickNotes: new Set(), // no approved note either
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });
    expect(redaction.reasons).toEqual([{ ticker: "LLY", reason: "recent_entry", entryDate: "2026-08-21" }]);
  });
});

/**
 * A full, still-UNREDACTED `PackFacts` carrying a real embargoed name (LLY,
 * the same position the fixture pack ends up withholding), so the tests
 * below exercise the actual strip rather than checking an already-redacted
 * fixture for a no-op.
 */
function buildUnredactedFacts(): PackFacts {
  return {
    summary: {
      picksReturnPct: 20.26,
      totalReturnPct: 2.23,
      positionCount: 2,
      openCount: 2,
      closedCount: 0,
      inceptionDate: "2026-04-07",
      daysLive: 139,
      annualizedReturnPct: 62.33,
      annualizedStatus: "ok",
    },
    week: { bookChangePct: -0.45, spyChangePct: -1.37 },
    periods: [],
    chart: { rows: [], benchmarks: [], picksLatestPct: 20.26, startDate: null, latestDate: null },
    holdings: [
      {
        redacted: false,
        ticker: "SEZL",
        name: "Sezzle Inc.",
        sector: "Financial Services",
        entryDate: "2026-04-10",
        pnlPct: 99.48,
        quantRating: 4.435,
        signal: "buy",
      },
      {
        redacted: false,
        ticker: "LLY",
        name: "Eli Lilly and Company",
        sector: "Healthcare",
        entryDate: "2026-08-21",
        pnlPct: -1.04,
        quantRating: 4.545,
        signal: "strong_buy",
      },
    ],
    sectors: [
      { sector: "Financial Services", count: 1, sharePct: 50 },
      { sector: "Healthcare", count: 1, sharePct: 50 },
    ],
    moves: [{ ticker: "LLY", redacted: false, action: "buy", when: "2026-08-21" }],
    nextEvaluationDate: "2026-09-04",
  };
}

describe("applyRedaction", () => {
  it("strips ticker, name, P&L, rating, and signal, but keeps sector and a coarse entry month", () => {
    const facts = buildUnredactedFacts();
    const redaction = decideRedaction({
      holdings: facts.holdings.map((h) => ({ ticker: h.ticker!, name: h.name, entryDate: h.entryDate! })),
      pickNotes: new Set(["LLY", "SEZL"]), // both have notes; LLY is still inside the window
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });

    const redacted = applyRedaction(facts, redaction);
    const row = redacted.holdings.find((h) => h.name === "Eli Lilly and Company" || h.entryDate === "2026-08");

    expect(row).toEqual({
      redacted: true,
      ticker: null,
      name: null,
      sector: "Healthcare",
      entryDate: "2026-08",
      pnlPct: null,
      quantRating: null,
      signal: null,
    });

    const move = redacted.moves.find((m) => m.action === "buy");
    expect(move).toEqual({ ticker: null, redacted: true, action: "buy", when: "2026-08-21" });
  });

  it("never leaves the embargoed ticker or company name anywhere in the serialized facts", () => {
    const facts = buildUnredactedFacts();
    const redaction = decideRedaction({
      holdings: facts.holdings.map((h) => ({ ticker: h.ticker!, name: h.name, entryDate: h.entryDate! })),
      pickNotes: new Set(["LLY", "SEZL"]),
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });

    const redacted = applyRedaction(facts, redaction);
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain("LLY");
    expect(serialized).not.toContain("Eli Lilly");
    // The control (proof the assertion isn't vacuous): the non-embargoed
    // position's ticker is still present.
    expect(serialized).toContain("SEZL");
  });

  it("leaves non-embargoed rows untouched", () => {
    const facts = buildUnredactedFacts();
    const redaction = decideRedaction({
      holdings: facts.holdings.map((h) => ({ ticker: h.ticker!, name: h.name, entryDate: h.entryDate! })),
      pickNotes: new Set(["LLY", "SEZL"]),
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });

    const redacted = applyRedaction(facts, redaction);
    expect(redacted.holdings.find((h) => h.ticker === "SEZL")).toEqual(facts.holdings[0]);
  });
});

describe("fixture cross-check", () => {
  it("the sample pack's own redaction record matches what decideRedaction would produce from its holdings", () => {
    // The fixture is the real, already-redacted output — reconstruct the
    // pre-redaction inputs it must have started from (sector + coarse month
    // survive on the redacted row, so the ticker is the only thing missing)
    // and confirm decideRedaction reaches the same verdict.
    const holdings = (fixture.facts.holdings as PackFacts["holdings"]).map((h) =>
      h.redacted
        ? { ticker: "LLY", name: "Eli Lilly and Company", entryDate: "2026-08-21" }
        : { ticker: h.ticker!, name: h.name, entryDate: h.entryDate! },
    );
    const redaction = decideRedaction({
      holdings,
      pickNotes: new Set(holdings.map((h) => h.ticker)), // every position here has an approved note
      asOf: fixture.asOf,
      embargoDays: fixture.redaction.embargoDays,
    });
    expect(redaction).toEqual(fixture.redaction);
  });
});

// The embargoed holding these tests exercise throughout: LLY / Eli Lilly and
// Company, entered on `asOf` itself, so it is embargoed under either rule.
const LLY_REDACTION = decideRedaction({
  holdings: [{ ticker: "LLY", name: "Eli Lilly and Company", entryDate: ASOF }],
  pickNotes: new Set(),
  asOf: ASOF,
  embargoDays: EMBARGO_DAYS,
});

// The four sentences quoted verbatim from a real weekly-review `bodyMd` that
// leaked "Lilly" into `pack.source` before this fix — see the bug report.
const REAL_LEAK_SENTENCES = [
  "One transaction. **Eli Lilly** was bought on Friday 21 August, on the scheduled evaluation date.",
  "**Lilly** entered with a 4.55 quant rating and a strong-buy signal, the highest-rated name in the book.",
  "That was the date that produced the **Lilly** buy.",
  "The new **Lilly** position adds a healthcare name at the highest grade on the book, alongside the standing Sezzle position.",
];

describe("redactProse", () => {
  it("strips the embargoed name out of each of the four real leaking sentences", () => {
    for (const sentence of REAL_LEAK_SENTENCES) {
      const redacted = redactProse(sentence, LLY_REDACTION);
      expect(redacted).not.toMatch(/\bLilly\b/i);
      expect(redacted).not.toMatch(/\bLLY\b/);
    }
  });

  it("leaves a non-embargoed holding's name in the body alone", () => {
    const text = "The book added Eli Lilly this week, alongside the standing Sezzle position.";
    const redacted = redactProse(text, LLY_REDACTION);
    expect(redacted).toContain("Sezzle");
    expect(redacted).not.toMatch(/\bLilly\b/i);
  });

  it("returns prose with no embargoed names byte-identical", () => {
    const text = "The book added Sezzle this week. SOFI carries a 1.76 quant rating and a sell signal.";
    expect(redactProse(text, LLY_REDACTION)).toBe(text);
    // No embargoed holdings at all — the term list is empty, an even
    // cheaper no-op path.
    const emptyRedaction = decideRedaction({ holdings: [], pickNotes: new Set(), asOf: ASOF, embargoDays: EMBARGO_DAYS });
    expect(redactProse(text, emptyRedaction)).toBe(text);
  });

  it("collapses two hits landing next to each other into one placeholder instead of two in a row", () => {
    const text = "Eli Lilly and Company, or Lilly as it's called on the board, led the list.";
    const redacted = redactProse(text, LLY_REDACTION);
    expect(redacted).not.toMatch(/\bLilly\b/i);
    // Exactly one placeholder, not two back-to-back.
    expect(redacted.match(/name withheld/g)).toHaveLength(1);
  });
});

describe("redactSource", () => {
  function buildLeakingSource(): SourcePost {
    return {
      slug: "weekly-review-2026-w34",
      title: "Weekly review: the book fell 0.45% while the S&P 500 fell 1.37%",
      lede: "A soft week for the index, a softer landing for us.",
      tldr: [
        "The book fell 0.45% on the week; the S&P 500 fell 1.37%.",
        "One transaction: Eli Lilly was bought on the scheduled evaluation date.",
      ],
      bodyMd: REAL_LEAK_SENTENCES.join("\n\n"),
      keyTakeaway: "The new Lilly position adds a healthcare name at the highest grade on the book.",
      publishedAt: "2026-08-21T19:01:27-07:00",
    };
  }

  it("redacts bodyMd, lede, title, keyTakeaway, and every tldr entry", () => {
    const source = buildLeakingSource();
    const redacted = redactSource(source, LLY_REDACTION);

    expect(redacted.bodyMd).not.toMatch(/\bLilly\b/i);
    expect(redacted.bodyMd).not.toMatch(/\bLLY\b/);
    expect(redacted.keyTakeaway).not.toMatch(/\bLilly\b/i);
    for (const line of redacted.tldr) expect(line).not.toMatch(/\bLilly\b/i);
    // This fixture's title/lede happen not to name the pick, but the fields
    // still round-trip through redactProse rather than being skipped.
    expect(redacted.title).toBe(source.title);
    expect(redacted.lede).toBe(source.lede);
    // Identifiers pass through untouched — they aren't prose.
    expect(redacted.slug).toBe(source.slug);
    expect(redacted.publishedAt).toBe(source.publishedAt);
  });

  /**
   * The load-bearing check the bug report calls out: assert on the whole
   * built pack, not just `pack.facts` — that narrower assertion is exactly
   * what let the real leak through (facts were clean, `source.bodyMd` was
   * not). Before this fix, `pack.source.bodyMd` was assigned straight from
   * the unredacted post and this test fails; `applyRedaction` alone never
   * touched `source` at all.
   */
  it("the embargoed ticker and every distinctive name token appear nowhere in the built pack except pack.redaction", () => {
    const facts = buildUnredactedFacts();
    const redaction = decideRedaction({
      holdings: facts.holdings.map((h) => ({ ticker: h.ticker!, name: h.name, entryDate: h.entryDate! })),
      pickNotes: new Set(["LLY", "SEZL"]),
      asOf: ASOF,
      embargoDays: EMBARGO_DAYS,
    });
    const redactedFacts = applyRedaction(facts, redaction);
    const redactedSource = redactSource(buildLeakingSource(), redaction);

    const pack = {
      schemaVersion: 1 as const,
      episodeId: "weekly-review-2026-w34",
      kind: "weekly-review" as const,
      generatedAt: "2026-08-25T00:49:33.684149+00:00",
      asOf: ASOF,
      periodLabel: "August 16–22, 2026",
      source: { ...redactedSource, url: "https://outpick.io/dashboard/insights/weekly-review-2026-w34" },
      facts: redactedFacts,
      redaction,
    };

    const { redaction: _redactionRecord, ...packWithoutRedactionRecord } = pack;
    const serialized = JSON.stringify(packWithoutRedactionRecord);

    expect(serialized).not.toMatch(/\bLLY\b/);
    expect(serialized).not.toMatch(/\bLilly\b/i);
    // Control: the redaction record itself is *supposed* to carry the name —
    // proof the assertion above isn't vacuous because nothing matched at all.
    expect(JSON.stringify(pack.redaction)).toMatch(/\bLilly\b/i);
    // Control: a public, non-embargoed holding's name must still be there —
    // over-redaction would be its own bug.
    expect(serialized).toContain("Sezzle");
  });
});
