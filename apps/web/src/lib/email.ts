import { Resend } from "resend";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { pickAlertToken } from "@/lib/pick-alerts";
import {
  renderNewPickEmail,
  renderDeleteAccountEmail,
  renderVerifyEmail,
  renderMagicLinkEmail,
  renderMembershipWelcomeEmail,
  renderMarketNoteWelcomeEmail,
  renderWeeklyReviewEmail,
  renderWeeklyReviewOpsEmail,
  renderPerformanceAlertEmail,
  renderProductUpdateEmail,
  renderJobFailureEmail,
  type PerformanceAlertKind,
  type PickStat,
} from "@/lib/email-templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || `${SITE_NAME} <email@outpick.xyz>`;

let cachedClient: Resend | null = null;
function getClient(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!cachedClient) cachedClient = new Resend(RESEND_API_KEY);
  return cachedClient;
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /**
   * Extra MIME headers. Bulk sends must set List-Unsubscribe and
   * List-Unsubscribe-Post — since 2024 Gmail and Yahoo throttle or spam-folder
   * bulk senders that omit them, regardless of what the message body says.
   */
  headers?: Record<string, string>;
  /** Stable provider-level deduplication key for retried transactional sends. */
  idempotencyKey?: string;
};

export type SendResult = { ok: boolean; error?: string; id?: string };

async function send(args: SendArgs): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent "${args.subject}" to ${
        Array.isArray(args.to) ? args.to.join(", ") : args.to
      }`
    );
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const payload = {
      from: FROM_ADDRESS,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      headers: args.headers,
    };
    const result = args.idempotencyKey
      ? await client.emails.send(payload, {
          idempotencyKey: args.idempotencyKey,
        })
      : await client.emails.send(payload);
    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { ok: false, error: result.error.message ?? "send failed" };
    }
    // Return the Resend message id. Without it, "Resend accepted this and it
    // never arrived" is unanswerable — the id is what you look up to find out
    // whether it was delivered, bounced, or filtered.
    return { ok: true, id: result.data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    console.error("[email] Resend exception:", e);
    return { ok: false, error: message };
  }
}

/* -------------------------- New pick announcement -------------------------- */

export function pickAlertOneClickUrl(token: string): string {
  return `${SITE_URL}/api/preferences/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function sendNewPickEmail(args: {
  to: string;
  /** Recipient's user id — signs the one-click unsubscribe token. */
  userId: string;
  recipientName: string | null;
  ticker: string;
  companyName?: string | null;
  stats?: PickStat[];
  articleTitle: string;
  articleDescription: string;
  /** Slug of the /dashboard/insights research note for this pick. */
  insightSlug: string;
  /** Test-send marker; omitted on real sends. */
  banner?: string;
}): Promise<SendResult> {
  // Picks link to the insight, not to /blog. Insights are the research notes
  // written per pick and live behind the member dashboard; /blog is the public
  // educational archive and has never held a pick note.
  const articleUrl = `${SITE_URL}/dashboard/insights/${args.insightSlug}`;
  const html = renderNewPickEmail({
    recipientName: args.recipientName,
    ticker: args.ticker,
    companyName: args.companyName,
    stats: args.stats,
    articleTitle: args.articleTitle,
    articleDescription: args.articleDescription,
    articleUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text = `New ${SITE_NAME} pick — ${args.ticker}\n\n${args.articleTitle}\n\n${args.articleDescription}\n\nRead the full research: ${articleUrl}\n\nYou're receiving this because you opted in to new pick alerts. Manage your preferences: ${SITE_URL}/dashboard/settings`;

  // This is a BULK send — notify-pick fans it out to every opted-in member — so
  // it carries the same List-Unsubscribe pair as the market note. It shipped
  // without them, which is the one thing on this file's own documented list of
  // what gets a bulk sender throttled or spam-foldered by Gmail and Yahoo.
  const oneClick = pickAlertOneClickUrl(pickAlertToken(args.userId));

  return send({
    to: args.to,
    subject: `New pick: ${args.ticker} — ${args.articleTitle}`,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/* -------------------------- Delete account verification -------------------------- */

export async function sendDeleteAccountEmail(args: {
  to: string;
  name: string | null;
  confirmUrl: string;
  banner?: string;
}): Promise<SendResult> {
  const html = renderDeleteAccountEmail({
    name: args.name,
    confirmUrl: args.confirmUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text = `Confirm account deletion\n\nWe received a request to delete your ${SITE_NAME} account. To confirm, click the link below within the next hour:\n\n${args.confirmUrl}\n\nIf you didn't request this, you can ignore this email — your account is safe.`;

  return send({
    to: args.to,
    subject: `Confirm your ${SITE_NAME} account deletion`,
    html,
    text,
  });
}

/* ------------------------------ Email verification ------------------------------ */

export async function sendVerifyEmail(args: {
  to: string;
  name: string | null;
  verifyUrl: string;
  banner?: string;
}): Promise<SendResult> {
  const html = renderVerifyEmail({
    name: args.name,
    verifyUrl: args.verifyUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text = `Welcome to ${SITE_NAME}.\n\nConfirm this address to finish setting up your account and continue to secure membership checkout:\n\n${args.verifyUrl}\n\nIf you didn't sign up, you can ignore this email.`;

  return send({
    to: args.to,
    subject: `Welcome to ${SITE_NAME} — verify your email`,
    html,
    text,
  });
}

/* ------------------------------ Magic link ------------------------------ */

export async function sendMagicLinkEmail(args: {
  to: string;
  signInUrl: string;
  banner?: string;
}): Promise<SendResult> {
  const html = renderMagicLinkEmail({
    signInUrl: args.signInUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text = `Sign in to ${SITE_NAME}\n\nClick the link below to sign in — no password needed. It works once and expires shortly:\n\n${args.signInUrl}\n\nIf you didn't request this, you can ignore this email.`;

  return send({
    to: args.to,
    subject: `Sign in to ${SITE_NAME}`,
    html,
    text,
  });
}

/* -------------------------- Membership welcome -------------------------- */

export async function sendMembershipWelcomeEmail(args: {
  to: string;
  name: string | null;
  stripeSubscriptionId: string;
  banner?: string;
}): Promise<SendResult> {
  const welcomeUrl = `${SITE_URL}/welcome`;
  const html = renderMembershipWelcomeEmail({
    name: args.name,
    welcomeUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text = `Your ${SITE_NAME} membership is active.\n\nStart with the live portfolio, read the research behind every published pick, and choose which updates reach your inbox.\n\nGet oriented: ${welcomeUrl}\n\nManage billing or email preferences: ${SITE_URL}/dashboard/settings`;

  return send({
    to: args.to,
    subject: `Your ${SITE_NAME} membership is active`,
    html,
    text,
    idempotencyKey: `outpick-membership-${args.stripeSubscriptionId}`,
  });
}

/* ---------------------------- Market note welcome ---------------------------- */

/**
 * Two opt-out URLs, deliberately different.
 *
 * The visible footer link points at a page with a confirm button, because
 * anti-malware scanners and mail clients prefetch GET links — a link that
 * unsubscribes on GET quietly drops people who never clicked anything.
 *
 * The List-Unsubscribe header points at the API route instead, which only
 * mutates on POST. That is exactly what RFC 8058 one-click requires, and mail
 * providers issue it as a POST, so scanners never trigger it.
 */
export function marketNoteUnsubscribeUrl(token: string): string {
  return `${SITE_URL}/market-note/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function marketNoteOneClickUrl(token: string): string {
  return `${SITE_URL}/api/market-note/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function sendMarketNoteWelcomeEmail(args: {
  to: string;
  token: string;
  banner?: string;
}): Promise<SendResult> {
  const unsubscribeUrl = marketNoteUnsubscribeUrl(args.token);
  const html = renderMarketNoteWelcomeEmail({
    unsubscribeUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text = `You're on the list.\n\nEvery week we send one short read: what the model is seeing across ~3,600 US-listed stocks, which sectors are scoring, and what we make of it.\n\nTo be clear about what this is: the note is market commentary, not our picks. Published picks, the live portfolio, and the full research archive are for members only.\n\nOur track record is published in full: ${SITE_URL}/#track-record\n\nUnsubscribe any time: ${unsubscribeUrl}`;

  return send({
    to: args.to,
    subject: `Welcome to the ${SITE_NAME} Market Note`,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${marketNoteOneClickUrl(args.token)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/* ----------------------------- Weekly summary ----------------------------- */

export function weeklySummaryOneClickUrl(token: string): string {
  return `${SITE_URL}/api/preferences/unsubscribe?token=${encodeURIComponent(token)}&list=weekly`;
}

/* ----------------------------- Weekly review ------------------------------ */

/**
 * The Friday review mailed to members who kept Weekly summary on.
 *
 * Same List-Unsubscribe pair as the retired Sunday digest, same list, same
 * token. Unsubscribing here still turns off the weekly mail and leaves pick
 * alerts alone.
 */
export async function sendWeeklyReviewEmail(args: {
  to: string;
  userId: string;
  recipientName: string | null;
  title: string;
  lede: string;
  insightSlug: string;
  banner?: string;
}): Promise<SendResult> {
  const articleUrl = `${SITE_URL}/dashboard/insights/${args.insightSlug}`;
  const oneClick = weeklySummaryOneClickUrl(pickAlertToken(args.userId));
  const html = renderWeeklyReviewEmail({
    recipientName: args.recipientName,
    title: args.title,
    lede: args.lede,
    articleUrl,
    siteUrl: SITE_URL,
    unsubscribeUrl: `${SITE_URL}/dashboard/settings`,
    banner: args.banner,
  });
  const text = `${args.title}\n\n${args.lede}\n\nRead the review: ${articleUrl}\n\nYou're receiving this because you opted in to the weekly summary. Manage your preferences: ${SITE_URL}/dashboard/settings`;

  return send({
    to: args.to,
    subject: args.title,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

export async function sendWeeklyReviewOpsEmail(args: {
  to: string[];
  kind: "ready" | "skipped";
  periodLabel: string;
  sendAtLabel: string;
  weekKey: string;
  banner?: string;
}): Promise<SendResult> {
  if (args.to.length === 0) return { ok: true };
  const opsUrl = `${SITE_URL}/dashboard/ops/weekly-review`;
  const html = renderWeeklyReviewOpsEmail({
    kind: args.kind,
    periodLabel: args.periodLabel,
    sendAtLabel: args.sendAtLabel,
    opsUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
  });
  const text =
    args.kind === "ready"
      ? `Weekly review ready — ${args.periodLabel}\n\nConfirm it before ${args.sendAtLabel} and it will publish at noon PT.\n\nOps: ${opsUrl}`
      : `Weekly review skipped — ${args.periodLabel}\n\nNoon PT passed without a confirm. The draft is still in ops.\n\nOps: ${opsUrl}`;

  return send({
    to: args.to,
    subject:
      args.kind === "ready"
        ? `[${SITE_NAME}] Weekly review ready — ${args.periodLabel}`
        : `[${SITE_NAME}] Weekly review skipped — ${args.periodLabel}`,
    html,
    text,
    idempotencyKey: `outpick-weekly-review-${args.kind}-${args.weekKey}`,
  });
}

/* ---------------------------- Performance alert --------------------------- */

export async function sendPerformanceAlertEmail(args: {
  to: string;
  userId: string;
  recipientName: string | null;
  kind: PerformanceAlertKind;
  headline: string;
  detail: string;
  stats: PickStat[];
  banner?: string;
}): Promise<SendResult> {
  const oneClick = performanceAlertOneClickUrl(pickAlertToken(args.userId));
  const html = renderPerformanceAlertEmail({
    recipientName: args.recipientName,
    kind: args.kind,
    headline: args.headline,
    detail: args.detail,
    stats: args.stats,
    dashboardUrl: `${SITE_URL}/dashboard/positions`,
    siteUrl: SITE_URL,
    unsubscribeUrl: `${SITE_URL}/dashboard/settings`,
    banner: args.banner,
  });
  const text = `${args.headline}\n\n${args.detail}\n\nThis is a notification, not a recommendation.\n\nSee the portfolio: ${SITE_URL}/dashboard/positions\n\nManage your preferences: ${SITE_URL}/dashboard/settings`;

  return send({
    to: args.to,
    subject: args.headline,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

export function performanceAlertOneClickUrl(token: string): string {
  return `${SITE_URL}/api/preferences/unsubscribe?token=${encodeURIComponent(token)}&list=performance`;
}

/* ----------------------------- Product update ----------------------------- */

export async function sendProductUpdateEmail(args: {
  to: string;
  userId: string;
  recipientName: string | null;
  subject: string;
  /** Pre-rendered, already-sanitised HTML. See `lib/product-updates.ts`. */
  bodyHtml: string;
  bodyText: string;
  banner?: string;
}): Promise<SendResult> {
  const oneClick = productUpdateOneClickUrl(pickAlertToken(args.userId));
  const html = renderProductUpdateEmail({
    recipientName: args.recipientName,
    subject: args.subject,
    bodyHtml: args.bodyHtml,
    siteUrl: SITE_URL,
    unsubscribeUrl: `${SITE_URL}/dashboard/settings`,
    banner: args.banner,
  });
  const text = `${args.subject}\n\n${args.bodyText}\n\nManage your preferences: ${SITE_URL}/dashboard/settings`;

  return send({
    to: args.to,
    subject: args.subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

export function productUpdateOneClickUrl(token: string): string {
  return `${SITE_URL}/api/preferences/unsubscribe?token=${encodeURIComponent(token)}&list=product`;
}

/* ------------------------------- Job failure ------------------------------ */

/**
 * Operational alert to the admin allowlist.
 *
 * No List-Unsubscribe: this is not a mailing list, it is the on-call channel,
 * and it goes only to addresses the deployment itself names in ADMIN_EMAILS.
 * `idempotencyKey` is the run id, so a retried delivery from the worker cannot
 * produce a second copy of the same failure.
 */
export async function sendJobFailureEmail(args: {
  to: string[];
  jobName: string;
  runId: string;
  failedAt: string;
  detail: string;
  banner?: string;
  headline?: string;
  eyebrow?: string;
}): Promise<SendResult> {
  const opsUrl = `${SITE_URL}/dashboard/ops`;
  const headline = args.headline ?? `${args.jobName} failed`;
  const html = renderJobFailureEmail({
    jobName: args.jobName,
    failedAt: args.failedAt,
    detail: args.detail,
    opsUrl,
    siteUrl: SITE_URL,
    banner: args.banner,
    headline,
    eyebrow: args.eyebrow,
  });
  const text = `${headline}\n\nFailed at: ${args.failedAt}\n\n${args.detail}\n\nOps: ${opsUrl}`;

  return send({
    to: args.to,
    subject: `[${SITE_NAME}] ${headline}`,
    html,
    text,
    idempotencyKey: `outpick-jobfail-${args.runId}`,
  });
}
