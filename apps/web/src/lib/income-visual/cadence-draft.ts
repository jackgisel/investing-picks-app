import { withAiRead } from "@/lib/short-copy";
import {
  dailyGraphicPlan,
  isEvaluationFriday,
  oneDecimalPct,
  pacificInstant,
  pacificParts,
  previousEvaluationFriday,
  ymdString,
} from "@/lib/comm-calendar";
import { holdingFromPriorCycle, pickResultText } from "@/lib/editorial-copy";
import { fetchBookPositions } from "@/lib/held-tickers";
import {
  dailyGraphicRows,
  dailyPostText,
  type DailyGraphicKind,
  type WorkforceRow,
} from "@/lib/income-visual/graphics";
import { fetchThemeWorkforce } from "@/lib/income-visual/server";
import { themeOf, themeTickers } from "@/lib/income-visual/themes";
import { fetchIncomeList } from "@/lib/income-visual/server";
import { createThreadDraft, getThreadByKey, type XThreadKind } from "@/lib/x-threads-db";

const KIND: Record<DailyGraphicKind, XThreadKind> = {
  jobs: "jobs_visual",
  headcount: "headcount_visual",
  revenue: "revenue_visual",
};

async function openTickers(): Promise<Set<string> | null> {
  const list = await fetchIncomeList(1);
  return list ? new Set(list.held.map((item) => item.ticker)) : null;
}

/** Draft today's three graphics if this is a weekday and they are not queued yet. */
export async function draftDailyGraphics(now = new Date()): Promise<string[]> {
  const parts = pacificParts(now);
  if (parts.weekday === 0 || parts.weekday === 6) return [];
  const ymd = ymdString(parts);
  const held = await openTickers();
  if (!held) return [];
  const rows = await fetchThemeWorkforce(themeTickers());
  if (!rows) return [];
  const eligible = rows.filter((row) => themeOf(row.ticker) && !held.has(row.ticker));
  const drafted: string[] = [];
  for (const slot of dailyGraphicPlan(ymd)) {
    const kind = KIND[slot.kind];
    if (await getThreadByKey(kind, ymd)) continue;
    const selected = dailyGraphicRows(eligible, slot.kind);
    if (!selected) continue;
    const facts = {
      summary: `${slot.kind} ${ymd}`,
      post_at: slot.postAt.toISOString(),
      graphic: slot.kind,
      rows: selected,
      tickers: selected.map((row) => row.ticker),
    };
    const { created } = await createThreadDraft({
      kind,
      dedupeKey: ymd,
      posts: [await withAiRead(dailyPostText(slot.kind, selected), { rows: selected })],
      facts,
    });
    if (created) drafted.push(slot.kind);
  }
  return drafted;
}

/** On an evaluation Friday, draft the prior cycle's pick result. */
export async function draftPickResult(now = new Date()): Promise<string | null> {
  const parts = pacificParts(now);
  if (!isEvaluationFriday(parts)) return null;
  const ymd = ymdString(parts);
  if (await getThreadByKey("pick_result", ymd)) return null;
  const positions = await fetchBookPositions();
  if (!positions) return null;
  const prior = ymdString(previousEvaluationFriday(parts));
  const holding = holdingFromPriorCycle(positions, prior);
  if (!holding || holding.pnlPct === null) return null;
  const workforce = await fetchThemeWorkforce([holding.ticker]);
  const revenue = workforce?.find((row) => row.ticker === holding.ticker)?.revenue_yoy;
  if (typeof revenue !== "number") return null;
  const revenuePct = revenue * 100;
  const at = pacificInstant(parts, 15, 0);
  const text = pickResultText(holding.ticker, holding.pnlPct, revenuePct);
  const { created } = await createThreadDraft({
    kind: "pick_result",
    dedupeKey: ymd,
    posts: [text],
    facts: {
      summary: `${holding.ticker} since ${holding.entryDate ?? prior}`,
      post_at: at.toISOString(),
      ticker: holding.ticker,
      return_pct: holding.pnlPct,
      revenue_pct: revenuePct,
      return_label: oneDecimalPct(holding.pnlPct),
      revenue_label: oneDecimalPct(revenuePct),
      tickers: [holding.ticker],
    },
  });
  return created ? holding.ticker : null;
}

export function rowsFromFacts(value: unknown): WorkforceRow[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  return value as WorkforceRow[];
}
