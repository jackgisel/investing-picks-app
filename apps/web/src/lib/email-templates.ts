/**
 * Branded transactional email templates.
 *
 * These return HTML strings, not JSX. Email clients have notoriously bad
 * CSS support — table-based layouts, inline styles, and conservative font
 * stacks are the only reliable approach. The visual language matches the
 * Outpick site: black background, accent green, Outfit for text and IBM Plex
 * Mono for numerals.
 *
 * No web font is linked here on purpose — most clients strip @import and
 * <link>, so the brand faces are named first for the few that have them
 * installed and every stack falls through to a system face that will not
 * reflow the layout.
 */

import { SITE_NAME } from "@/lib/constants";

const COLOR_BG = "#0C0C0C";
const COLOR_BG_SECONDARY = "#141414";
const COLOR_BORDER = "#252525";
const COLOR_TEXT = "#F0F0F0";
const COLOR_TEXT_MUTED = "#999999";
const COLOR_TEXT_DIM = "#666666";
const COLOR_GREEN = "#22C55E";
const COLOR_GREEN_HOVER = "#16A34A";

const FONT_SANS = `'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const FONT_MONO = `'IBM Plex Mono', 'SF Mono', Menlo, Consolas, monospace`;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(args: {
  preview: string;
  bodyHtml: string;
  siteUrl: string;
  /**
   * Footer opt-out link. Defaults to the account settings page, which is right
   * for transactional mail to members — but market-note subscribers have no
   * account, so those sends pass a tokenised one-click unsubscribe instead.
   */
  unsubscribe?: { url: string; label: string };
}): string {
  const preview = escapeHtml(args.preview);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>${escapeHtml(SITE_NAME)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    body { margin: 0; padding: 0; background: ${COLOR_BG}; }
    a { text-decoration: none; }
    .btn:hover { background: ${COLOR_GREEN_HOVER} !important; }
    @media (max-width: 600px) {
      .container { width: 100% !important; }
      .px-7 { padding-left: 22px !important; padding-right: 22px !important; }
      .py-9 { padding-top: 28px !important; padding-bottom: 28px !important; }
      .h1 { font-size: 24px !important; line-height: 1.2 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLOR_BG};font-family:${FONT_SANS};color:${COLOR_TEXT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR_BG};">
    <tr>
      <td align="center" style="padding:32px 16px 56px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:${COLOR_BG};">
          <!-- Header -->
          <tr>
            <td class="px-7" style="padding:0 28px 24px 28px;border-bottom:1px solid ${COLOR_BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${args.siteUrl}" style="color:${COLOR_TEXT};text-decoration:none;">
                      <span style="font-family:${FONT_MONO};font-size:18px;font-weight:700;letter-spacing:0.5px;color:${COLOR_TEXT};">
                        OUT<span style="color:${COLOR_GREEN};">PICK</span>
                      </span>
                    </a>
                  </td>
                  <td align="right" style="font-family:${FONT_MONO};font-size:10px;color:${COLOR_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;">
                    Value Equity Research
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="px-7 py-9" style="padding:36px 28px 36px 28px;background:${COLOR_BG};">
              ${args.bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="px-7" style="padding:24px 28px 0 28px;border-top:1px solid ${COLOR_BORDER};">
              <p style="margin:0 0 8px 0;font-family:${FONT_SANS};font-size:11px;color:${COLOR_TEXT_DIM};line-height:1.6;">
                ${escapeHtml(SITE_NAME)} is an independent equity research publication. Not investment advice. Past performance does not guarantee future results.
              </p>
              <p style="margin:0 0 4px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_TEXT_DIM};letter-spacing:1.5px;text-transform:uppercase;">
                <a href="${args.unsubscribe?.url ?? `${args.siteUrl}/dashboard/settings`}" style="color:${COLOR_TEXT_DIM};text-decoration:underline;">${escapeHtml(args.unsubscribe?.label ?? "Manage email preferences")}</a>
                &nbsp;·&nbsp;
                <a href="${args.siteUrl}" style="color:${COLOR_TEXT_DIM};text-decoration:underline;">${escapeHtml(args.siteUrl.replace(/^https?:\/\//, ""))}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* -------------------------- New pick email -------------------------- */

export function renderNewPickEmail(args: {
  recipientName: string | null;
  ticker: string;
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  siteUrl: string;
}): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName.split(" ")[0])},`
    : "Hi there,";
  const ticker = escapeHtml(args.ticker);
  const title = escapeHtml(args.articleTitle);
  const description = escapeHtml(args.articleDescription);
  const url = args.articleUrl;

  const body = `
    <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_GREEN};letter-spacing:3px;text-transform:uppercase;">
      New Pick Published
    </p>
    <h1 class="h1" style="margin:0 0 18px 0;font-family:${FONT_SANS};font-size:28px;line-height:1.2;font-weight:700;color:${COLOR_TEXT};letter-spacing:-0.4px;">
      ${title}
    </h1>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;background:${COLOR_BG_SECONDARY};border:1px solid ${COLOR_BORDER};">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;">
            Ticker
          </p>
          <p style="margin:0;font-family:${FONT_MONO};font-size:24px;font-weight:700;color:${COLOR_GREEN};letter-spacing:1px;">
            ${ticker}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      ${greeting}
    </p>
    <p style="margin:0 0 28px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      A new high-conviction pick is live. ${description} The full research note covers the thesis, the entry reasoning, and the fundamentals behind the decision.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${COLOR_GREEN};">
          <a class="btn" href="${url}" style="display:inline-block;padding:14px 32px;font-family:${FONT_MONO};font-size:12px;font-weight:600;color:#000;letter-spacing:2px;text-transform:uppercase;text-decoration:none;background:${COLOR_GREEN};">
            Read the research →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${COLOR_TEXT_DIM};line-height:1.6;">
      Or copy this link into your browser:<br>
      <a href="${url}" style="color:${COLOR_GREEN};text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a>
    </p>
  `;

  return shell({
    preview: `New ${SITE_NAME} pick: ${args.ticker} — ${args.articleTitle}`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
  });
}

/* -------------------------- Delete account email -------------------------- */

export function renderDeleteAccountEmail(args: {
  name: string | null;
  confirmUrl: string;
  siteUrl: string;
}): string {
  const greeting = args.name
    ? `Hi ${escapeHtml(args.name.split(" ")[0])},`
    : "Hi there,";

  const body = `
    <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_GREEN};letter-spacing:3px;text-transform:uppercase;">
      Confirm Account Deletion
    </p>
    <h1 class="h1" style="margin:0 0 22px 0;font-family:${FONT_SANS};font-size:26px;line-height:1.2;font-weight:700;color:${COLOR_TEXT};letter-spacing:-0.3px;">
      Are you sure you want to delete your account?
    </h1>

    <p style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      ${greeting}
    </p>
    <p style="margin:0 0 28px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      We received a request to permanently delete your ${escapeHtml(SITE_NAME)} account. If that was you, click the button below within the next hour to confirm. This will sign you out everywhere and remove your account data.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${COLOR_GREEN};">
          <a class="btn" href="${args.confirmUrl}" style="display:inline-block;padding:14px 32px;font-family:${FONT_MONO};font-size:12px;font-weight:600;color:#000;letter-spacing:2px;text-transform:uppercase;text-decoration:none;background:${COLOR_GREEN};">
            Confirm deletion
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:13px;color:${COLOR_TEXT_DIM};line-height:1.6;">
      Or copy this link into your browser:<br>
      <a href="${args.confirmUrl}" style="color:${COLOR_GREEN};text-decoration:underline;word-break:break-all;">${escapeHtml(args.confirmUrl)}</a>
    </p>

    <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${COLOR_TEXT_DIM};line-height:1.6;">
      Didn't request this? You can safely ignore this email — your account is unchanged.
    </p>
  `;

  return shell({
    preview: `Confirm your ${SITE_NAME} account deletion`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
  });
}

export function renderVerifyEmail(args: {
  name: string | null;
  verifyUrl: string;
  siteUrl: string;
}): string {
  const greeting = args.name
    ? `Hi ${escapeHtml(args.name.split(" ")[0])},`
    : "Hi there,";

  const body = `
    <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_GREEN};letter-spacing:3px;text-transform:uppercase;">
      Verify Your Email
    </p>
    <h1 class="h1" style="margin:0 0 22px 0;font-family:${FONT_SANS};font-size:26px;line-height:1.2;font-weight:700;color:${COLOR_TEXT};letter-spacing:-0.3px;">
      Confirm your email address
    </h1>

    <p style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      ${greeting}
    </p>
    <p style="margin:0 0 28px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      Confirm this address to finish setting up your ${escapeHtml(SITE_NAME)} account.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${COLOR_GREEN};">
          <a class="btn" href="${args.verifyUrl}" style="display:inline-block;padding:14px 32px;font-family:${FONT_MONO};font-size:12px;font-weight:600;color:#000;letter-spacing:2px;text-transform:uppercase;text-decoration:none;background:${COLOR_GREEN};">
            Verify email
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:13px;color:${COLOR_TEXT_DIM};line-height:1.6;">
      Or copy this link into your browser:<br>
      <a href="${args.verifyUrl}" style="color:${COLOR_GREEN};text-decoration:underline;word-break:break-all;">${escapeHtml(args.verifyUrl)}</a>
    </p>

    <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${COLOR_TEXT_DIM};line-height:1.6;">
      Didn't sign up? You can safely ignore this email.
    </p>
  `;

  return shell({
    preview: `Verify your ${SITE_NAME} email address`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
  });
}

/* ----------------------- Market note welcome email ----------------------- */

export function renderMarketNoteWelcomeEmail(args: {
  unsubscribeUrl: string;
  siteUrl: string;
}): string {
  const body = `
    <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_GREEN};letter-spacing:3px;text-transform:uppercase;">
      You're on the list
    </p>
    <h1 class="h1" style="margin:0 0 22px 0;font-family:${FONT_SANS};font-size:26px;line-height:1.2;font-weight:700;color:${COLOR_TEXT};letter-spacing:-0.3px;">
      The Market Note lands every week
    </h1>

    <p style="margin:0 0 20px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      Every week we send one short read: what the model is seeing across ~3,600
      US-listed stocks, which sectors are scoring, and what we make of it. No
      hype, no urgency, no forwarding your address to anyone.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;background:${COLOR_BG_SECONDARY};border:1px solid ${COLOR_BORDER};">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 10px 0;font-family:${FONT_MONO};font-size:10px;color:${COLOR_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;">
            To be clear about what this is
          </p>
          <p style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${COLOR_TEXT_MUTED};line-height:1.6;">
            The note is market commentary, not our picks. Published picks, the
            live portfolio, and the full research archive are for members only.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 28px 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR_TEXT_MUTED};line-height:1.65;">
      While you wait for the first one, our track record — backtest, live book,
      wins and losses — is published in full on the site.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${COLOR_GREEN};">
          <a class="btn" href="${args.siteUrl}/#track-record" style="display:inline-block;padding:14px 32px;font-family:${FONT_MONO};font-size:12px;font-weight:600;color:#000;letter-spacing:2px;text-transform:uppercase;text-decoration:none;background:${COLOR_GREEN};">
            See the track record →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${COLOR_TEXT_DIM};line-height:1.6;">
      Didn't sign up? <a href="${args.unsubscribeUrl}" style="color:${COLOR_GREEN};text-decoration:underline;">Remove yourself here</a> — one click, no questions.
    </p>
  `;

  return shell({
    preview: `Welcome to the ${SITE_NAME} Market Note — one short read every week.`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: { url: args.unsubscribeUrl, label: "Unsubscribe" },
  });
}
