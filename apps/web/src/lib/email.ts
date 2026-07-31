import { Resend } from "resend";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { pickAlertToken } from "@/lib/pick-alerts";
import {
  renderNewPickEmail,
  renderDeleteAccountEmail,
  renderVerifyEmail,
  renderMarketNoteWelcomeEmail,
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
    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      headers: args.headers,
    });
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
  articleTitle: string;
  articleDescription: string;
  articleSlug: string;
}): Promise<SendResult> {
  const articleUrl = `${SITE_URL}/blog/${args.articleSlug}`;
  const html = renderNewPickEmail({
    recipientName: args.recipientName,
    ticker: args.ticker,
    articleTitle: args.articleTitle,
    articleDescription: args.articleDescription,
    articleUrl,
    siteUrl: SITE_URL,
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
}): Promise<{ ok: boolean; error?: string }> {
  const html = renderDeleteAccountEmail({
    name: args.name,
    confirmUrl: args.confirmUrl,
    siteUrl: SITE_URL,
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
}): Promise<{ ok: boolean; error?: string }> {
  const html = renderVerifyEmail({
    name: args.name,
    verifyUrl: args.verifyUrl,
    siteUrl: SITE_URL,
  });
  const text = `Verify your email\n\nConfirm this address to finish setting up your ${SITE_NAME} account:\n\n${args.verifyUrl}\n\nIf you didn't sign up, you can ignore this email.`;

  return send({
    to: args.to,
    subject: `Verify your ${SITE_NAME} email address`,
    html,
    text,
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
}): Promise<{ ok: boolean; error?: string }> {
  const unsubscribeUrl = marketNoteUnsubscribeUrl(args.token);
  const html = renderMarketNoteWelcomeEmail({ unsubscribeUrl, siteUrl: SITE_URL });
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
