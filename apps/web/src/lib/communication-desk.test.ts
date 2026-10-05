import { describe, expect, it } from "vitest";
import {
  analysisSendDate,
  dailyGraphicPlan,
  isAnalysisSendDay,
  isEvaluationFriday,
  isoWeekKeyFromYmd,
  nextAnalysisSend,
  oneDecimalPct,
  pacificParts,
  ymdString,
} from "./comm-calendar";
import { buildDesk } from "./communication-desk";

describe("comm calendar", () => {
  it("treats the 1st and 3rd Fridays as evaluation days", () => {
    expect(isEvaluationFriday({ year: 2026, month: 10, day: 2 })).toBe(true);
    expect(isEvaluationFriday({ year: 2026, month: 10, day: 16 })).toBe(true);
    expect(isEvaluationFriday({ year: 2026, month: 10, day: 9 })).toBe(false);
    expect(isEvaluationFriday({ year: 2026, month: 10, day: 1 })).toBe(false);
  });

  it("moves a weekend 1st or 15th to the next weekday", () => {
    // 1 Aug 2026 is a Saturday.
    expect(ymdString(analysisSendDate(2026, 8, 1))).toBe("2026-08-03");
    expect(isAnalysisSendDay({ year: 2026, month: 8, day: 3 })).toBe(true);
    expect(isAnalysisSendDay({ year: 2026, month: 8, day: 1 })).toBe(false);
  });

  it("keys the next analysis send to the nominal half", () => {
    const next = nextAnalysisSend({ year: 2026, month: 8, day: 2 });
    expect(ymdString(next.when)).toBe("2026-08-03");
    expect(next.periodKey).toBe("2026-08-01");
  });

  it("assigns the three daily graphics to three windows, stably", () => {
    const first = dailyGraphicPlan("2026-10-05");
    const again = dailyGraphicPlan("2026-10-05");
    expect(first.map((slot) => slot.kind).sort()).toEqual([
      "headcount",
      "jobs",
      "revenue",
    ]);
    expect(first.map((slot) => slot.window)).toEqual([
      "morning",
      "midday",
      "afternoon",
    ]);
    expect(first.map((slot) => slot.postAt.toISOString())).toEqual(
      again.map((slot) => slot.postAt.toISOString()),
    );
    const hours = first.map((slot) => pacificParts(slot.postAt).hour);
    expect(hours[0]).toBeGreaterThanOrEqual(8);
    expect(hours[0]).toBeLessThan(10);
    expect(hours[2]).toBeGreaterThanOrEqual(16);
  });

  it("formats a signed percent to one decimal", () => {
    expect(oneDecimalPct(12.34)).toBe("+12.3%");
    expect(oneDecimalPct(-1.26)).toBe("-1.3%");
    expect(oneDecimalPct(-3.26)).toBe("-3.3%");
  });

  it("numbers the week containing 4 Oct 2026 as W40", () => {
    expect(isoWeekKeyFromYmd("2026-10-04")).toBe("2026-W40");
  });
});

describe("buildDesk", () => {
  const now = new Date("2026-10-05T15:00:00Z");

  it("opens the week of 5 Oct on Monday and asks for an unstarted note", () => {
    const desk = buildDesk(now);
    expect(desk.weekLabel).toContain("Oct");
    expect(desk.days[0]?.label).toContain("Monday");
    expect(desk.needsYou.some((card) => card.piece === "monday-market-note")).toBe(
      true,
    );
    expect(desk.days.some((day) => day.cards.some((card) => card.label === "Jobs"))).toBe(
      true,
    );
  });

  it("marks a confirmed Monday note as confirmed", () => {
    const desk = buildDesk(now, {
      marketNotes: [
        {
          periodKey: isoWeekKeyFromYmd("2026-10-05"),
          confirmedAt: "2026-10-04T18:00:00Z",
          sentAt: null,
          hasBody: true,
        },
      ],
      analyses: [],
      spotlights: [],
      lastPickSentAt: null,
      lastPickTicker: null,
      threads: [],
    });
    const note = desk.days
      .flatMap((day) => day.cards)
      .find((card) => card.piece === "monday-market-note");
    expect(note?.status).toBe("confirmed");
    expect(desk.needsYou.some((card) => card.id === note?.id)).toBe(false);
  });
});
