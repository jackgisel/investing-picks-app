/**
 * Friday weekly review — helpers safe to import from client components.
 *
 * The drafting, the claim, and the send live in sibling modules that touch
 * `pg` or Anthropic. This file is the calendar math and nothing else.
 */

const PACIFIC = "America/Los_Angeles";

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Construct "this wall-clock in `timeZone`" as a UTC instant by guessing
  // UTC and correcting by the offset Intl reports. Noon Pacific is never in
  // a DST gap, so the single correction is exact.
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utc));
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    n("hour"),
    n("minute"),
    n("second"),
  );
  return new Date(utc - (asIfUtc - utc));
}

function pacificYmd(d: Date): {
  year: number;
  month: number;
  day: number;
  weekday: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const v = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(v("year")),
    month: Number(v("month")),
    day: Number(v("day")),
    weekday: v("weekday"),
  };
}

/**
 * Friday 12:00 America/Los_Angeles of the ISO week containing `from`.
 *
 * Sunday belongs to the week whose Friday already happened, so the offset
 * from Sunday is minus two days, not plus five. DST is a Sunday 02:00
 * switch, so adding whole days from a Thursday/Friday noon never lands in
 * the gap.
 */
export function fridayNoonPacific(from: Date = new Date()): Date {
  const ymd = pacificYmd(from);
  const dow = WEEKDAY[ymd.weekday] ?? 0;
  const offsetDays = dow === 0 ? -2 : 5 - dow;
  const noonToday = zonedDate(ymd.year, ymd.month, ymd.day, 12, 0, PACIFIC);
  return new Date(noonToday.getTime() + offsetDays * 24 * 60 * 60 * 1000);
}

/** True once Friday noon PT of this ISO week has passed. */
export function isPastFridayNoon(from: Date = new Date()): boolean {
  return from.getTime() >= fridayNoonPacific(from).getTime();
}

/** "12:00 PM PDT on Friday, Aug 21" — the deadline shown in ops and admin mail. */
export function fridayNoonLabel(from: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(fridayNoonPacific(from));
}
