import { adminEmails } from "@/lib/admin";
import { claimDispatch, isoWeekKey } from "@/lib/email-dispatch";
import { sendWeeklyReviewOpsEmail } from "@/lib/email";
import { weeklyReviewSlug } from "@/lib/insights";
import {
  claimForWeeklyReviewPublish,
  createPendingWeeklyReview,
  getInsightById,
  getInsightBySlug,
  markGenerationFailed,
  saveDraft,
} from "@/lib/insights-db";
import type { Insight } from "@/lib/insights";
import { periodLabel } from "@/lib/weekly-summary";
import { announceWeeklyReview } from "@/lib/weekly-review-announce";
import {
  fetchWeeklyReviewFacts,
  generateWeeklyReviewDraft,
} from "@/lib/weekly-review-draft";
import { fridayNoonLabel, fridayNoonPacific } from "@/lib/weekly-review";

/**
 * Orchestration for the Friday review: draft at 10am, publish at noon if
 * confirmed. The worker POSTs into the two functions below; ops confirm
 * calls `publishWeeklyReview` when noon has already passed.
 */

export type DraftWeeklyReviewResult = {
  weekKey: string;
  slug: string;
  generated: boolean;
  skipped?: "already_drafted" | "already_published" | "rejected";
  insight?: Insight;
  error?: string;
};

export type PublishWeeklyReviewResult = {
  weekKey: string;
  slug?: string;
  skipped?:
    | "no_draft"
    | "not_confirmed"
    | "already_sent"
    | "incomplete"
    | "no_mailer";
  notifiedAdmin?: boolean;
  sent?: number;
  failed?: number;
  total?: number;
  errors?: { email: string; error: string }[];
};

function slugFor(now: Date): { weekKey: string; slug: string } {
  const weekKey = isoWeekKey(now);
  return { weekKey, slug: weeklyReviewSlug(weekKey) };
}

async function notifyAdmins(
  kind: "ready" | "skipped",
  now: Date,
  weekKey: string,
): Promise<boolean> {
  const to = adminEmails();
  if (to.length === 0) return false;
  const result = await sendWeeklyReviewOpsEmail({
    to,
    kind,
    periodLabel: periodLabel(now),
    sendAtLabel: fridayNoonLabel(now),
    weekKey,
  });
  return result.ok;
}

/**
 * Draft this week's review, or no-op if one already exists.
 *
 * `force` is the regenerate button: it rewrites a draft (and clears confirm)
 * but still refuses an approved note.
 */
export async function draftWeeklyReview(
  opts: { now?: Date; force?: boolean } = {},
): Promise<DraftWeeklyReviewResult> {
  const now = opts.now ?? new Date();
  const { weekKey, slug } = slugFor(now);
  const sendAt = fridayNoonPacific(now);
  const base: DraftWeeklyReviewResult = { weekKey, slug, generated: false };

  let existing = await getInsightBySlug(slug, { includeUnpublished: true });

  if (existing?.status === "approved") {
    return { ...base, skipped: "already_published", insight: existing };
  }
  if (existing?.status === "rejected" && !opts.force) {
    return { ...base, skipped: "rejected", insight: existing };
  }
  if (
    existing?.status === "draft" &&
    existing.bodyMd &&
    !opts.force
  ) {
    return { ...base, skipped: "already_drafted", insight: existing };
  }

  if (!existing) {
    await createPendingWeeklyReview(slug, sendAt);
    existing = await getInsightBySlug(slug, { includeUnpublished: true });
  }
  if (!existing) {
    return { ...base, error: "Could not open a row for this week's review" };
  }

  try {
    const facts = await fetchWeeklyReviewFacts(now);
    const draft = await generateWeeklyReviewDraft(facts);
    const saved = await saveDraft(
      existing.id,
      draft,
      facts,
      undefined,
      0,
      sendAt,
    );
    if (!saved) {
      return {
        ...base,
        skipped: "already_published",
        insight: existing,
      };
    }
    if (!opts.force) {
      await notifyAdmins("ready", now, weekKey);
    }
    return { ...base, generated: true, insight: saved };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markGenerationFailed(existing.id, message);
    return { ...base, error: message, insight: await getInsightById(existing.id) ?? existing };
  }
}

/**
 * Publish this week's review if it is confirmed.
 *
 * The noon job passes `notifyIfUnconfirmed: true` (the default) so a missed
 * confirm emails the admins. Late confirm from ops passes false — the admin
 * is already looking at the page.
 */
export async function publishWeeklyReview(
  opts: {
    now?: Date;
    id?: string;
    notifyIfUnconfirmed?: boolean;
  } = {},
): Promise<PublishWeeklyReviewResult> {
  const now = opts.now ?? new Date();
  const { weekKey, slug } = slugFor(now);
  const notify = opts.notifyIfUnconfirmed !== false;

  const insight = opts.id
    ? await getInsightById(opts.id)
    : await getInsightBySlug(slug, { includeUnpublished: true });

  if (!insight || insight.postType !== "weekly_review") {
    return { weekKey, skipped: "no_draft" };
  }

  if (insight.emailSentAt || insight.status === "approved") {
    return { weekKey, slug: insight.slug, skipped: "already_sent" };
  }

  if (!insight.confirmedAt) {
    let notifiedAdmin = false;
    if (notify) {
      notifiedAdmin = await notifyAdmins("skipped", now, weekKey);
    }
    return {
      weekKey,
      slug: insight.slug,
      skipped: "not_confirmed",
      notifiedAdmin,
    };
  }

  if (!insight.title || !insight.description || !insight.bodyMd) {
    return { weekKey, slug: insight.slug, skipped: "incomplete" };
  }

  if (!process.env.RESEND_API_KEY) {
    return { weekKey, slug: insight.slug, skipped: "no_mailer" };
  }

  const claimed = await claimForWeeklyReviewPublish(insight.id);
  if (!claimed) {
    return { weekKey, slug: insight.slug, skipped: "already_sent" };
  }

  // Second guard, for the ops dispatch ledger. The insight claim already
  // won; a leftover Sunday-digest row for this ISO week must not block the
  // send, so a failed insert is ignored.
  await claimDispatch("weekly_summary", weekKey, 0);

  const result = await announceWeeklyReview({
    title: claimed.title ?? claimed.slug,
    lede: claimed.lede ?? claimed.description ?? "",
    insightSlug: claimed.slug,
  });

  return {
    weekKey,
    slug: claimed.slug,
    sent: result.sent,
    failed: result.failed,
    total: result.total,
    errors: result.errors,
  };
}
