import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { nextEvaluationFriday, pacificParts, ymdString } from "@/lib/comm-calendar";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await ensureMigrations();

  const next = ymdString(nextEvaluationFriday(pacificParts(new Date())));
  const { rows } = await pool.query<{ ticker: string | null; email_sent_at: Date }>(
    `SELECT ticker, email_sent_at FROM insight
      WHERE post_type = 'pick' AND email_sent_at IS NOT NULL
      ORDER BY email_sent_at DESC
      LIMIT 1`,
  );
  const last = rows[0];
  return NextResponse.json({
    next,
    last: last
      ? { ticker: last.ticker, sentAt: last.email_sent_at.toISOString() }
      : null,
  });
}
