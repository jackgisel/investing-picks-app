import { writeShort } from "@/lib/short-copy";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { claimDispatch } from "@/lib/email-dispatch";
import { sendPerformanceAlertEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/preferences";
import type { PickStat } from "@/lib/email-templates";

/**
 * Milestone and drawdown notifications.
 *
 * Two things fire one: a position crossing a gain threshold for the first time,
 * and the picks falling a set distance below their own high-water mark.
 *
 * "For the first time" is the entire difficulty. A position sitting at +103%
 * is over the 100% line every single day, so a naive check mails the list daily
 * until it falls back. The dedupe key is therefore the EVENT — `WDC:100`, or
 * the drawdown band — not the day, so each threshold announces itself once and
 * then never again.
 *
 * Thresholds are coarse on purpose. A milestone at every 10% would train
 * subscribers to ignore the mail, which costs more than the alerts are worth.
 */

/** Gain thresholds, ascending. A position crossing one announces itself once. */
export const MILESTONE_THRESHOLDS = [50, 100, 200] as const;

/** Picks drawdown bands from the high-water mark, deepening. */
export const DRAWDOWN_THRESHOLDS = [10, 20, 30] as const;

export type PerformanceAlertResult = {
  fired: { key: string; headline: string; sent: number; failed: number }[];
  skipped: string[];
  errors: { key: string; error: string }[];
};

type OpsHolding = {
  ticker?: string | null;
  pnl_pct?: number | null;
};

type PerformanceSummary = {
  picks_drawdown_pct?: number | null;
  picks_peak_date?: string | null;
};

/**
 * The deepest threshold `value` has crossed, or null.
 *
 * Deepest rather than every one it passed: a position that gaps from +40% to
 * +210% overnight should announce +200%, not send three emails. The ones it
 * skipped are still claimed by the caller so they cannot fire later on the way
 * back down.
 */
export function crossedThreshold(
  value: number,
  thresholds: readonly number[],
): number | null {
  let hit: number | null = null;
  for (const t of thresholds) {
    if (value >= t) hit = t;
  }
  return hit;
}

async function apiJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The model's wording for an alert's detail, or the template when it cannot be trusted. */
async function alertDetail(
  template: string,
  facts: Record<string, unknown>,
): Promise<string> {
  const written = await writeShort({
    role: "You write the body of a short alert email to subscribers about their portfolio's picks.",
    ask: "Write two or three plain sentences for the alert body. Say what happened, put it in context from FACTS, and do not tell the reader to act.",
    facts,
    maxChars: 600,
  });
  return written ?? template;
}

async function fanOut(
  key: string,
  kind: "milestone" | "drawdown",
  headline: string,
  detail: string,
  stats: PickStat[],
): Promise<{ sent: number; failed: number }> {
  const recipients = await getOptedInRecipients("performanceAlerts");
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((r) =>
        sendPerformanceAlertEmail({
          to: r.email,
          userId: r.id,
          recipientName: r.name,
          kind,
          headline,
          detail,
          stats,
        }),
      ),
    );
    for (const r of results) r.ok ? (sent += 1) : (failed += 1);
  }
  return { sent, failed };
}

export async function runPerformanceAlerts(): Promise<PerformanceAlertResult> {
  const result: PerformanceAlertResult = {
    fired: [],
    skipped: [],
    errors: [],
  };

  // Straight from the API, not the web app's /api/data proxy, which
  // anonymises tickers for non-subscribers: an alert that says "a position
  // crossed +100%" without naming it is not worth sending. These used to read
  // /api/ops/strategy and /api/ops/performance, which do not exist, so every
  // run got a 404 and no alert of either kind ever fired.
  const strategy = await apiJson<{ holdings?: OpsHolding[] }>("/strategy");
  const perf = await apiJson<{ summary?: PerformanceSummary }>("/performance");

  /* ------------------------------ Milestones ----------------------------- */

  for (const h of strategy?.holdings ?? []) {
    const ticker = h.ticker?.toUpperCase();
    if (!ticker || typeof h.pnl_pct !== "number") continue;

    const hit = crossedThreshold(h.pnl_pct, MILESTONE_THRESHOLDS);
    if (hit === null) continue;

    // Claim every threshold at or below the one reached, so a position that
    // jumped straight past the lower bands can never announce them later.
    let won = false;
    for (const t of MILESTONE_THRESHOLDS) {
      if (t > hit) break;
      const claimed = await claimDispatch("performance_alert", `${ticker}:${t}`);
      if (t === hit) won = claimed;
    }
    if (!won) {
      result.skipped.push(`${ticker}:${hit}`);
      continue;
    }

    const headline = `${ticker} has doubled`;
    const templateDetail =
      hit >= 100
        ? `${ticker} is now up ${h.pnl_pct.toFixed(1)}% since we opened the position. It has crossed +${hit}% for the first time.`
        : `${ticker} is up ${h.pnl_pct.toFixed(1)}% since we opened the position, crossing +${hit}% for the first time.`;
    const detail = await alertDetail(templateDetail, {
      kind: "milestone",
      ticker,
      return_since_opened_pct: Number(h.pnl_pct.toFixed(1)),
      milestone_pct: hit,
    });

    try {
      const { sent, failed } = await fanOut(
        `${ticker}:${hit}`,
        "milestone",
        hit >= 100 ? headline : `${ticker} is up ${hit}%`,
        detail,
        [
          {
            label: "Position return",
            value: `${h.pnl_pct >= 0 ? "+" : ""}${h.pnl_pct.toFixed(2)}%`,
            direction: h.pnl_pct >= 0 ? "up" : "down",
          },
          { label: "Milestone", value: `+${hit}%` },
        ],
      );
      result.fired.push({
        key: `${ticker}:${hit}`,
        headline,
        sent,
        failed,
      });
    } catch (e) {
      result.errors.push({
        key: `${ticker}:${hit}`,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /* ------------------------------ Drawdown ------------------------------- */

  // Time-weighted, so a new buy is a flow rather than a loss. The whole-book
  // equity curve this used to read is mostly idle cash and could not fall 10%.
  const drawdown = perf?.summary?.picks_drawdown_pct ?? null;
  const peakDate = perf?.summary?.picks_peak_date ?? null;
  if (typeof drawdown === "number" && peakDate) {
    const band = crossedThreshold(drawdown, DRAWDOWN_THRESHOLDS);
    if (band !== null) {
      // Keyed by band AND by the peak it fell from, so picks that recover to
      // a new high and later fall 10% again are a NEW event rather than one
      // permanently silenced by the first occurrence.
      const key = `drawdown:${band}:${peakDate}`;
      if (await claimDispatch("performance_alert", key)) {
        try {
          const { sent, failed } = await fanOut(
            key,
            "drawdown",
            `The picks are ${drawdown.toFixed(1)}% off their high`,
            await alertDetail(
              `The picks have fallen ${drawdown.toFixed(1)}% from their high-water mark, crossing the ${band}% mark. Drawdowns are part of the strategy. The published backtest had a maximum drawdown of 27.38%, and we are not changing the process in response to this one.`,
              {
                kind: "drawdown",
                picks_off_high_pct: Number(drawdown.toFixed(1)),
                band_pct: band,
                published_backtest_max_drawdown_pct: 27.38,
                process_change: "none; drawdowns are part of the strategy",
              },
            ),
            [
              {
                label: "Off the high",
                value: `-${drawdown.toFixed(2)}%`,
                direction: "down",
              },
              { label: "Band", value: `${band}%` },
            ],
          );
          result.fired.push({
            key,
            headline: `Picks ${drawdown.toFixed(1)}% off their high`,
            sent,
            failed,
          });
        } catch (e) {
          result.errors.push({
            key,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        result.skipped.push(key);
      }
    }
  }

  return result;
}
