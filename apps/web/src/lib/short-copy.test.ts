import { describe, expect, it } from "vitest";
import { looksClean, numbersGrounded } from "./short-copy";

describe("numbersGrounded", () => {
  const facts = { return_pct: 101.46, milestone_pct: 100, backtest: 27.38 };

  it("accepts numbers that appear in the facts, rounded or not", () => {
    expect(numbersGrounded("Up 101.5% and past 100%.", facts)).toBe(true);
    expect(numbersGrounded("Up 101%, backtest drawdown 27.38%.", facts)).toBe(true);
  });

  it("rejects a number the facts do not contain", () => {
    expect(numbersGrounded("Up 120% this year.", facts)).toBe(false);
  });

  it("accepts text with no numbers", () => {
    expect(numbersGrounded("A good week for the book.", facts)).toBe(true);
  });
});

describe("looksClean", () => {
  it("rejects dashes used as punctuation", () => {
    expect(looksClean("Up 10% — a good week")).toBe(false);
    expect(looksClean("Up 10% -- a good week")).toBe(false);
  });
  it("allows hyphenated words", () => {
    expect(looksClean("A year-over-year gain.")).toBe(true);
  });
});
