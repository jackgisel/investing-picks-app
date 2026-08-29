/**
 * Small formatting helpers shared by the slides and charts. Mirrors the
 * site's own formatters (`apps/web/src/lib/portfolio.ts`,
 * `picks-benchmark-chart.tsx`) closely enough that a number reads the same
 * way here as it does on the dashboard — a leading sign, two decimals for a
 * percent, an em dash for a missing value.
 */

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatPctTick(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

/** "2026-04-10" -> "Apr 10". Parsed as UTC so the label never slips a day. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "2026-04-10" -> "Thu, Apr 10". */
export function formatWeekdayDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * What a period is measured from, in words — ported from `periodCaption` in
 * `apps/web/src/lib/period-returns.ts`. The comment there explains why this
 * matters: "Week to date" without its anchor invites reading the number
 * against the wrong start, particularly on a Monday, when "this week" and
 * "today" are the same move.
 */
export function periodCaption(fromDate: string | null | undefined): string {
  const from = formatWeekdayDate(fromDate);
  if (!from) return "No prior session";
  return `since ${from} close`;
}

/** "2026-04-10" -> "Apr 10, 2026". */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "2026-08" (the coarse, week/month-granularity date a redacted row keeps) -> "August 2026". */
export function formatCoarseMonth(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function toneForValue(value: number | null | undefined): "up" | "down" | "neutral" {
  if (value === null || value === undefined || !Number.isFinite(value)) return "neutral";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}
