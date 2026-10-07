import { describe, expect, it } from "vitest";
import { companyScore, documentScore, searchSite, type SearchCorpus } from "./site-search";

const corpus: SearchCorpus = {
  companies: [
    { ticker: "META", name: "Meta Platforms, Inc.", sector: "Communication Services" },
    { ticker: "MET", name: "MetLife, Inc.", sector: "Financial Services" },
    { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
    { ticker: "APP", name: "AppLovin Corporation", sector: "Technology" },
  ],
  documents: [
    { kind: "article", title: "How to Calculate Intrinsic Value for a Stock", href: "/blog/a", detail: "Valuation", keywords: ["dcf"] },
    { kind: "tool", title: "Intrinsic value calculator", href: "/tools/i", detail: null },
    { kind: "article", title: "Meta-analysis of newsletters", href: "/blog/b", detail: null },
  ],
};

describe("site search", () => {
  it("puts the exact ticker first", () => {
    const r = searchSite("meta", corpus);
    expect(r[0]).toMatchObject({ kind: "company", ticker: "META", href: "/companies/meta" });
  });

  it("ranks a shorter ticker prefix ahead of a longer one", () => {
    expect(companyScore("ap", { ticker: "APP", name: null })).toBeGreaterThan(
      companyScore("ap", { ticker: "AAPL", name: null }),
    );
  });

  it("matches a company by a word in its name", () => {
    const r = searchSite("apple", corpus);
    expect(r[0].ticker).toBe("AAPL");
  });

  it("finds articles and tools when every query word matches", () => {
    const r = searchSite("intrinsic value", corpus);
    expect(r.map((x) => x.href)).toEqual(expect.arrayContaining(["/blog/a", "/tools/i"]));
  });

  it("uses keywords as well as titles", () => {
    expect(documentScore("dcf", corpus.documents[0])).toBeGreaterThan(0);
  });

  it("returns nothing for an empty query", () => {
    expect(searchSite("   ", corpus)).toEqual([]);
  });
});
