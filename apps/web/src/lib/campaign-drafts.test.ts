import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SINGLES,
  CAMPAIGN_THREADS,
  campaignDraftCounts,
} from "./campaign-drafts";

describe("campaign drafts", () => {
  it("lands twelve singles and five threads", () => {
    expect(campaignDraftCounts()).toEqual({ singles: 12, threads: 5 });
    expect(CAMPAIGN_SINGLES.every((draft) => draft.posts.length === 1)).toBe(
      true,
    );
    expect(CAMPAIGN_THREADS.map((draft) => draft.posts.length)).toEqual([
      8, 8, 8, 7, 9,
    ]);
  });

  it("keeps thread posts in order, starting with the semiconductor and copper threads", () => {
    expect(CAMPAIGN_THREADS[0]?.label).toContain("Semiconductors");
    expect(CAMPAIGN_THREADS[0]?.posts[0]).toMatch(
      /^The semiconductor post everyone writes/,
    );
    expect(CAMPAIGN_THREADS[0]?.posts[7]).toContain(
      "https://outpick.xyz/market-note",
    );
    expect(CAMPAIGN_THREADS[1]?.label).toContain("bronze");
    expect(CAMPAIGN_THREADS[1]?.posts[0]).toMatch(/^Bronze is an alloy/);
    expect(CAMPAIGN_THREADS[1]?.posts[7]).toContain(
      "https://outpick.xyz/market-note",
    );
  });

  it("stores post text only, not the campaign strategy notes", () => {
    const blob = JSON.stringify([...CAMPAIGN_SINGLES, ...CAMPAIGN_THREADS]);
    expect(blob).not.toContain("Research angle");
    expect(blob).not.toContain("Why this isn't generic");
    expect(blob).not.toContain("Campaign in five lines");
    expect(blob).not.toContain("SuperX");
    expect(CAMPAIGN_SINGLES[0]?.posts[0]).toMatch(
      /^The AI trade shows up in our screen as invoices\./,
    );
  });
});
