import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { PUBLIC_API_BASE } from "@/lib/api-config";
import { SITE_URL } from "@/lib/constants";
import type { PickStat } from "@/lib/email-templates";
import { getInsightBySlug, getInsightByTicker } from "@/lib/insights-db";
import { isoWeekKey } from "@/lib/email-dispatch";
import { weeklyReviewSlug } from "@/lib/insights";
import {
  sendDeleteAccountEmail,
  sendMarketNoteWelcomeEmail,
  sendMembershipWelcomeEmail,
  sendNewPickEmail,
  sendVerifyEmail,
  sendWeeklyReviewEmail,
  type SendResult,
} from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Send a template to the signed-in admin's own address, to check that Resend is
 * configured and that the rendering holds up in a real client.
 *
 * The recipient is NOT a parameter — it is always `guard.user.email`. That is
 * the whole safety property: `notify-pick` exists to mail every opted-in
 * subscriber, and a test route that took a `to` field would be one typo away
 * from being the same thing with less review. This route cannot reach anyone
 * but the person holding the admin session.
 *
 * Every message carries a TEST SEND banner. The pick alert is rendered against
 * the REAL most recent position, because a layout built around a four-letter
 * placeholder tells you nothing about how a real symbol and a real headline sit
 * on the page — and the banner is what keeps that from reading as a live alert.
 *
 * POST /api/ops/email-test          → sends all templates
 * POST /api/ops/email-test {"template":"verify"}
 */

const BANNER = "Test send — not a live alert";

type Pick = {
  ticker: string;
  entry_date?: string | null;
  pnl_pct?: number | null;
  status?: string | null;
  blog_slug?: string | null;
};

/**
 * The newest open position, or null if the API is unreachable.
 *
 * Never throws: a test send that dies because the upstream is down tells you
 * nothing about the thing you were testing, which is Resend.
 */
async function latestPick(): Promise<Pick | null> {
  try {
    const res = await fetch(`${PUBLIC_API_BASE}/picks`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { picks?: Pick[] };
    const active = (body.picks ?? []).filter(
      (p) => p.ticker && p.status === "active" && p.entry_date
    );
    if (active.length === 0) return null;
    return active.sort((a, b) =>
      String(b.entry_date).localeCompare(String(a.entry_date))
    )[0];
  } catch {
    return null;
  }
}

function pickStats(pick: Pick | null): PickStat[] {
  if (!pick) return [];
  const stats: PickStat[] = [];
  if (pick.entry_date) {
    stats.push({
      label: "Entry date",
      value: new Date(`${pick.entry_date}T00:00:00Z`).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
      ),
    });
  }
  if (typeof pick.pnl_pct === "number") {
    stats.push({
      label: "Since entry",
      value: `${pick.pnl_pct >= 0 ? "+" : ""}${pick.pnl_pct.toFixed(2)}%`,
      direction: pick.pnl_pct >= 0 ? "up" : "down",
    });
  }
  stats.push({ label: "Status", value: "Open position" });
  return stats;
}

const TEMPLATES = [
  "verify",
  "membership-welcome",
  "new-pick",
  "weekly-review",
  "delete-account",
  "market-note",
] as const;
type Template = (typeof TEMPLATES)[number];

async function sendOne(
  template: Template,
  to: string,
  userId: string,
  name: string | null,
  pick: Pick | null
): Promise<SendResult> {
  switch (template) {
    case "verify":
      return sendVerifyEmail({
        to,
        name,
        verifyUrl: `${SITE_URL}/verify-email?token=test-token-not-valid`,
        banner: BANNER,
      });
    case "membership-welcome":
      return sendMembershipWelcomeEmail({
        to,
        name,
        stripeSubscriptionId: `test-${userId}-${Date.now()}`,
        banner: BANNER,
      });
    case "new-pick": {
      // The real insight for the real pick, so the CTA in the test message
      // lands where a subscriber's would.
      const insight = await getInsightByTicker(pick?.ticker);
      return sendNewPickEmail({
        to,
        // A real token: unsubscribing from a test must actually work, or the
        // one-click header is untested exactly where it matters.
        userId,
        recipientName: name,
        ticker: pick?.ticker ?? "TEST",
        stats: pickStats(pick),
        articleTitle:
          insight?.title ?? "This is a test of the new pick email",
        articleDescription:
          insight?.description ??
          "Sent from /api/ops/email-test. No published insight matched the most recent pick, so this fell back to placeholder copy.",
        insightSlug: insight?.slug ?? "",
        banner: BANNER,
      });
    }
    case "weekly-review": {
      const review = await getInsightBySlug(
        weeklyReviewSlug(isoWeekKey()),
        { includeUnpublished: true },
      );
      return sendWeeklyReviewEmail({
        to,
        userId,
        recipientName: name,
        title: review?.title ?? "Weekly review: a test of the Friday email",
        lede:
          review?.lede ??
          "Sent from /api/ops/email-test. No draft for this week, so this fell back to placeholder copy.",
        insightSlug: review?.slug ?? weeklyReviewSlug(isoWeekKey()),
        banner: BANNER,
      });
    }
    case "delete-account":
      return sendDeleteAccountEmail({
        to,
        name,
        confirmUrl: `${SITE_URL}/account/delete?token=test-token-not-valid`,
        banner: BANNER,
      });
    case "market-note":
      // A token that matches no subscriber row: the unsubscribe links render
      // and are clickable, and clicking one is a no-op rather than removing a
      // real address.
      return sendMarketNoteWelcomeEmail({
        to,
        token: "test-token-not-valid",
        banner: BANNER,
      });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set on this deployment" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}) as { template?: unknown });
  const requested =
    typeof body.template === "string" ? body.template.trim() : "";

  if (requested && !TEMPLATES.includes(requested as Template)) {
    return NextResponse.json(
      { error: `Unknown template '${requested}'`, valid: TEMPLATES },
      { status: 400 }
    );
  }

  const to = guard.user.email;
  const name = guard.user.name ?? null;
  const selected: Template[] = requested
    ? [requested as Template]
    : [...TEMPLATES];

  const pick = selected.includes("new-pick") ? await latestPick() : null;

  const results: (SendResult & { template: Template })[] = [];
  for (const template of selected) {
    const res = await sendOne(template, to, guard.user.id, name, pick);
    results.push({ template, ...res });
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    {
      ok: failed.length === 0,
      to,
      sent: results.length - failed.length,
      failed: failed.length,
      results,
    },
    { status: failed.length === 0 ? 200 : 502 }
  );
}
