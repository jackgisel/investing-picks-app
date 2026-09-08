import { describe, expect, it } from "vitest";
import {
  addDateFromSlug,
  addSlug,
  doubleBuyAdds,
  insightCategoryLabel,
  shouldAnnounceAdd,
} from "@/lib/insights";

describe("addSlug", () => {
  it("keys a conviction add on ticker and trade date", () => {
    expect(addSlug("SEZL", "2026-09-04")).toBe("add-sezl-2026-09-04");
    expect(addSlug("sezl", "2026-09-04T20:00:00Z")).toBe("add-sezl-2026-09-04");
  });
});

describe("addDateFromSlug", () => {
  it("reads the trailing date back out", () => {
    expect(addDateFromSlug("add-sezl-2026-09-04")).toBe("2026-09-04");
    expect(addDateFromSlug("add-sezl-pending")).toBeNull();
  });
});

describe("insightCategoryLabel", () => {
  it("names an add with the ticker", () => {
    expect(insightCategoryLabel({ postType: "add", ticker: "SEZL" })).toBe(
      "Add · SEZL",
    );
  });
});

describe("shouldAnnounceAdd", () => {
  const tuesday = new Date("2026-09-08T16:00:00.000Z");

  it("mails a Friday add published through Sunday", () => {
    expect(shouldAnnounceAdd("2026-09-04", new Date("2026-09-05T18:00:00Z"))).toBe(
      true,
    );
    expect(shouldAnnounceAdd("2026-09-04", new Date("2026-09-06T18:00:00Z"))).toBe(
      true,
    );
  });

  it("does not mail a Friday add discovered on Tuesday", () => {
    expect(shouldAnnounceAdd("2026-09-04", tuesday)).toBe(false);
  });

  it("refuses a missing or unparseable date", () => {
    expect(shouldAnnounceAdd(null, tuesday)).toBe(false);
    expect(shouldAnnounceAdd("pending", tuesday)).toBe(false);
  });
});

describe("doubleBuyAdds", () => {
  it("maps Friday's SEZL fill to one add key", () => {
    expect(
      doubleBuyAdds([
        {
          ticker: "sezl",
          action: "double_buy",
          date: "2026-09-04",
        },
        { ticker: "WDC", action: "buy", date: "2026-09-04" },
        {
          ticker: "SEZL",
          action: "double_buy",
          date: "2026-09-04T20:00:00Z",
        },
      ]),
    ).toEqual([{ ticker: "SEZL", date: "2026-09-04" }]);
  });
});
