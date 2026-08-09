import { OPS_API_BASE } from "@/lib/api-config";
import { opsHeaders } from "@/lib/admin";
import { claimDispatch } from "@/lib/email-dispatch";
import { sendPerformanceAlertEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/preferences";
import type { PickStat } from "@/lib/email-templates";

/**
 * Milestone and drawdown notifications.
 *
 * Two things fire one: a position crossing a gain threshold for the first time,
 * and the whole book falling a set distance below its own high-water mark.
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

/** Book drawdown bands from the high-water mark, deepening. */
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

type PerformancePoint = { date?: string; return_pct?: number | null };

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

/**
 * Peak-to-current decline of the equity curve, as a positive percent.
 *
 * Computed off the since-inception series, so the high-water mark is the best
 * the book has ever closed rather than the best inside some window.
 */
export function currentDrawdownPct(series: PerformancePoint[]): number | null {
  const points = series
    .map((p) => p.return_pct)
    .filter((n): n is number => typeof n === "number");
  if (points.length < 2) return null;

  const peak = Math.max(...points);
  const latest = points[points.length - 1];
  const peakMult = 1 + peak / 100;
  if (peakMult <= 0) return null;
  const decline = (1 - (1 + latest / 100) / peakMult) * 100;
  return decline > 0 ? decline : 0;
}

async function opsJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${OPS_API_BASE}${path}`, {
      headers: opsHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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

  // Holdings come from the OPS surface, not /api/data: the public one
  // anonymises tickers for non-subscribers, and an alert that says "a position
  // crossed +100%" without naming it is not worth sending.
  const strategy = await opsJson<{ holdings?: OpsHolding[] }>("/strategy");
  const perf = await opsJson<{ series?: PerformancePoint[] }>("/performance");

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
    const detail =
      hit >= 100
        ? `${ticker} is now up ${h.pnl_pct.toFixed(1)}% since we opened the position. It has crossed +${hit}% for the first time.`
        : `${ticker} is up ${h.pnl_pct.toFixed(1)}% since we opened the position, crossing +${hit}% for the first time.`;

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

  const drawdown = currentDrawdownPct(perf?.series ?? []);
  if (drawdown !== null) {
    const band = crossedThreshold(drawdown, DRAWDOWN_THRESHOLDS);
    if (band !== null) {
      // Keyed by band AND by the peak it fell from, so a book that recovers to
      // a new high and later falls 10% again is a NEW event rather than one
      // permanently silenced by the first occurrence.
      const peak = Math.max(
        ...(perf?.series ?? [])
          .map((p) => p.return_pct)
          .filter((n): n is number => typeof n === "number"),
      );
      const key = `drawdown:${band}:${peak.toFixed(0)}`;
      if (await claimDispatch("performance_alert", key)) {
        try {
          const { sent, failed } = await fanOut(
            key,
            "drawdown",
            `The portfolio is ${drawdown.toFixed(1)}% off its high`,
            `The book has fallen ${drawdown.toFixed(1)}% from its high-water mark, crossing the ${band}% mark. Drawdowns are part of the strategy — the published backtest has a maximum drawdown of 27.38% — and we are not changing the process in response to this one.`,
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
            headline: `Portfolio ${drawdown.toFixed(1)}% off its high`,
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
