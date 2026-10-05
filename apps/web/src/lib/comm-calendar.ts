/**
 * When each Communication piece fires, in Pacific time.
 *
 * Evaluation Fridays match `packages/strategy` cadence.py: the Friday whose
 * day-of-month falls in 1–7 or 15–21. Market analysis sends on the 1st and
 * the 15th, moved to the next weekday when that date is a weekend.
 */

const PT = "America/Los_Angeles";

export type Ymd = { year: number; month: number; day: number };

export type PacificParts = Ymd & {
  hour: number;
  minute: number;
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type DailyKind = "jobs" | "headcount" | "revenue";
export type DailyWindow = "morning" | "midday" | "afternoon";

const WINDOWS: Record<DailyWindow, [number, number]> = {
  morning: [8 * 60, 10 * 60],
  midday: [12 * 60, 14 * 60],
  afternoon: [16 * 60, 17 * 60 + 30],
};

export type DailySlot = {
  kind: DailyKind;
  window: DailyWindow;
  postAt: Date;
};

export function pacificParts(date: Date): PacificParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  let day = Number(bag.day);
  let month = Number(bag.month);
  let year = Number(bag.year);
  if (hour === 24) {
    hour = 0;
    const next = addDays({ year, month, day }, 1);
    year = next.year;
    month = next.month;
    day = next.day;
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(bag.minute),
    weekday: WEEKDAY_INDEX[bag.weekday] ?? 0,
  };
}

export function ymdString(parts: Ymd): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function parseYmd(value: string): Ymd {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function addDays(parts: Ymd, days: number): Ymd {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function weekdayOf(parts: Ymd): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function isWeekend(parts: Ymd): boolean {
  const day = weekdayOf(parts);
  return day === 0 || day === 6;
}

/** Monday of the Pacific week that contains `date`. */
export function weekStart(date: Date): Ymd {
  const parts = pacificParts(date);
  const delta = parts.weekday === 0 ? -6 : 1 - parts.weekday;
  return addDays(parts, delta);
}

export function isoWeekKeyFromYmd(value: string): string {
  const { year, month, day } = parseYmd(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function isEvaluationFriday(parts: Ymd): boolean {
  if (weekdayOf(parts) !== 5) return false;
  return (parts.day >= 1 && parts.day <= 7) || (parts.day >= 15 && parts.day <= 21);
}

export function nextEvaluationFriday(from: Ymd): Ymd {
  let cursor = { ...from };
  for (let i = 0; i < 24; i++) {
    if (isEvaluationFriday(cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export function previousEvaluationFriday(before: Ymd): Ymd {
  let cursor = addDays(before, -1);
  for (let i = 0; i < 24; i++) {
    if (isEvaluationFriday(cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

/** The weekday a nominal 1st or 15th actually sends. */
export function analysisSendDate(year: number, month: number, nominalDay: 1 | 15): Ymd {
  let cursor: Ymd = { year, month, day: nominalDay };
  while (isWeekend(cursor)) cursor = addDays(cursor, 1);
  return cursor;
}

export function analysisPeriodKey(year: number, month: number, nominalDay: 1 | 15): string {
  return `${year}-${String(month).padStart(2, "0")}-${nominalDay === 1 ? "01" : "15"}`;
}

export function analysisNominalForSend(when: Ymd): 1 | 15 | null {
  for (const nominal of [1, 15] as const) {
    const send = analysisSendDate(when.year, when.month, nominal);
    if (ymdString(send) === ymdString(when)) return nominal;
  }
  return null;
}

export function isAnalysisSendDay(parts: Ymd): boolean {
  return analysisNominalForSend(parts) !== null;
}

export function nextAnalysisSend(from: Ymd): { when: Ymd; periodKey: string } {
  const months = [
    { year: from.year, month: from.month },
    from.month === 12
      ? { year: from.year + 1, month: 1 }
      : { year: from.year, month: from.month + 1 },
  ];
  const candidates = months.flatMap(({ year, month }) =>
    ([1, 15] as const).map((nominal) => ({
      when: analysisSendDate(year, month, nominal),
      periodKey: analysisPeriodKey(year, month, nominal),
    })),
  );
  const fromKey = ymdString(from);
  const upcoming = candidates
    .filter((item) => ymdString(item.when) >= fromKey)
    .sort((a, b) => ymdString(a.when).localeCompare(ymdString(b.when)));
  return upcoming[0];
}

export function nextWednesday(from: Ymd): Ymd {
  let cursor = { ...from };
  for (let i = 0; i < 8; i++) {
    if (weekdayOf(cursor) === 3) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/** Instant for a Pacific wall time. */
export function pacificInstant(parts: Ymd, hour: number, minute: number): Date {
  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ymd = `${parts.year}-${month}-${day}`;
  for (const offset of ["-07:00", "-08:00"]) {
    const date = new Date(`${ymd}T${hh}:${mm}:00${offset}`);
    const got = pacificParts(date);
    if (
      got.year === parts.year &&
      got.month === parts.month &&
      got.day === parts.day &&
      got.hour === hour &&
      got.minute === minute
    ) {
      return date;
    }
  }
  throw new Error(`Could not resolve ${ymd} ${hh}:${mm} PT`);
}

export function formatPacific(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatPacificDay(parts: Ymd): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(pacificInstant(parts, 12, 0));
}

export function formatPacificShort(parts: Ymd): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    month: "short",
    day: "numeric",
  }).format(pacificInstant(parts, 12, 0));
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * One jobs card, one headcount card, one revenue card.
 * The kind-to-window assignment is stable for a calendar day.
 */
export function dailyGraphicPlan(ymd: string): DailySlot[] {
  const day = parseYmd(ymd);
  const kinds = shuffle(
    ["jobs", "headcount", "revenue"] as const,
    hash(ymd),
  );
  const windows: DailyWindow[] = ["morning", "midday", "afternoon"];
  return windows.map((window, index) => {
    const [start, end] = WINDOWS[window];
    const minute = start + (hash(`${ymd}:${window}`) % (end - start));
    return {
      kind: kinds[index],
      window,
      postAt: pacificInstant(day, Math.floor(minute / 60), minute % 60),
    };
  });
}

export function oneDecimalPct(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "+";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}
