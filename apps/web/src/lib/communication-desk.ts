/**
 * The week desk: what fires this week, and the one thing after it.
 *
 * Pure. The route loads issues and threads; this decides the words on the cards.
 */

import type { CommunicationPieceId } from "@/lib/communication";
import {
  addDays,
  analysisNominalForSend,
  analysisPeriodKey,
  dailyGraphicPlan,
  formatPacific,
  formatPacificDay,
  formatPacificShort,
  isEvaluationFriday,
  isoWeekKeyFromYmd,
  pacificInstant,
  pacificParts,
  parseYmd,
  weekdayOf,
  weekStart,
  ymdString,
  type DailyKind,
  type Ymd,
} from "@/lib/comm-calendar";

export type DeskStatus =
  | "needs_you"
  | "confirmed"
  | "sent"
  | "posted"
  | "failed"
  | "skipped"
  | "scheduled";

export type DeskAudience = "Free" | "Paid" | "X";

export type DeskCard = {
  id: string;
  piece: CommunicationPieceId;
  label: string;
  audience: DeskAudience;
  at: string;
  day: string;
  timeLabel: string;
  status: DeskStatus;
  detail: string;
};

export type DeskModel = {
  weekLabel: string;
  needsYou: DeskCard[];
  days: { day: string; label: string; cards: DeskCard[] }[];
  comingUp: DeskCard | null;
};

export type IssueSnap = {
  periodKey: string;
  confirmedAt: string | null;
  sentAt: string | null;
  hasBody: boolean;
  ticker?: string | null;
};

export type ThreadSnap = {
  id: string;
  kind: string;
  label: string;
  postAt: string | null;
  dedupeKey: string;
  status: "draft" | "posted" | "failed" | "rejected";
  error: string | null;
};

export type DeskSnapshot = {
  marketNotes: IssueSnap[];
  analyses: IssueSnap[];
  spotlights: IssueSnap[];
  lastPickSentAt: string | null;
  lastPickTicker: string | null;
  threads: ThreadSnap[];
};

const DAILY_KIND: Record<DailyKind, string> = {
  jobs: "jobs_visual",
  headcount: "headcount_visual",
  revenue: "revenue_visual",
};

const DAILY_LABEL: Record<DailyKind, string> = {
  jobs: "Jobs",
  headcount: "Headcount",
  revenue: "Revenue",
};

const EMPTY: DeskSnapshot = {
  marketNotes: [],
  analyses: [],
  spotlights: [],
  lastPickSentAt: null,
  lastPickTicker: null,
  threads: [],
};

function findIssue(rows: IssueSnap[], periodKey: string): IssueSnap | null {
  return rows.find((row) => row.periodKey === periodKey) ?? null;
}

function emailStatus(issue: IssueSnap | null, at: Date, now: Date): Pick<DeskCard, "status" | "detail"> {
  if (issue?.sentAt) return { status: "sent", detail: "Sent" };
  if (issue?.confirmedAt) {
    if (now.getTime() < at.getTime() + 6 * 60 * 60 * 1000) {
      return {
        status: "confirmed",
        detail: now.getTime() < at.getTime() ? "Confirmed" : "Waiting on the send",
      };
    }
    return { status: "needs_you", detail: "Confirmed but not sent" };
  }
  if (now.getTime() >= at.getTime()) return { status: "skipped", detail: "Not confirmed" };
  const soon = at.getTime() - now.getTime() <= 36 * 60 * 60 * 1000;
  if (!issue || !issue.hasBody) {
    return soon
      ? { status: "needs_you", detail: "Not started" }
      : { status: "scheduled", detail: "Not started" };
  }
  return { status: "needs_you", detail: "Draft" };
}

function threadFor(threads: ThreadSnap[], kind: string, dedupeKey: string): ThreadSnap | null {
  return (
    threads.find((thread) => thread.kind === kind && thread.dedupeKey === dedupeKey && thread.status !== "rejected") ??
    threads.find((thread) => thread.kind === kind && thread.dedupeKey === dedupeKey) ??
    null
  );
}

function xStatus(
  thread: ThreadSnap | null,
  at: Date,
  now: Date,
): Pick<DeskCard, "status" | "detail"> {
  if (!thread) {
    return now.getTime() >= at.getTime()
      ? { status: "needs_you", detail: "Not drafted" }
      : { status: "scheduled", detail: "Scheduled" };
  }
  if (thread.status === "posted") return { status: "posted", detail: "Posted" };
  if (thread.status === "failed") return { status: "failed", detail: thread.error ?? "Failed" };
  if (thread.status === "rejected") return { status: "skipped", detail: "Rejected" };
  return { status: "scheduled", detail: "Scheduled" };
}

function card(args: Omit<DeskCard, "timeLabel" | "day" | "at"> & { atDate: Date }): DeskCard {
  const parts = pacificParts(args.atDate);
  return {
    id: args.id,
    piece: args.piece,
    label: args.label,
    audience: args.audience,
    at: args.atDate.toISOString(),
    day: ymdString(parts),
    timeLabel: formatPacific(args.atDate),
    status: args.status,
    detail: args.detail,
  };
}

function slotsForRange(start: Ymd, days: number, now: Date, snap: DeskSnapshot): DeskCard[] {
  const out: DeskCard[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const ymd = ymdString(day);
    const dow = weekdayOf(day);

    if (dow === 1) {
      const atDate = pacificInstant(day, 6, 0);
      const issue = findIssue(snap.marketNotes, isoWeekKeyFromYmd(ymd));
      const state = emailStatus(issue, atDate, now);
      out.push(
        card({
          id: `monday-market-note:${ymd}`,
          piece: "monday-market-note",
          label: "Monday market note",
          audience: "Free",
          atDate,
          ...state,
        }),
      );
    }

    if (dow === 3) {
      const atDate = pacificInstant(day, 8, 0);
      const issue = findIssue(snap.spotlights, isoWeekKeyFromYmd(ymd));
      const state = emailStatus(issue, atDate, now);
      out.push(
        card({
          id: `pick-spotlight:${ymd}`,
          piece: "pick-spotlight",
          label: issue?.ticker ? `Pick spotlight · ${issue.ticker}` : "Pick spotlight",
          audience: "Free",
          atDate,
          ...state,
        }),
      );
    }

    const nominal = analysisNominalForSend(day);
    if (nominal) {
      const atDate = pacificInstant(day, 8, 0);
      const periodKey = analysisPeriodKey(day.year, day.month, nominal);
      const issue = findIssue(snap.analyses, periodKey);
      const state = emailStatus(issue, atDate, now);
      out.push(
        card({
          id: `market-analysis:${periodKey}`,
          piece: "market-analysis",
          label: "Market analysis",
          audience: "Free",
          atDate,
          ...state,
        }),
      );
    }

    if (isEvaluationFriday(day)) {
      const atDate = pacificInstant(day, 8, 0);
      const sentOnDay =
        snap.lastPickSentAt !== null && ymdString(pacificParts(new Date(snap.lastPickSentAt))) === ymd;
      const state: Pick<DeskCard, "status" | "detail"> = sentOnDay
        ? { status: "sent", detail: snap.lastPickTicker ? `Sent · ${snap.lastPickTicker}` : "Sent" }
        : now.getTime() >= atDate.getTime()
          ? { status: "skipped", detail: "Not mailed" }
          : { status: "scheduled", detail: "Mails when the research note is approved" };
      out.push(
        card({
          id: `friday-stock-pick:${ymd}`,
          piece: "friday-stock-pick",
          label: "Friday stock pick",
          audience: "Paid",
          atDate,
          ...state,
        }),
      );

      const postAt = pacificInstant(day, 15, 0);
      const thread = threadFor(snap.threads, "pick_result", ymd);
      const xState = xStatus(thread, postAt, now);
      out.push(
        card({
          id: `pick-result:${ymd}`,
          piece: "x",
          label: "Pick result",
          audience: "X",
          atDate: postAt,
          ...xState,
        }),
      );
    }

    if (dow !== 0 && dow !== 6) {
      for (const slot of dailyGraphicPlan(ymd)) {
        const kind = DAILY_KIND[slot.kind];
        const thread = threadFor(snap.threads, kind, ymd);
        const state = xStatus(thread, slot.postAt, now);
        out.push(
          card({
            id: `${kind}:${ymd}`,
            piece: "x",
            label: DAILY_LABEL[slot.kind],
            audience: "X",
            atDate: thread?.postAt ? new Date(thread.postAt) : slot.postAt,
            status: state.status,
            detail: state.detail === "Scheduled" ? slot.window : state.detail,
          }),
        );
      }
      for (const thread of snap.threads) {
        if (thread.kind !== "income_visual") continue;
        const atDate = thread.postAt ? new Date(thread.postAt) : null;
        if (!atDate || ymdString(pacificParts(atDate)) !== ymd) continue;
        const state = xStatus(thread, atDate, now);
        out.push(
          card({
            id: `income:${thread.id}`,
            piece: "x",
            label: thread.label || "Earnings",
            audience: "X",
            atDate,
            ...state,
          }),
        );
      }
    }
  }
  return out;
}

function waiting(item: DeskCard): boolean {
  if (item.status === "needs_you" || item.status === "failed") return true;
  return item.status === "skipped" && item.detail !== "Rejected";
}

export function buildDesk(now: Date, snap: DeskSnapshot = EMPTY): DeskModel {
  const start = weekStart(now);
  const weekEnd = pacificInstant(addDays(start, 7), 0, 0);
  const all = slotsForRange(start, 22, now, snap);
  const inWeek = all
    .filter((item) => {
      const at = new Date(item.at).getTime();
      return at >= pacificInstant(start, 0, 0).getTime() && at < weekEnd.getTime();
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  const later = all
    .filter((item) => new Date(item.at).getTime() >= weekEnd.getTime())
    .sort((a, b) => a.at.localeCompare(b.at));

  const byDay = new Map<string, DeskCard[]>();
  for (const item of inWeek) {
    const list = byDay.get(item.day) ?? [];
    list.push(item);
    byDay.set(item.day, list);
  }

  return {
    weekLabel: `${formatPacificShort(start)}–${formatPacificShort(addDays(start, 6))}`,
    needsYou: inWeek.filter(waiting),
    days: [...byDay.entries()].map(([day, cards]) => ({
      day,
      label: formatPacificDay(parseYmd(day)),
      cards,
    })),
    comingUp: later[0] ?? null,
  };
}
