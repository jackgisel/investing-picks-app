import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { buildDesk, type IssueSnap, type ThreadSnap } from "@/lib/communication-desk";
import { pool } from "@/lib/db";
import { listEditorialIssues } from "@/lib/editorial-issue";
import { listIssues } from "@/lib/market-note-issue";
import { listThreads } from "@/lib/x-threads-db";

export const dynamic = "force-dynamic";

function issueSnap(row: {
  periodKey: string;
  confirmedAt: string | null;
  sentAt: string | null;
  bodyMd: string | null;
  ticker?: string | null;
}): IssueSnap {
  return {
    periodKey: row.periodKey,
    confirmedAt: row.confirmedAt,
    sentAt: row.sentAt,
    hasBody: Boolean(row.bodyMd?.trim()),
    ticker: row.ticker,
  };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await ensureMigrations();

  const [notes, editorial, threads, pick] = await Promise.all([
    listIssues(8),
    listEditorialIssues(12),
    listThreads(60),
    pool.query<{ ticker: string | null; email_sent_at: Date | null }>(
      `SELECT ticker, email_sent_at FROM insight
        WHERE post_type = 'pick' AND email_sent_at IS NOT NULL
        ORDER BY email_sent_at DESC
        LIMIT 1`,
    ),
  ]);

  const last = pick.rows[0];
  const shown = threads.filter((thread) =>
    ["jobs_visual", "headcount_visual", "revenue_visual", "pick_result", "income_visual"].includes(
      thread.kind,
    ),
  );
  const threadSnaps: ThreadSnap[] = shown.map((thread) => {
    const postAt =
      typeof thread.facts.post_at === "string" ? thread.facts.post_at : thread.createdAt.toISOString();
    const ticker = typeof thread.facts.ticker === "string" ? thread.facts.ticker : "";
    return {
      id: thread.id,
      kind: thread.kind,
      label: thread.kind === "income_visual" && ticker ? `${ticker} earnings` : ticker,
      postAt,
      dedupeKey: thread.dedupeKey,
      status: thread.status,
      error: thread.error,
    };
  });

  return NextResponse.json(
    buildDesk(new Date(), {
      marketNotes: notes.map((issue) =>
        issueSnap({ ...issue, periodKey: issue.weekKey, bodyMd: issue.bodyMd }),
      ),
      analyses: editorial
        .filter((issue) => issue.kind === "market_analysis")
        .map(issueSnap),
      spotlights: editorial
        .filter((issue) => issue.kind === "pick_spotlight")
        .map(issueSnap),
      lastPickSentAt: last?.email_sent_at ? last.email_sent_at.toISOString() : null,
      lastPickTicker: last?.ticker ?? null,
      threads: threadSnaps,
    }),
  );
}
