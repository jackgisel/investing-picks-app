/**
 * Figures for the X cards. Every number is taken off a stored statement,
 * an earnings row, or a workforce row — the same inputs the post text uses,
 * so the caption cannot claim something the picture does not show.
 */

import { countChars } from "@/lib/x-client";
import { money, pct, signedPct, signedPp } from "./format";
import type { IncomeFlow, PeriodType, StoredStatement } from "./model";
import type { IncomeVisual } from "./visual";

export type EarningsPrint = {
  date: string;
  eps_actual: number | null;
  eps_estimated: number | null;
  revenue_actual: number | null;
  revenue_estimated: number | null;
};

export type Surprise = {
  eps: number | null;
  revenue: number | null;
};

export type MixRow = {
  name: string;
  share: number;
  priorShare: number | null;
};

export type QuarterPoint = {
  label: string;
  revenue: number;
  operatingMargin: number | null;
};

export type RankRow = { ticker: string; value: number };

export type WeekEntry = {
  ticker: string;
  revenueYoy: number | null;
  /** Operating-margin change versus last year, in percentage points. */
  operatingMarginPp: number | null;
  epsSurprise: number | null;
};

export type WeekRanks = {
  revenue: RankRow[];
  margin: RankRow[];
  beat: RankRow | null;
  miss: RankRow | null;
};

export type WorkforceRow = {
  ticker: string;
  name: string | null;
  rev_per_employee: number | null;
  leverage: number | null;
  openings_per_1000: number | null;
  openings_change_90d: number | null;
  employees_yoy?: number | null;
  revenue_yoy?: number | null;
};

export type WorkforceSelection = {
  productivity: WorkforceRow[];
  leverage: WorkforceRow[];
  hiring: WorkforceRow[];
};

export type IncomeImageKind = "print" | "strip" | "mix" | "surprise" | "sankey";

export const WEEK_MIN = 4;
/** A hiring move worth a card: 25% more or fewer open roles over ~90 days. */
export const HIRING_MOVE = 0.25;

const DAY = 86_400_000;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ratio(actual: number | null, estimate: number | null): number | null {
  if (actual === null || estimate === null || estimate === 0) return null;
  return (actual - estimate) / Math.abs(estimate);
}

/**
 * The earnings row that belongs to this filing.
 *
 * The announcement date sits on or after the period end, usually within a
 * few weeks, and within a week of the accepted date when we have one.
 */
export function surpriseFor(
  statement: StoredStatement,
  earnings: EarningsPrint[] | null | undefined,
): Surprise | null {
  if (!earnings?.length) return null;
  const period = Date.parse(statement.period);
  const accepted = statement.accepted_date ? Date.parse(statement.accepted_date) : NaN;
  let best: { days: number; row: EarningsPrint } | null = null;
  for (const row of earnings) {
    const day = Date.parse(row.date);
    if (!Number.isFinite(day) || !Number.isFinite(period)) continue;
    const fromPeriod = (day - period) / DAY;
    const nearFiling = Number.isFinite(accepted) && Math.abs(day - accepted) / DAY <= 7;
    if ((fromPeriod < -5 || fromPeriod > 60) && !nearFiling) continue;
    const days = Number.isFinite(accepted) ? Math.abs(day - accepted) / DAY : Math.abs(fromPeriod);
    if (!best || days < best.days) best = { days, row };
  }
  if (!best) return null;
  const eps = ratio(best.row.eps_actual, best.row.eps_estimated);
  const revenue = ratio(best.row.revenue_actual, best.row.revenue_estimated);
  if (eps === null && revenue === null) return null;
  return { eps, revenue };
}

export function quarterStrip(statements: StoredStatement[]): QuarterPoint[] {
  const points: QuarterPoint[] = [];
  for (const st of statements) {
    if (st.period_type !== "quarter") continue;
    const revenue = finite(st.data.revenue);
    if (revenue === null || revenue <= 0) continue;
    const operating = finite(st.data.operatingIncome);
    points.push({
      label: st.fiscal_period || st.fiscal_label,
      revenue,
      operatingMargin: operating === null ? null : operating / revenue,
    });
    if (points.length === 8) break;
  }
  return points.reverse();
}

export function segmentMix(current: IncomeFlow, prior: IncomeFlow | null): MixRow[] | null {
  const segs = current.nodes.filter((n) => n.id.startsWith("seg:"));
  if (segs.length < 2 || current.revenue <= 0) return null;
  const priorShare = new Map<string, number>();
  if (prior && prior.revenue > 0) {
    for (const n of prior.nodes) {
      if (n.id.startsWith("seg:")) priorShare.set(n.label, n.value / prior.revenue);
    }
  }
  return segs.map((n) => ({
    name: n.label,
    share: n.value / current.revenue,
    priorShare: priorShare.get(n.label) ?? null,
  }));
}

export function mixLine(rows: MixRow[]): string | null {
  const top = [...rows].sort((a, b) => b.share - a.share)[0];
  if (!top) return null;
  const base = `${top.name} ${pct(top.share)} of revenue`;
  if (top.priorShare === null) return base;
  return `${base} (${signedPp((top.share - top.priorShare) * 100)})`;
}

function fit(lines: string[], extra: string): string[] {
  const next = [...lines, extra];
  return countChars(next.join("\n")) <= 280 ? next : lines;
}

export function incomeVisualCaption(
  visual: IncomeVisual,
  extras?: { surprise?: Surprise | null; mix?: MixRow[] | null },
): string {
  const { payload, statement, flow } = visual;
  const m = flow.metrics;
  const withChange = (base: string, change: string | null) =>
    change === null ? base : `${base} (${change})`;

  let lines = [`$${payload.ticker} ${statement.fiscal_label} income statement`, ""];
  lines.push(
    withChange(
      `Revenue ${money(flow.revenue, flow.currency)}`,
      m.revenueYoy === null ? null : `${signedPct(m.revenueYoy)} Y/Y`,
    ),
  );
  if (m.grossMargin !== null) {
    lines.push(
      withChange(
        `Gross margin ${pct(m.grossMargin)}`,
        m.grossMarginPriorPp === null ? null : signedPp(m.grossMarginPriorPp),
      ),
    );
  }
  if (m.operatingMargin !== null) {
    lines.push(
      withChange(
        `Operating margin ${pct(m.operatingMargin)}`,
        m.operatingMarginPriorPp === null ? null : signedPp(m.operatingMarginPriorPp),
      ),
    );
  }
  lines.push(
    m.netIncome > 0
      ? withChange(
          `Net income ${money(m.netIncome, flow.currency)}`,
          m.netIncomeYoy === null ? null : `${signedPct(m.netIncomeYoy)} Y/Y`,
        )
      : `Net loss ${money(-m.netIncome, flow.currency)}`,
  );
  const surprise = extras?.surprise;
  if (surprise?.eps !== null && surprise?.eps !== undefined) {
    lines = fit(lines, `EPS ${signedPct(surprise.eps)} vs estimate`);
  }
  if (surprise?.revenue !== null && surprise?.revenue !== undefined) {
    lines = fit(lines, `Revenue ${signedPct(surprise.revenue)} vs estimate`);
  }
  const mix = extras?.mix;
  if (mix && mix.length >= 2) {
    const line = mixLine(mix);
    if (line) lines = fit(lines, line);
  }
  return lines.join("\n");
}

/** Earnings posts are one chart: the mix when we have it, otherwise the sankey. */
export function incomeImagePlan(args: {
  mix: boolean;
  periodType?: PeriodType;
  strip?: boolean;
  surprise?: boolean;
}): IncomeImageKind[] {
  if (args.mix) return ["mix"];
  return ["sankey"];
}

function ends(rows: RankRow[], n = 5): RankRow[] {
  if (rows.length <= n * 2) return rows;
  return [...rows.slice(0, n), ...rows.slice(-n)];
}

export function weekRanks(entries: WeekEntry[]): WeekRanks | null {
  const revenue = entries
    .filter((e): e is WeekEntry & { revenueYoy: number } => e.revenueYoy !== null)
    .sort((a, b) => b.revenueYoy - a.revenueYoy)
    .map((e) => ({ ticker: e.ticker, value: e.revenueYoy }));
  if (revenue.length < WEEK_MIN) return null;
  const margin = entries
    .filter((e): e is WeekEntry & { operatingMarginPp: number } => e.operatingMarginPp !== null)
    .sort((a, b) => b.operatingMarginPp - a.operatingMarginPp)
    .map((e) => ({ ticker: e.ticker, value: e.operatingMarginPp }));
  const surprises = entries.filter(
    (e): e is WeekEntry & { epsSurprise: number } => e.epsSurprise !== null,
  );
  const beat = surprises.reduce<RankRow | null>(
    (best, e) => (e.epsSurprise > 0 && (!best || e.epsSurprise > best.value) ? { ticker: e.ticker, value: e.epsSurprise } : best),
    null,
  );
  const miss = surprises.reduce<RankRow | null>(
    (worst, e) => (e.epsSurprise < 0 && (!worst || e.epsSurprise < worst.value) ? { ticker: e.ticker, value: e.epsSurprise } : worst),
    null,
  );
  return { revenue: ends(revenue), margin: ends(margin), beat, miss };
}

export function weekPostText(ranks: WeekRanks): string {
  let lines = ["This week's reports", ""];
  const top = ranks.revenue[0];
  const bottom = ranks.revenue[ranks.revenue.length - 1];
  lines.push(`$${top.ticker} revenue ${signedPct(top.value)} Y/Y`);
  if (bottom && bottom.ticker !== top.ticker) {
    lines.push(`$${bottom.ticker} revenue ${signedPct(bottom.value)} Y/Y`);
  }
  if (ranks.margin.length) {
    const up = ranks.margin[0];
    const down = ranks.margin[ranks.margin.length - 1];
    lines = fit(lines, `$${up.ticker} operating margin ${signedPp(up.value)}`);
    if (down && down.ticker !== up.ticker) {
      lines = fit(lines, `$${down.ticker} operating margin ${signedPp(down.value)}`);
    }
  }
  if (ranks.beat) lines = fit(lines, `$${ranks.beat.ticker} EPS ${signedPct(ranks.beat.value)} vs estimate`);
  if (ranks.miss && ranks.miss.ticker !== ranks.beat?.ticker) {
    lines = fit(lines, `$${ranks.miss.ticker} EPS ${signedPct(ranks.miss.value)} vs estimate`);
  }
  return lines.join("\n");
}

export function workforceSelection(rows: WorkforceRow[]): WorkforceSelection | null {
  const productivity = [...rows]
    .filter((r) => r.rev_per_employee !== null && r.rev_per_employee > 0)
    .sort((a, b) => b.rev_per_employee! - a.rev_per_employee!)
    .slice(0, 10);
  if (productivity.length < WEEK_MIN) return null;
  const leverage = [...rows]
    .filter((r) => r.leverage !== null)
    .sort((a, b) => Math.abs(b.leverage!) - Math.abs(a.leverage!))
    .slice(0, 6);
  const hiring = [...rows]
    .filter((r) => r.openings_change_90d !== null && Math.abs(r.openings_change_90d) >= HIRING_MOVE)
    .sort((a, b) => Math.abs(b.openings_change_90d!) - Math.abs(a.openings_change_90d!))
    .slice(0, 6);
  return { productivity, leverage, hiring };
}

export function workforcePostText(selection: WorkforceSelection): string {
  let lines = ["Revenue per employee", ""];
  for (const row of selection.productivity.slice(0, 3)) {
    lines.push(`$${row.ticker} ${money(row.rev_per_employee!)}`);
  }
  const gap = selection.leverage[0];
  if (gap?.leverage != null) {
    const line = `$${gap.ticker} revenue vs headcount ${signedPp(gap.leverage * 100)}`;
    const withGap = [...lines, "", line];
    if (countChars(withGap.join("\n")) <= 280) lines = withGap;
  }
  const hire = selection.hiring[0];
  if (hire?.openings_change_90d != null) {
    lines = fit(
      lines,
      `$${hire.ticker} openings ${signedPct(hire.openings_change_90d)} in 90 days`,
    );
  }
  return lines.join("\n");
}

export type DailyGraphicKind = "jobs" | "headcount" | "revenue";

function dailyMetric(row: WorkforceRow, kind: DailyGraphicKind): number | null {
  if (kind === "jobs") return row.openings_change_90d;
  if (kind === "headcount") return row.employees_yoy ?? null;
  return row.revenue_yoy ?? null;
}

/** The names with the largest move on one workforce measure. */
export function dailyGraphicRows(
  rows: WorkforceRow[],
  kind: DailyGraphicKind,
): WorkforceRow[] | null {
  const ranked = rows
    .filter((row) => dailyMetric(row, kind) !== null)
    .sort((a, b) => Math.abs(dailyMetric(b, kind)!) - Math.abs(dailyMetric(a, kind)!))
    .slice(0, 5);
  return ranked.length >= 2 ? ranked : null;
}

export function dailyPostText(kind: DailyGraphicKind, rows: WorkforceRow[]): string {
  const lead = rows[0];
  const value = dailyMetric(lead, kind);
  if (value === null) return kind;
  if (kind === "jobs") {
    return `Open roles\n\n$${lead.ticker} openings ${signedPct(value)} in 90 days.`;
  }
  if (kind === "headcount") {
    return `Headcount\n\n$${lead.ticker} headcount ${signedPct(value)} year over year.`;
  }
  return `Revenue\n\n$${lead.ticker} revenue ${signedPct(value)} year over year.`;
}

/**
 * Friday from 16:00 US Eastern.
 *
 * Late enough that the week's morning prints are stored, and early enough
 * that the two-hour review window closes while the posting job is still
 * running (it stops at 17:00 Pacific).
 */
export function isFridayDraftWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday === "Fri" && hour >= 16;
}

/** Calendar date in US Eastern, the dedupe key for the Friday cards. */
export function etDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
