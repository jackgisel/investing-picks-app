import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SINGLES,
  CAMPAIGN_THREADS,
  campaignDraftCounts,
} from "./campaign-drafts";

const BANNED = [
  "generational",
  "exactly what to buy",
  "10x",
  "cagr",
  "price targets",
  "trump",
  "1399",
  "we bought",
  "outpick pick",
  "our pick",
  "cleared",
  "superx",
  "research angle",
];

describe("campaign drafts", () => {
  it("lands twelve singles and five threads in the list shape", () => {
    expect(campaignDraftCounts()).toEqual({ singles: 12, threads: 5 });
    expect(CAMPAIGN_SINGLES.every((draft) => draft.posts.length === 1)).toBe(
      true,
    );
    expect(CAMPAIGN_THREADS.map((draft) => draft.posts.length)).toEqual([
      6, 7, 6, 6, 6,
    ]);

    for (const draft of CAMPAIGN_SINGLES) {
      const post = draft.posts[0] ?? "";
      expect(post.startsWith("$")).toBe(true);
      expect(post).toMatch(/\n1\. \$/);
      expect(post.toLowerCase()).toContain("link in bio");
    }

    for (const thread of CAMPAIGN_THREADS) {
      expect(thread.posts[0]?.startsWith("$")).toBe(true);
      expect(thread.posts[0]).toMatch(/\n1\. \$/);
      expect(thread.posts.at(-1)?.toLowerCase()).toContain("link in bio");
    }
  });

  it("keeps the semiconductor thread first and the copper thread last", () => {
    expect(CAMPAIGN_THREADS[0]?.label).toContain("Semiconductors");
    expect(CAMPAIGN_THREADS[0]?.posts[0]).toMatch(/^\$ACLS sells ion implanters/);
    expect(CAMPAIGN_THREADS[4]?.label).toContain("Copper");
    expect(CAMPAIGN_THREADS[4]?.posts[0]).toMatch(/^\$MLI makes the copper tube/);
    expect(CAMPAIGN_SINGLES[0]?.posts[0]).toMatch(
      /^\$MOD's data-center SALES rose 90%/,
    );
    expect(CAMPAIGN_SINGLES[2]?.posts[0]).toContain("OUTSIDE");
    expect(CAMPAIGN_SINGLES[5]?.posts[0]).toMatch(/^\$MWA sells the hydrant/);
  });

  it("stores post text only, with no track record and no book-entry claim", () => {
    const blob = JSON.stringify([
      ...CAMPAIGN_SINGLES,
      ...CAMPAIGN_THREADS,
    ]).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase);
    }
    expect(blob).toContain("not a book entry");
    expect(blob).toContain("virtual");
    expect(blob).not.toContain("https://");
  });
});
