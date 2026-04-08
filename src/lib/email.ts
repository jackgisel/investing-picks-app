import { Resend } from "resend";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  renderNewPickEmail,
  renderDeleteAccountEmail,
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
};

async function send(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
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
    });
    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { ok: false, error: result.error.message ?? "send failed" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    console.error("[email] Resend exception:", e);
    return { ok: false, error: message };
  }
}

/* -------------------------- New pick announcement -------------------------- */

export async function sendNewPickEmail(args: {
  to: string;
  recipientName: string | null;
  ticker: string;
  articleTitle: string;
  articleDescription: string;
  articleSlug: string;
}): Promise<{ ok: boolean; error?: string }> {
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

  return send({
    to: args.to,
    subject: `New pick: ${args.ticker} — ${args.articleTitle}`,
    html,
    text,
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
