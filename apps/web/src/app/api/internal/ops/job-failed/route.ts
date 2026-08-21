import { NextResponse } from "next/server";
import { adminEmails } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { sendJobFailureEmail } from "@/lib/email";
import { requireInternalSecret } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/**
 * Tell the admins a scheduled job failed.
 *
 * The worker owns `job_runs` and the web owns email, so the alert crosses here
 * rather than either side reaching into the other's territory. The worker only
 * marks a run alerted once this returns ok, which is what makes a failed
 * delivery retry on the next sweep instead of vanishing.
 *
 * Recipients come from `ADMIN_EMAILS`, not from the database: this is the
 * channel you need most when the database is the thing that broke.
 */
export async function POST(req: Request) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const jobName = typeof b.job_name === "string" ? b.job_name : null;
  const runId = typeof b.run_id === "string" ? b.run_id : String(b.run_id ?? "");
  if (!jobName || !runId) {
    return NextResponse.json(
      { error: "job_name and run_id are required" },
      { status: 400 },
    );
  }

  const to = adminEmails();
  if (to.length === 0) {
    // Not an error the worker can do anything about, and failing the call would
    // make it retry forever. Report it as handled-but-undeliverable instead.
    return NextResponse.json({ ok: true, skipped: "no_admin_emails" });
  }

  await ensureMigrations();
  const result = await sendJobFailureEmail({
    to,
    jobName,
    runId,
    failedAt:
      typeof b.failed_at === "string" ? b.failed_at : new Date().toISOString(),
    detail:
      typeof b.detail === "string" && b.detail.trim()
        ? b.detail.slice(0, 2000)
        : "No detail recorded.",
    headline: typeof b.headline === "string" ? b.headline : undefined,
    eyebrow: typeof b.eyebrow === "string" ? b.eyebrow : undefined,
  });

  // A non-ok result must be a non-2xx, or the worker marks the run alerted and
  // the failure goes unreported after all.
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "send failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id, recipients: to.length });
}
