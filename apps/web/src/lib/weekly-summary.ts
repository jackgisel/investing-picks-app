import { PUBLIC_API_BASE } from "@/lib/api-config";
import { claimDispatch, isoWeekKey, releaseDispatch } from "@/lib/email-dispatch";
import { sendWeeklySummaryEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/preferences";
import type { PickStat, WeeklyMove } from "@/lib/email-templates";

/**
 * The Sunday digest: how the book did, and what moved.
 *
 * One send per ISO week, claimed in `email_dispatch` before the first message
 * leaves. The worker fires this on a schedule and the schedule can fire twice —
 * a redeploy, a clock change, an operator pressing the manual button — so the
 * claim rather than the trigger is what makes it weekly.
 *
 * Percentages only. No position sizes, no dollar P&L, no entry prices. That
 * rule holds on every published surface and a digest is not the exception.
 */

export type WeeklySummaryResult = {
  sent: number;
  failed: number;
  total: number;
  weekKey: string;
  skipped?: "already_sent" | "no_recipients" | "no_data";
  errors: { email: string; error: string }[];
};

type PerformanceSummary = {
  picks_return_pct?: number | null;
  total_return_pct?: number | null;
  position_count?: number | null;
};

type PerformancePoint = { date?: string; return_pct?: number | null };

type ApiTrade = {
  ticker?: string | null;
  side?: string | null;
  date?: string | null;
};

/** "3–9 August 2026" — the week the digest covers. */
export function periodLabel(weekEnd: Date): string {
  const start = new Date(weekEnd);
  start.setDate(start.getDate() - 6);
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  const sameMonth = start.getUTCMonth() === weekEnd.getUTCMonth();
  const left = sameMonth
    ? `${start.getUTCDate()}`
    : `${start.getUTCDate()} ${month.format(start)}`;
  return `${left}–${weekEnd.getUTCDate()} ${month.format(weekEnd)} ${weekEnd.getUTCFullYear()}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/**
 * Change over the trailing week, from the equity curve.
 *
 * The series carries since-inception returns, so the week's move is the
 * difference between two points on it — not the last point, which is the whole
 * run. Returns null when there is no point at least a week old to compare
 * against, because a "this week" figure computed from four days of a new book
 * is a different claim than the one the label makes.
 */
export function weekChangePct(series: PerformancePoint[]): number | null {
  const points = series.filter(
    (p): p is { date: string; return_pct: number } =>
      typeof p.date === "string" && typeof p.return_pct === "number",
  );
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - 7);

  // The last point at or before the cutoff — the book as it stood a week ago.
  let prior: { date: string; return_pct: number } | null = null;
  for (const p of points) {
    if (new Date(p.date) <= cutoff) prior = p;
    else break;
  }
  if (!prior) return null;

  // Both numbers are since-inception percentages off the same base, so the
  // difference of the two multiples is the week's return on that base.
  const a = 1 + prior.return_pct / 100;
  const b = 1 + latest.return_pct / 100;
  if (a <= 0) return null;
  return (b / a - 1) * 100;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Trades in the seven days ending `weekEnd`, newest first. */
export function movesInWeek(trades: ApiTrade[], weekEnd: Date): WeeklyMove[] {
  const start = new Date(weekEnd);
  start.setDate(start.getDate() - 6);

  return trades
    .filter((t) => {
      if (!t.date || !t.ticker) return false;
      const d = new Date(t.date);
      return d >= start && d <= weekEnd;
    })
    .map((t) => ({
      ticker: t.ticker!.toUpperCase(),
      // Reader-facing words. The internal action vocabulary (conviction_add,
      // recycle, winners_circle_trim) describes machinery a subscriber has no
      // reason to decode, and leaking it has bitten this codebase before.
      action: t.side === "sell" ? "Sold" : "Bought",
      when: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(t.date!)),
    }));
}

export async function sendWeeklySummary(
  opts: { now?: Date; force?: boolean } = {},
): Promise<WeeklySummaryResult> {
  const now = opts.now ?? new Date();
  const weekKey = isoWeekKey(now);
  const base: WeeklySummaryResult = {
    sent: 0,
    failed: 0,
    total: 0,
    weekKey,
    errors: [],
  };

  const [perf, tradesBody] = await Promise.all([
    getJson<{ summary?: PerformanceSummary; series?: PerformancePoint[] }>(
      "/performance",
    ),
    getJson<{ trades?: ApiTrade[] }>("/trades?limit=100"),
  ]);

  // No numbers means no digest. Mailing the list a message whose figures are
  // all em-dashes is worse than staying quiet for a week, and the claim is not
  // taken, so the next run can still send if the API recovers.
  if (!perf?.summary) return { ...base, skipped: "no_data" };

  const recipients = await getOptedInRecipients("weeklySummary");
  if (recipients.length === 0) return { ...base, skipped: "no_recipients" };

  // Claim before sending. `force` is for the ops button and deliberately still
  // writes the claim afterwards — it skips the check, not the record.
  if (!opts.force && !(await claimDispatch("weekly_summary", weekKey, recipients.length))) {
    return { ...base, skipped: "already_sent" };
  }

  const summary = perf.summary;
  const week = weekChangePct(perf.series ?? []);
  const stats: PickStat[] = [
    {
      label: "This week",
      value: week === null ? "" : pct(week),
      direction: week === null ? undefined : week >= 0 ? "up" : "down",
    },
    {
      label: "Picks, since inception",
      value:
        typeof summary.picks_return_pct === "number"
          ? pct(summary.picks_return_pct)
          : "",
      direction:
        typeof summary.picks_return_pct === "number"
          ? summary.picks_return_pct >= 0
            ? "up"
            : "down"
          : undefined,
    },
    {
      label: "Open positions",
      value:
        typeof summary.position_count === "number"
          ? String(summary.position_count)
          : "",
    },
  ];

  const moves = movesInWeek(tradesBody?.trades ?? [], now);
  const label = periodLabel(now);

  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((r) =>
        sendWeeklySummaryEmail({
          to: r.email,
          userId: r.id,
          recipientName: r.name,
          periodLabel: label,
          stats,
          moves,
        }).then((res) => ({ email: r.email, ...res })),
      ),
    );
    for (const r of results) {
      if (r.ok) sent += 1;
      else {
        failed += 1;
        errors.push({ email: r.email, error: r.error ?? "unknown" });
      }
    }
  }

  // Nothing left at all — the mailer is down rather than a few addresses being
  // bad. Give the claim back so next run retries; a partial send keeps it,
  // because there is no un-send for the ones that did go out.
  if (sent === 0 && failed > 0 && !opts.force) {
    await releaseDispatch("weekly_summary", weekKey);
  }

  return { ...base, sent, failed, total: recipients.length, errors };
}
