import { describe, expect, it } from "vitest";
import { restrictToRadar } from "./market-note-ai";

const brief = {
  watchlist: [{ ticker: "AAA" }, { ticker: "BBB" }],
} as Parameters<typeof restrictToRadar>[1];

describe("restrictToRadar", () => {
  it("drops tickers the snapshot did not offer, such as holdings", () => {
    const out = restrictToRadar(
      [{ ticker: "aaa" }, { ticker: "HELD" }, { ticker: "BBB" }],
      brief,
    );
    expect(out.map((i) => i.ticker)).toEqual(["aaa", "BBB"]);
  });

  it("drops duplicates", () => {
    const out = restrictToRadar([{ ticker: "AAA" }, { ticker: "aaa" }], brief);
    expect(out).toHaveLength(1);
  });
});
