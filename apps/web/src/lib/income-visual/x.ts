import {
  countIncomeVisualsToday,
  createThreadDraft,
  displaceIncomeVisual,
  getThreadByKey,
  smallestOpenIncomeVisualToday,
  type XThread,
} from "@/lib/x-threads-db";
import { uploadImage, type XCredentials } from "@/lib/x-client";
import type { PeriodType } from "./model";
import {
  fetchIncomeList,
  fetchIncomePayload,
  incomeVisualDedupeKey,
  incomeVisualFrom,
  incomeVisualKey,
  incomeVisualPostText,
  renderIncomeVisualPng,
  type IncomeVisual,
} from "./server";

/**
 * Income visuals on X: which names, how many, and when they post.
 *
 *   X_INCOME_VISUALS_AUTO_POST     false/0/off stops auto-confirm; drafts then
 *                                  wait for the Confirm button like any thread.
 *   X_INCOME_VISUAL_REVIEW_HOURS   window between draft and auto-confirm (2).
 *   X_INCOME_VISUALS_PER_DAY       drafts per trading day (3).
 */

export type IncomeVisualFacts = {
  ticker: string;
  name: string | null;
  period_type: PeriodType;
  period: string;
  fiscal_label: string;
  summary: string;
  /** Set on automatic drafts only; it is what lets a bigger print displace one. */
  market_cap?: number;
};

/** Below this, a print is not one our audience is waiting on. */
export const MIN_MARKET_CAP = 5_000_000_000;
/** How far back a filing still counts as news: today's and yesterday's. */
const RECENT_DAYS = 2;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function incomeVisualConfig() {
  const flag = (process.env.X_INCOME_VISUALS_AUTO_POST ?? "").trim().toLowerCase();
  return {
    autoPost: !["false", "0", "off", "no"].includes(flag),
    reviewHours: envNumber("X_INCOME_VISUAL_REVIEW_HOURS", 2),
    perDay: Math.floor(envNumber("X_INCOME_VISUALS_PER_DAY", 3)),
  };
}

function factsFor(visual: IncomeVisual): IncomeVisualFacts {
  const m = visual.flow.metrics;
  const parts = [`${visual.payload.name ?? visual.payload.ticker} ${visual.statement.fiscal_label}`];
  if (m.revenueYoy !== null) parts.push(`revenue ${Math.round(m.revenueYoy * 100)}% Y/Y`);
  return {
    ticker: visual.payload.ticker,
    name: visual.payload.name,
    period_type: visual.statement.period_type,
    period: visual.statement.period,
    fiscal_label: visual.statement.fiscal_label,
    summary: parts.join(", "),
  };
}

export type QueueResult =
  | { ok: true; threadId: string; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Queue one ticker's latest statement as an X draft.
 *
 * Refuses a name in the book. The visual is public data, but a post about a
 * holding is a post about a pick, and picks are what members pay for.
 */
export async function queueIncomeVisual(
  ticker: string,
  periodType: PeriodType = "quarter",
  marketCap?: number,
): Promise<QueueResult> {
  const payload = await fetchIncomePayload(ticker, periodType);
  if (!payload || payload.statements.length === 0) {
    return { ok: false, status: 404, error: `No stored income statement for ${ticker}` };
  }
  if (payload.held) {
    return {
      ok: false,
      status: 409,
      error: `${ticker} is in the book. Income visuals for holdings stay in the app.`,
    };
  }
  const visual = incomeVisualFrom(payload);
  if (!visual) {
    return { ok: false, status: 422, error: `${ticker}'s latest statement cannot be drawn` };
  }
  const { thread, created } = await createThreadDraft({
    kind: "income_visual",
    dedupeKey: incomeVisualDedupeKey(visual),
    posts: [incomeVisualPostText(visual)],
    facts: { ...factsFor(visual), ...(marketCap ? { market_cap: marketCap } : {}) },
  });
  return { ok: true, threadId: thread.id, created };
}

export type DraftIncomeVisualsResult = {
  drafted: string[];
  displaced: { ticker: string; by: string }[];
  skipped: { ticker: string; reason: string }[];
  cap: number;
  alreadyToday: number;
};

/**
 * Draft the freshest prints for X, largest company first, up to the day's cap.
 *
 * Called on every worker watch tick, so a tick with nothing new costs one
 * list read and a key lookup per candidate — nothing is fetched or rendered
 * for a print that already has a draft. Once the cap is reached, a larger
 * company displaces the smallest automatic draft still in its review window:
 * prints arrive all day, and a mega-cap reporting after the close should not
 * lose its slot to the morning's smaller names.
 */
export async function draftIncomeVisuals(): Promise<DraftIncomeVisualsResult> {
  const { perDay } = incomeVisualConfig();
  const alreadyToday = await countIncomeVisualsToday();
  const result: DraftIncomeVisualsResult = {
    drafted: [],
    displaced: [],
    skipped: [],
    cap: perDay,
    alreadyToday,
  };
  if (perDay <= 0) return result;

  const list = await fetchIncomeList(RECENT_DAYS);
  if (!list) {
    result.skipped.push({ ticker: "*", reason: "income statement list unavailable" });
    return result;
  }

  let room = perDay - alreadyToday;
  // `recent` is largest first, so the first name under the floor ends the loop.
  for (const item of list.recent) {
    const marketCap = item.market_cap ?? 0;
    if (marketCap < MIN_MARKET_CAP) break;
    if (await getThreadByKey("income_visual", incomeVisualKey(item.ticker, "quarter", item.period))) {
      continue;
    }

    let displace: { id: string; ticker: string } | null = null;
    if (room <= 0) {
      const smallest = await smallestOpenIncomeVisualToday();
      if (!smallest || smallest.marketCap >= marketCap) break;
      displace = smallest;
    }

    const queued = await queueIncomeVisual(item.ticker, "quarter", marketCap);
    if (!queued.ok) {
      result.skipped.push({ ticker: item.ticker, reason: queued.error });
      continue;
    }
    if (!queued.created) continue;
    result.drafted.push(item.ticker);
    // Queue first, displace second: a failed render must not cost the day
    // the draft it already had.
    if (displace) {
      if (await displaceIncomeVisual(displace.id, item.ticker)) {
        result.displaced.push({ ticker: displace.ticker, by: item.ticker });
      }
    } else {
      room -= 1;
    }
  }
  return result;
}

export type MediaOutcome =
  | { ok: true; mediaIds: string[] }
  | { ok: false; error: string; reject: boolean };

/**
 * Render and upload the image for a claimed income-visual thread.
 *
 * Re-checks the book at post time: a name can be bought between the morning
 * draft and the afternoon tick, and `reject` tells the caller to retire the
 * draft rather than retry it.
 */
export async function incomeVisualMedia(
  thread: XThread,
  credentials: XCredentials,
): Promise<MediaOutcome> {
  const facts = thread.facts as Partial<IncomeVisualFacts>;
  if (!facts.ticker || !facts.period) {
    return { ok: false, error: "Draft is missing its ticker or period", reject: true };
  }
  const payload = await fetchIncomePayload(facts.ticker, facts.period_type ?? "quarter");
  if (!payload) return { ok: false, error: "Income statement unavailable", reject: false };
  if (payload.held) {
    return { ok: false, error: `${facts.ticker} entered the book; not posting`, reject: true };
  }
  const visual = incomeVisualFrom(payload, facts.period);
  if (!visual) {
    return { ok: false, error: `No drawable statement for ${facts.period}`, reject: true };
  }
  try {
    const png = await renderIncomeVisualPng(visual);
    return { ok: true, mediaIds: [await uploadImage(credentials, png)] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reject: false };
  }
}
