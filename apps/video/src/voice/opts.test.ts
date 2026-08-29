import { describe, expect, it } from "vitest";

import { parseForceScenes } from "./opts.js";

describe("parseForceScenes", () => {
  it("parses a single scene number", () => {
    expect(parseForceScenes("3")).toEqual(new Set([3]));
  });

  it("parses a comma-separated list", () => {
    expect(parseForceScenes("1,3,7")).toEqual(new Set([1, 3, 7]));
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseForceScenes(" 1, 3 , 7 ")).toEqual(new Set([1, 3, 7]));
  });

  it("de-duplicates repeated numbers", () => {
    expect(parseForceScenes("1,1,2")).toEqual(new Set([1, 2]));
  });

  it("rejects zero and negative numbers", () => {
    expect(() => parseForceScenes("0")).toThrow();
    expect(() => parseForceScenes("-1")).toThrow();
  });

  it("rejects non-numeric entries", () => {
    expect(() => parseForceScenes("a,b")).toThrow();
    expect(() => parseForceScenes("1,two")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => parseForceScenes("")).toThrow();
  });
});
