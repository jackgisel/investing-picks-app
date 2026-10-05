import { describe, expect, it } from "vitest";
import {
  composeMarketNoteBodyMd,
  emptyWatchlist,
  hasMarketNotePreviewContent,
  normalizeDates,
  normalizeWatchlist,
} from "./market-note-preview";
import { previewFromEditorialBrief } from "./market-note-brief";

describe("normalizeWatchlist", () => {
  it("pads to five slots and uppercases tickers", () => {
    const items = normalizeWatchlist([
      { ticker: "wdc", name: "Western Digital", note: "Cheap on the de-rating." },
    ]);
    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({
      ticker: "WDC",
      name: "Western Digital",
      note: "Cheap on the de-rating.",
    });
    expect(items[1].ticker).toBe("");
    expect(items[4].ticker).toBe("");
  });

  it("caps at ten names", () => {
    const items = normalizeWatchlist(
      Array.from({ length: 12 }, (_, i) => ({ ticker: `T${i}` })),
    );
    expect(items).toHaveLength(10);
    expect(items[0].ticker).toBe("T0");
    expect(items[9].ticker).toBe("T9");
  });

  it("treats junk as empty slots", () => {
    expect(normalizeWatchlist(null).every((i) => i.ticker === "")).toBe(true);
    expect(emptyWatchlist()).toHaveLength(5);
  });
});

describe("composeMarketNoteBodyMd", () => {
  it("writes the four sections as markdown headings", () => {
    const md = composeMarketNoteBodyMd({
      watchlist: normalizeWatchlist([
        { ticker: "WDC", name: "Western Digital", note: "Screening well." },
      ]),
      sectorsMd: "- **Industrials**: breadth is building.",
      sentimentMd: "The fear is a value trap. The excitement is the de-rating.",
      dates: [{ date: "2026-09-18", label: "WDC earnings" }],
    });
    expect(md).toContain("## Looking at");
    expect(md).toContain("**WDC**, Western Digital: Screening well.");
    expect(md).toContain("## Where sectors are moving");
    expect(md).toContain("## Fears and excitements");
    expect(md).toContain("## Dates ahead");
    expect(md).toContain("**2026-09-18**: WDC earnings");
  });

  it("returns null when every section is empty", () => {
    expect(
      composeMarketNoteBodyMd({
        watchlist: emptyWatchlist(),
        sectorsMd: "  ",
        sentimentMd: null,
        dates: [],
      }),
    ).toBeNull();
  });
});

describe("hasMarketNotePreviewContent", () => {
  it("accepts a legacy body when the new fields are empty", () => {
    expect(
      hasMarketNotePreviewContent({
        watchlist: emptyWatchlist(),
        sectorsMd: null,
        sentimentMd: null,
        dates: [],
        bodyMd: "## Old blob",
      }),
    ).toBe(true);
  });

  it("rejects an empty draft", () => {
    expect(
      hasMarketNotePreviewContent({
        watchlist: emptyWatchlist(),
        sectorsMd: null,
        sentimentMd: null,
        dates: [],
        bodyMd: "  ",
      }),
    ).toBe(false);
  });
});

describe("normalizeDates", () => {
  it("drops blank rows", () => {
    expect(
      normalizeDates([{ date: "", label: "" }, { date: "Sep 18", label: "CPI" }]),
    ).toEqual([{ date: "Sep 18", label: "CPI" }]);
  });
});

describe("previewFromEditorialBrief", () => {
  const brief = {
    rating_as_of: "2026-09-11",
    sectors: [
      {
        sector: "Industrials",
        rated_companies: 40,
        qualified_companies: 8,
        qualified_share_pct: 20,
        high_rating_change: 3,
      },
      {
        sector: "Software",
        rated_companies: 50,
        qualified_companies: 2,
        qualified_share_pct: 4,
        high_rating_change: -2,
      },
    ],
    watchlist: [
      {
        ticker: "WDC",
        name: "Western Digital",
        sector: "Technology",
        market_cap: 1,
        quant_rating: 4.2,
        rating_change: 0.3,
        grades: {},
        fundamentals: {
          revenue_growth_ttm_pct: 12.5,
          revenue_revision_pct: 1.2,
          earnings_report_date: "2026-10-02",
        },
      },
      {
        ticker: "SOFI",
        name: "SoFi",
        sector: "Financials",
        market_cap: 1,
        quant_rating: 4.0,
        rating_change: null,
        grades: {},
        fundamentals: {
          revenue_growth_ttm_pct: null,
          revenue_revision_pct: null,
          earnings_report_date: "2026-10-02",
        },
      },
      {
        ticker: "SEZL",
        name: null,
        sector: null,
        market_cap: null,
        quant_rating: 3.9,
        rating_change: -0.1,
        grades: {},
        fundamentals: null,
      },
    ],
  };

  it("fills the four first-class fields instead of a single blob", () => {
    const preview = previewFromEditorialBrief(brief);
    expect(preview.watchlist.filter((w) => w.ticker).map((w) => w.ticker)).toEqual([
      "WDC",
      "SOFI",
      "SEZL",
    ]);
    expect(preview.watchlist).toHaveLength(5);
    expect(preview.sectorsMd).toContain("Industrials");
    expect(preview.sentimentMd).toBe("");
    expect(preview.newsMd).toBe("");
    expect(preview.dates).toEqual([
      { date: "2026-10-02", label: "WDC, SOFI earnings" },
    ]);
    expect(preview.bodyMd).toContain("## Looking at");
    expect(preview.bodyMd).toContain("## Dates ahead");
  });
});
