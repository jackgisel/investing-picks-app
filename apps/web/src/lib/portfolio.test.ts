import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closedWinRate,
  comparePnl,
  computeAnnualizedReturn,
  computeBookReturnPct,
  computePortfolioReturnPct,
  countDoubledWinners,
  countWinningPositions,
  daysBetweenISO,
  daysSinceInception,
  describeLiveCagr,
  formatDayMonth,
  formatPct,
  formatPctOrDash,
  formatUsd,
  formatWeekdayDate,
  foundersDealDaysRemaining,
  isFoundersDealActive,
  pnlClass,
  resolveLiveCagr,
} from "./portfolio";
import { FOUNDERS_DEAL_ENDS_ISO, LIVE_PORTFOLIO } from "./constants";

afterEach(() => {
  vi.useRealTimers();
});

/** Sets the clock to `days` after the live portfolio's inception. */
function setDayNumber(days: number) {
  vi.useFakeTimers();
  const inception = new Date(`${LIVE_PORTFOLIO.inceptionISO}T00:00:00Z`);
  vi.setSystemTime(new Date(inception.getTime() + days * 86400000));
}

describe("pnlClass", () => {
  // Three bugs this replaced: null rendering green, flat rendering green, and
  // `?? 0` turning an unknown return into a "+0.00%" gain.
  it("renders an unknown return as dim, not green", () => {
    expect(pnlClass(null)).toBe("text-text-dim");
    expect(pnlClass(undefined)).toBe("text-text-dim");
  });

  it("renders exactly flat as muted, not green", () => {
    expect(pnlClass(0)).toBe("text-text-muted");
  });

  it("renders gains green and losses red", () => {
    expect(pnlClass(0.01)).toBe("text-accent-green");
    expect(pnlClass(-0.01)).toBe("text-accent-red");
  });

  // NaN is a number by typeof, so it lands in the flat branch. Pinning the
  // current behaviour: muted is a defensible render for a broken value, and
  // the alternative (green) is the bug this function exists to prevent.
  it("treats NaN as flat rather than as a gain", () => {
    expect(pnlClass(Number.NaN)).toBe("text-text-muted");
  });
});

describe("formatPct / formatPctOrDash", () => {
  it("never turns an unknown value into a number", () => {
    expect(formatPctOrDash(null)).toBe("—");
    expect(formatPctOrDash(undefined)).toBe("—");
  });

  it("keeps a real zero as zero", () => {
    expect(formatPctOrDash(0)).toBe("+0.00%");
  });

  it("carries the sign so colour is never the only signal", () => {
    expect(formatPct(12.5)).toBe("+12.50%");
    expect(formatPct(-12.5)).toBe("-12.50%");
  });

  it("honours a digit override", () => {
    expect(formatPct(12.345, 1)).toBe("+12.3%");
  });
});

describe("formatUsd", () => {
  it("renders an unknown as a dash", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
  });

  it("formats whole dollars", () => {
    expect(formatUsd(12450)).toBe("$12,450");
    expect(formatUsd(-200)).toBe("-$200");
  });
});

describe("computePortfolioReturnPct vs computeBookReturnPct", () => {
  const strategy = {
    portfolio: { picks_return_pct: 31.3, total_return_pct: 12.1 },
  } as never;

  // A one-character mixup between these two silently swaps the headline
  // number for the cash-dragged one. Asserted together on purpose.
  it("read different fields", () => {
    expect(computePortfolioReturnPct(strategy)).toBe(31.3);
    expect(computeBookReturnPct(strategy)).toBe(12.1);
  });

  it("returns a picks return of exactly 0 rather than falling through", () => {
    const flat = {
      portfolio: { picks_return_pct: 0, total_return_pct: 9.9 },
    } as never;
    expect(computePortfolioReturnPct(flat)).toBe(0);
  });

  it("falls back to the equity return only for legacy payloads", () => {
    const legacy = { portfolio: { total_return_pct: 5 } } as never;
    expect(computePortfolioReturnPct(legacy)).toBe(5);
  });

  it("does not substitute the book return when picks_return_pct is explicitly null", () => {
    const measured = {
      portfolio: { picks_return_pct: null, total_return_pct: 12.1 },
    } as never;
    expect(computePortfolioReturnPct(measured)).toBeNull();
  });

  it("returns null with no portfolio", () => {
    expect(computePortfolioReturnPct(undefined)).toBeNull();
    expect(computeBookReturnPct(undefined)).toBeNull();
  });
});

describe("computeAnnualizedReturn", () => {
  it("refuses to annualize a window shorter than the minimum", () => {
    expect(computeAnnualizedReturn(10, 5, 30)).toBeNull();
  });

  it("refuses a total loss, which has no meaningful rate", () => {
    expect(computeAnnualizedReturn(-100, 365, 30)).toBeNull();
    expect(computeAnnualizedReturn(-150, 365, 30)).toBeNull();
  });

  it("returns the input rate when the window is exactly a year", () => {
    expect(computeAnnualizedReturn(50, 365, 30)).toBeCloseTo(50, 6);
  });
});

describe("resolveLiveCagr", () => {
  // The one gate on a published performance claim.
  it("prefers the API verdict so backend and marketing cannot drift", () => {
    const r = resolveLiveCagr(
      10,
      {
        annualized_status: "ok",
        annualized_return_pct: 42,
        days_live: 400,
        days_recorded: 400,
      },
      "equity",
    );
    expect(r).toMatchObject({ status: "ok", value: 42 });
  });

  it("downgrades an 'ok' verdict that carries no number", () => {
    const r = resolveLiveCagr(
      10,
      {
        annualized_status: "ok",
        annualized_return_pct: null,
        days_live: 400,
        days_recorded: 400,
      },
      "equity",
    );
    expect(r).toMatchObject({ status: "unavailable", value: null });
  });

  it("blanks the value for any non-ok API verdict", () => {
    const r = resolveLiveCagr(
      10,
      {
        annualized_status: "window_too_short",
        annualized_return_pct: 999,
        days_live: 5,
        days_recorded: 5,
      },
      "equity",
    );
    expect(r).toMatchObject({ status: "window_too_short", value: null });
  });

  it("falls back to the local rule for an unrecognised API status", () => {
    const r = resolveLiveCagr(
      10,
      {
        annualized_status: "something_new",
        days_live: 5,
        days_recorded: 5,
        min_window_days: 30,
      },
      "equity",
    );
    expect(r.status).toBe("window_too_short");
  });

  it("is unavailable with no return at all", () => {
    const r = resolveLiveCagr(
      null,
      { days_live: 400, days_recorded: 400 },
      "equity",
    );
    expect(r).toMatchObject({ status: "unavailable", value: null });
  });

  it("is unavailable on day zero", () => {
    const r = resolveLiveCagr(10, { days_live: 0, days_recorded: 0 }, "equity");
    expect(r).toMatchObject({ status: "unavailable" });
  });

  it("refuses to annualize before the minimum window", () => {
    const r = resolveLiveCagr(
      10,
      { days_live: 10, days_recorded: 10, min_window_days: 30 },
      "equity",
    );
    expect(r.status).toBe("window_too_short");
  });

  // The chart must be able to back up the claim.
  it("refuses when recorded history does not cover the days claimed", () => {
    const r = resolveLiveCagr(
      10,
      { days_live: 400, days_recorded: 10, min_window_days: 30 },
      "equity",
    );
    expect(r.status).toBe("insufficient_history");
  });

  it("reports not_meaningful for a total loss", () => {
    const r = resolveLiveCagr(
      -100,
      { days_live: 400, days_recorded: 400, min_window_days: 30 },
      "equity",
    );
    expect(r.status).toBe("not_meaningful");
  });

  /**
   * The regression this argument exists for.
   *
   * Production on 2026-08-09 carried exactly this summary: the picks were up
   * 21.36% while the whole book was up 2.14%, because under 12% of the capital
   * was deployed. The landing page rendered the picks return as its headline
   * and then took `annualized_return_pct` — 6.43%, the *equity* return
   * annualized — as the figure beside it.
   */
  describe("basis selection (the +21.36% beside +6.43% bug)", () => {
    const PROD = {
      annualized_status: "ok",
      annualized_return_pct: 6.43,
      picks_annualized_status: "ok",
      picks_annualized_return_pct: 76.78,
      days_live: 124,
      days_recorded: 122,
      min_window_days: 90,
    };

    it("returns the picks CAGR beside a picks headline", () => {
      expect(resolveLiveCagr(21.36, PROD, "picks")).toMatchObject({
        status: "ok",
        value: 76.78,
      });
    });

    it("returns the equity CAGR beside an equity headline", () => {
      expect(resolveLiveCagr(2.14, PROD, "equity")).toMatchObject({
        status: "ok",
        value: 6.43,
      });
    });

    it("never reads the equity figure for a picks caller", () => {
      // The literal old behaviour: same call, wrong number.
      expect(resolveLiveCagr(21.36, PROD, "picks").value).not.toBe(6.43);
    });

    it("honours a per-basis refusal independently", () => {
      // The picks return can be annualizable while the equity one is not —
      // a wiped-out book beside picks that made money. Each basis carries its
      // own verdict and must not inherit the other's.
      const mixed = {
        ...PROD,
        annualized_status: "not_meaningful",
        annualized_return_pct: null,
      };
      expect(resolveLiveCagr(2.14, mixed, "equity").status).toBe(
        "not_meaningful",
      );
      expect(resolveLiveCagr(21.36, mixed, "picks")).toMatchObject({
        status: "ok",
        value: 76.78,
      });
    });

    it("falls back to the local rule when the picks pair is absent", () => {
      // An older API deploy publishes only the equity pair. A picks caller must
      // compute locally from the number it was given rather than silently
      // borrowing the equity figure.
      const equityOnly = {
        annualized_status: "ok",
        annualized_return_pct: 6.43,
        days_live: 124,
        days_recorded: 122,
        min_window_days: 90,
      };
      const r = resolveLiveCagr(21.36, equityOnly, "picks");
      expect(r.status).toBe("ok");
      expect(r.value).toBeCloseTo(76.78, 1);
      expect(r.value).not.toBe(6.43);
    });
  });
});

describe("describeLiveCagr", () => {
  it("says nothing when the number is publishable", () => {
    expect(
      describeLiveCagr({
        status: "ok",
        value: 10,
        daysLive: 400,
        daysRecorded: 400,
        minWindowDays: 30,
      }),
    ).toBeNull();
  });

  it.each([
    ["window_too_short"],
    ["insufficient_history"],
    ["not_meaningful"],
    ["unavailable"],
  ] as const)("explains %s rather than leaving a bare dash", (status) => {
    const msg = describeLiveCagr({
      status,
      value: null,
      daysLive: 400,
      daysRecorded: 10,
      minWindowDays: 30,
    });
    expect(msg).toBeTruthy();
    expect(msg!.length).toBeGreaterThan(10);
  });
});

describe("countDoubledWinners / countWinningPositions", () => {
  const holdings = [
    { ticker: "A", pnl_pct: 150 },
    { ticker: "B", pnl_pct: 100 },
    { ticker: "C", pnl_pct: 99.9 },
    { ticker: "D", pnl_pct: 0 },
    { ticker: "E", pnl_pct: -20 },
  ] as never;

  // Feeds a public claim, so the boundary matters.
  it("counts exactly 100% as doubled", () => {
    expect(countDoubledWinners(holdings)).toBe(2);
  });

  it("honours a custom threshold", () => {
    expect(countDoubledWinners(holdings, 99)).toBe(3);
  });

  it("counts only positions actually in the green", () => {
    expect(countWinningPositions(holdings)).toBe(3);
  });

  it("returns zero rather than throwing with no holdings", () => {
    expect(countDoubledWinners(undefined)).toBe(0);
    expect(countWinningPositions(undefined)).toBe(0);
  });
});

describe("daysSinceInception / daysBetweenISO", () => {
  it("counts whole days from inception", () => {
    setDayNumber(42);
    expect(daysSinceInception()).toBe(42);
  });

  it("never reports negative days for a future inception", () => {
    setDayNumber(-10);
    expect(daysSinceInception()).toBe(0);
  });

  it("measures a span between two dates", () => {
    expect(daysBetweenISO("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("floors a reversed span at zero", () => {
    expect(daysBetweenISO("2026-01-31", "2026-01-01")).toBe(0);
  });
});

describe("isFoundersDealActive", () => {
  // Gates the price shown on the landing page and the server-side Stripe coupon.
  const cutoff = new Date(`${FOUNDERS_DEAL_ENDS_ISO}T12:00:00Z`).getTime();
  const dayMs = 86_400_000;

  it("is active on the cutoff date", () => {
    expect(isFoundersDealActive(cutoff)).toBe(true);
  });

  it("is over the UTC day after the cutoff", () => {
    expect(isFoundersDealActive(cutoff + dayMs)).toBe(false);
  });

  it("is over well after the cutoff", () => {
    expect(isFoundersDealActive(cutoff + 30 * dayMs)).toBe(false);
  });

  it("reads the clock when given no instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(cutoff + dayMs));
    expect(isFoundersDealActive()).toBe(false);
    vi.setSystemTime(new Date(cutoff));
    expect(isFoundersDealActive()).toBe(true);
  });

  it("never counts remaining days below zero", () => {
    expect(foundersDealDaysRemaining(cutoff + 99 * dayMs)).toBe(0);
  });

  it("counts the cutoff date as one day remaining", () => {
    expect(
      foundersDealDaysRemaining(new Date(`${FOUNDERS_DEAL_ENDS_ISO}T00:00:00Z`).getTime()),
    ).toBe(1);
  });
});

describe("calendar date formatting", () => {
  // These are calendar dates — a scoring date, an evaluation Friday — not
  // instants. `new Date("2026-08-07")` is UTC midnight, so a naive
  // implementation renders the 6th for every viewer west of Greenwich and the
  // dashboard quietly promises picks a day early.
  it("does not shift the date across timezones", () => {
    expect(formatDayMonth("2026-08-07")).toBe("Aug 7");
    expect(formatWeekdayDate("2026-08-07")).toBe("Fri, Aug 7");
  });

  it("formats a scoring date", () => {
    expect(formatDayMonth("2026-07-26")).toBe("Jul 26");
  });

  it("accepts a full timestamp and keeps the calendar day", () => {
    expect(formatDayMonth("2026-01-01T23:30:00Z")).toBe("Jan 1");
  });

  it("returns null rather than 'Invalid Date' for missing or junk input", () => {
    expect(formatDayMonth(null)).toBeNull();
    expect(formatDayMonth(undefined)).toBeNull();
    expect(formatDayMonth("")).toBeNull();
    expect(formatDayMonth("not-a-date")).toBeNull();
    expect(formatWeekdayDate(null)).toBeNull();
    expect(formatWeekdayDate("2026-13-45")).toBeNull();
  });
});

describe("closedWinRate", () => {
  // The tile used to count OPEN positions marked above cost and call them
  // "winners". That is an unrealized number: a book that opened into a rising
  // fortnight shows 8 of 8 and has proven nothing.
  it("counts only closed positions that finished above cost", () => {
    expect(
      closedWinRate([{ pnl_pct: 12 }, { pnl_pct: -4 }, { pnl_pct: 30 }]),
    ).toEqual({ wins: 2, total: 3, pct: (2 / 3) * 100 });
  });

  it("is null, not zero, when nothing has closed yet", () => {
    // 0% is a claim about the record. "No record yet" is the truth.
    expect(closedWinRate([])).toEqual({ wins: 0, total: 0, pct: null });
    expect(closedWinRate(undefined)).toEqual({ wins: 0, total: 0, pct: null });
  });

  it("excludes an unknown result from both sides rather than scoring it a loss", () => {
    const r = closedWinRate([{ pnl_pct: 10 }, { pnl_pct: null }]);
    expect(r).toEqual({ wins: 1, total: 1, pct: 100 });
  });

  it("treats exactly flat as not a win", () => {
    expect(closedWinRate([{ pnl_pct: 0 }])).toEqual({
      wins: 0,
      total: 1,
      pct: 0,
    });
  });
});

describe("comparePnl", () => {
  // The API now sends null for an unrecoverable cost basis instead of a
  // confident 0.00%. `a.pnl_pct - b.pnl_pct` against a null is NaN, and a NaN
  // comparator makes the entire sort arbitrary — which would seed the "top
  // performers" and "worst performers" lists with positions nobody knows the
  // return of.
  it("sorts an unknown last in both directions", () => {
    const vals = [5, null, -3, 12];
    expect([...vals].sort((a, b) => comparePnl(a, b, "desc"))).toEqual([
      12, 5, -3, null,
    ]);
    expect([...vals].sort((a, b) => comparePnl(a, b, "asc"))).toEqual([
      -3, 5, 12, null,
    ]);
  });

  it("treats NaN as unknown rather than as a value", () => {
    expect(comparePnl(Number.NaN, 5, "desc")).toBeGreaterThan(0);
    expect(comparePnl(5, Number.NaN, "desc")).toBeLessThan(0);
  });

  it("is stable when both are unknown", () => {
    expect(comparePnl(null, undefined)).toBe(0);
  });

  it("keeps a real zero ordered as a value, not as unknown", () => {
    expect([5, 0, null].sort((a, b) => comparePnl(a, b, "desc"))).toEqual([
      5, 0, null,
    ]);
  });
});

describe("counters exclude an unknown return", () => {
  it("does not count an unknown as a winner or a doubled winner", () => {
    const holdings = [
      { pnl_pct: 150 },
      { pnl_pct: null },
      { pnl_pct: 5 },
    ] as never;
    expect(countWinningPositions(holdings)).toBe(2);
    expect(countDoubledWinners(holdings)).toBe(1);
  });
});
