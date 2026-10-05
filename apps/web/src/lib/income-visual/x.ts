import {
  countIncomeVisualsToday,
  createThreadDraft,
  displaceIncomeVisual,
  getThreadByKey,
  smallestOpenIncomeVisualToday,
  type XThread,
} from "@/lib/x-threads-db";
import { uploadImage, type XCredentials } from "@/lib/x-client";
import { draftDailyGraphics, draftPickResult, rowsFromFacts } from "./cadence-draft";
import {
  surpriseFor,
  type Surprise,
  type WeekRanks,
  type WorkforceSelection,
} from "./graphics";
import { themeOf } from "./themes";
import type { PeriodType } from "./model";
import {
  fetchIncomeList,
  fetchIncomePayload,
  dailyNodes,
  incomePostNodes,
  incomeVisualDedupeKey,
  incomeVisualFrom,
  incomeVisualKey,
  incomeVisualPostText,
  mixFor,
  pickResultNode,
  renderSharePng,
  weekNodes,
  workforceNodes,
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
  theme?: string;
  surprise?: Surprise | null;
  /** Set on automatic drafts only; it is what lets a bigger print displace one. */
  market_cap?: number;
};

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

function factsFor(visual: IncomeVisual, theme: string): IncomeVisualFacts {
  const m = visual.flow.metrics;
  const parts = [
    theme,
    `${visual.payload.name ?? visual.payload.ticker} ${visual.statement.fiscal_label}`,
  ];
  if (m.revenueYoy !== null) parts.push(`revenue ${Math.round(m.revenueYoy * 100)}% Y/Y`);
  return {
    ticker: visual.payload.ticker,
    name: visual.payload.name,
    period_type: visual.statement.period_type,
    period: visual.statement.period,
    fiscal_label: visual.statement.fiscal_label,
    theme,
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
  const theme = themeOf(payload.ticker);
  if (!theme) {
    return { ok: false, status: 422, error: `${ticker} is outside the X theme list` };
  }
  const visual = incomeVisualFrom(payload);
  if (!visual) {
    return { ok: false, status: 422, error: `${ticker}'s latest statement cannot be drawn` };
  }
  const surprise = surpriseFor(visual.statement, payload.earnings);
  const mix = mixFor(visual);
  const { thread, created } = await createThreadDraft({
    kind: "income_visual",
    dedupeKey: incomeVisualDedupeKey(visual),
    posts: [incomeVisualPostText(visual, { surprise, mix })],
    facts: {
      ...factsFor(visual, theme),
      ...(surprise ? { surprise } : {}),
      ...(typeof marketCap === "number" ? { market_cap: marketCap } : {}),
    },
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
  const list = perDay > 0 ? await fetchIncomeList(RECENT_DAYS) : null;
  if (perDay > 0 && !list) {
    result.skipped.push({ ticker: "*", reason: "income statement list unavailable" });
  }

  let room = perDay - alreadyToday;
  // Largest first. Quarters take the slots; a fiscal year only fills what is left.
  for (const item of list?.recent ?? []) {
    if (!themeOf(item.ticker)) continue;
    const marketCap = item.market_cap ?? 0;
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

  if (room > 0) {
    for (const item of list?.annual ?? []) {
      if (room <= 0) break;
      if (!themeOf(item.ticker)) continue;
      if (await getThreadByKey("income_visual", incomeVisualKey(item.ticker, "annual", item.period))) {
        continue;
      }
      const queued = await queueIncomeVisual(item.ticker, "annual", item.market_cap ?? undefined);
      if (!queued.ok) {
        result.skipped.push({ ticker: item.ticker, reason: queued.error });
        continue;
      }
      if (!queued.created) continue;
      result.drafted.push(item.ticker);
      room -= 1;
    }
  }

  const daily = await draftDailyGraphics();
  const pick = await draftPickResult();
  result.drafted.push(...daily);
  if (pick) result.drafted.push(pick);
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
  if (thread.kind === "jobs_visual" || thread.kind === "headcount_visual" || thread.kind === "revenue_visual") {
    return dailyMedia(thread, credentials);
  }
  if (thread.kind === "pick_result") return pickMedia(thread, credentials);
  if (thread.kind === "week_roundup") return weekMedia(thread, credentials);
  if (thread.kind === "workforce_visual") return workforceMedia(thread, credentials);
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
  const surprise = storedSurprise(facts.surprise);
  const eyebrow = facts.theme ?? themeOf(payload.ticker) ?? "Earnings";
  try {
    return {
      ok: true,
      mediaIds: await uploadNodes(
        credentials,
        incomePostNodes(visual, { eyebrow, surprise, mix: mixFor(visual) }),
      ),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reject: false };
  }
}

function storedSurprise(value: unknown): Surprise | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Surprise>;
  const eps = typeof row.eps === "number" ? row.eps : null;
  const revenue = typeof row.revenue === "number" ? row.revenue : null;
  return eps === null && revenue === null ? null : { eps, revenue };
}

async function uploadNodes(
  credentials: XCredentials,
  nodes: Parameters<typeof renderSharePng>[0][],
): Promise<string[]> {
  const ids: string[] = [];
  for (const node of nodes) ids.push(await uploadImage(credentials, await renderSharePng(node)));
  return ids;
}

async function heldTickers(): Promise<Set<string> | null> {
  const list = await fetchIncomeList(1);
  return list ? new Set(list.held.map((item) => item.ticker)) : null;
}

async function dailyMedia(thread: XThread, credentials: XCredentials): Promise<MediaOutcome> {
  const graphic = thread.facts.graphic;
  if (graphic !== "jobs" && graphic !== "headcount" && graphic !== "revenue") {
    return { ok: false, error: "Daily card is missing its graphic", reject: true };
  }
  const rows = rowsFromFacts(thread.facts.rows);
  if (!rows) return { ok: false, error: "Daily card is missing its rows", reject: true };
  const held = await heldTickers();
  if (!held) return { ok: false, error: "Could not re-check the book", reject: false };
  const hit = tickersOf(thread.facts).find((ticker) => held.has(ticker));
  if (hit) return { ok: false, error: `${hit} entered the book; not posting`, reject: true };
  try {
    return { ok: true, mediaIds: await uploadNodes(credentials, dailyNodes(graphic, rows)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reject: false };
  }
}

async function pickMedia(thread: XThread, credentials: XCredentials): Promise<MediaOutcome> {
  const ticker = typeof thread.facts.ticker === "string" ? thread.facts.ticker : null;
  const returnLabel = typeof thread.facts.return_label === "string" ? thread.facts.return_label : null;
  const revenueLabel = typeof thread.facts.revenue_label === "string" ? thread.facts.revenue_label : null;
  if (!ticker || !returnLabel || !revenueLabel) {
    return { ok: false, error: "Pick result is missing its figures", reject: true };
  }
  try {
    return {
      ok: true,
      mediaIds: await uploadNodes(credentials, [pickResultNode({ ticker, returnLabel, revenueLabel })]),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reject: false };
  }
}

function tickersOf(facts: Record<string, unknown>): string[] {
  return Array.isArray(facts.tickers) ? facts.tickers.filter((t): t is string => typeof t === "string") : [];
}

async function weekMedia(thread: XThread, credentials: XCredentials): Promise<MediaOutcome> {
  const ranks = thread.facts.ranks as WeekRanks | undefined;
  if (!ranks || !Array.isArray(ranks.revenue) || ranks.revenue.length < 4) {
    return { ok: false, error: "Week card is missing its rankings", reject: true };
  }
  const held = await heldTickers();
  if (!held) return { ok: false, error: "Could not re-check the book", reject: false };
  const hit = tickersOf(thread.facts).find((ticker) => held.has(ticker));
  if (hit) return { ok: false, error: `${hit} entered the book; not posting`, reject: true };
  try {
    return { ok: true, mediaIds: await uploadNodes(credentials, weekNodes(ranks)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reject: false };
  }
}

async function workforceMedia(thread: XThread, credentials: XCredentials): Promise<MediaOutcome> {
  const selection = thread.facts.selection as WorkforceSelection | undefined;
  if (!selection || !Array.isArray(selection.productivity) || selection.productivity.length < 4) {
    return { ok: false, error: "Workforce card is missing its rows", reject: true };
  }
  const held = await heldTickers();
  if (!held) return { ok: false, error: "Could not re-check the book", reject: false };
  const hit = tickersOf(thread.facts).find((ticker) => held.has(ticker));
  if (hit) return { ok: false, error: `${hit} entered the book; not posting`, reject: true };
  try {
    return { ok: true, mediaIds: await uploadNodes(credentials, workforceNodes(selection)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reject: false };
  }
}
