/**
 * Branded transactional email templates.
 *
 * These return HTML strings, not JSX. Email clients have notoriously bad CSS
 * support — table-based layouts, inline styles, and conservative font stacks
 * are the only reliable approach.
 *
 * The palette below is lifted from src/styles/globals.css, which is the source
 * of truth. Two things about it are easy to get wrong:
 *
 *  1. The brand ground is LIGHT. `:root` is white with near-black text and
 *     `.dark` is the opt-in. These templates used to be locked to
 *     `color-scheme: dark only` on a black ground, which was the old look.
 *  2. Green is a DATA colour, not the brand colour. It means "this number went
 *     up" and pairs with accent-red. The primary action is `inverse` —
 *     near-black, pill-shaped — and section tone comes from the pastels
 *     (yellow, peach, lilac, mint, coral, cyan), one per surface.
 *
 * The @import is best-effort: most clients strip it, so every stack names the
 * brand face first and falls through to a system face that will not reflow the
 * layout. It must match what those stacks actually name.
 */

import { SITE_NAME } from "@/lib/constants";
import { ART, artAbsoluteUrl, artForKey } from "@/lib/art";
import { artForWeek } from "@/lib/art-pool";

/* Light — :root in globals.css */
const BG = "#FFFFFF";
const BG_SOFT = "#F4F4F4";
const BORDER = "#E5E5E5";
const TEXT = "#0A0A0A";
const TEXT_MUTED = "#525252";
const TEXT_DIM = "#737373";
const INVERSE = "#0A0A0A";
const INVERSE_FG = "#FFFFFF";
const GREEN = "#16A34A";
const RED = "#DC2626";

/** Pastels are theme-invariant, and so is the ink that sits on them. */
const TONES = {
  yellow: "#F5D76E",
  peach: "#F0A86C",
  lilac: "#C4B0E0",
  mint: "#A8D9A0",
  coral: "#F07167",
  cyan: "#7EC8D8",
} as const;
export type Tone = keyof typeof TONES;

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

/* ------------------------------- Primitives ------------------------------- */

/**
 * Section eyebrow: a short pastel dash, then the label.
 *
 * `.panel-label::before` on the site. A pseudo-element is not an option here,
 * so the dash is a real table cell — the one shape that survives Outlook.
 */
function eyebrow(label: string, tone: Tone): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;">
      <tr>
        <td width="18" style="width:18px;padding-right:10px;">
          <div style="height:4px;width:18px;background:${TONES[tone]};border-radius:2px;font-size:0;line-height:4px;">&nbsp;</div>
        </td>
        <td style="font-family:${FONT_SANS};font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${TEXT_MUTED};" class="dm-muted">
          ${escapeHtml(label)}
        </td>
      </tr>
    </table>`;
}

/**
 * Primary action — `.btn-primary`: near-black, pill, uppercase.
 *
 * The radius is on the <td> as well as the <a> because Outlook's Word engine
 * ignores border-radius entirely and renders the cell; everywhere else the
 * anchor paints over it. A square button in Outlook is an acceptable
 * degradation, a mismatched double edge is not.
 */
function pillButton(url: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;">
      <tr>
        <td class="dm-btn" style="background:${INVERSE};border-radius:999px;">
          <a href="${url}" class="dm-btn-a" style="display:inline-block;padding:14px 30px;font-family:${FONT_SANS};font-size:12px;font-weight:600;color:${INVERSE_FG};letter-spacing:0.9px;text-transform:uppercase;text-decoration:none;border-radius:999px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Bordered card — `.data-card`. */
function card(inner: string, extraStyle = ""): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-card" style="margin:0 0 24px 0;background:${BG_SOFT};border:1px solid ${BORDER};border-radius:12px;${extraStyle}">
      <tr><td style="padding:20px 22px;">${inner}</td></tr>
    </table>`;
}

function fieldLabel(text: string): string {
  return `<p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${TEXT_DIM};" class="dm-dim">${escapeHtml(text)}</p>`;
}

function paragraph(html: string, marginBottom = 16): string {
  return `<p class="dm-muted" style="margin:0 0 ${marginBottom}px 0;font-family:${FONT_SANS};font-size:15px;color:${TEXT_MUTED};line-height:1.65;">${html}</p>`;
}

function heading(text: string): string {
  return `<h1 class="h1 dm-text" style="margin:0 0 18px 0;font-family:${FONT_SANS};font-size:26px;line-height:1.22;font-weight:700;color:${TEXT};letter-spacing:-0.4px;">${escapeHtml(text)}</h1>`;
}

function fallbackLink(url: string): string {
  return `<p class="dm-dim" style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:13px;color:${TEXT_DIM};line-height:1.6;">
      Or copy this link into your browser:<br>
      <a href="${url}" class="dm-text" style="color:${TEXT};text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a>
    </p>`;
}

/* ---------------------------- Markdown (email) ---------------------------- */

/**
 * A deliberately small markdown subset, rendered to inline-styled email HTML.
 *
 * Not a general parser and must not become one. Email clients support a narrow
 * slice of CSS and no <style> reliably, so every element needs its styles
 * inline — which means every element has to be one we chose. Anything outside
 * the subset below degrades to a paragraph rather than passing through as raw
 * HTML.
 *
 * Escaping happens FIRST, on the whole line, before any inline markup is
 * applied. Doing it the other way round would let a `<script>` inside a link
 * label survive. Link targets are restricted to http(s) for the same reason —
 * `[click](javascript:...)` is otherwise a working injection in the clients
 * that honour it.
 */
export function markdownToEmailHtml(markdown: string): string {
  const inline = (text: string): string => {
    let out = escapeHtml(text);
    // Bold before links: a bold segment inside a link label should survive.
    out = out.replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${TEXT};font-weight:600;">$1</strong>`);
    out = out.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (whole, label: string, href: string) =>
        /^https?:\/\//i.test(href)
          ? `<a href="${href}" style="color:${TEXT};text-decoration:underline;">${label}</a>`
          : whole,
    );
    return out;
  };

  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      `<ul style="margin:0 0 18px 0;padding-left:20px;">${listItems
        .map(
          (li) =>
            `<li class="dm-muted" style="margin:0 0 8px 0;font-family:${FONT_SANS};font-size:15px;color:${TEXT_MUTED};line-height:1.65;">${li}</li>`,
        )
        .join("")}</ul>`,
    );
    listItems = [];
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      flushList();
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      listItems.push(inline(bullet[1]));
      continue;
    }
    flushList();
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(
        `<h2 class="dm-text" style="margin:26px 0 12px 0;font-family:${FONT_SANS};font-size:18px;font-weight:700;color:${TEXT};letter-spacing:-0.2px;">${inline(h[2])}</h2>`,
      );
      continue;
    }
    blocks.push(paragraph(inline(line)));
  }
  flushList();

  return blocks.join("\n");
}

/**
 * One issue of the free weekly Market Note.
 *
 * Goes to addresses that are not accounts, so its unsubscribe is the
 * subscriber-token link rather than the member preference one.
 */
export function renderMarketNoteIssueEmail(args: {
  subject: string;
  lede: string | null;
  bodyMd: string;
  unsubscribeUrl: string;
  siteUrl: string;
  banner?: string;
  /** ISO week key (`2026-W35`) — prefers the pre-generated weekly pool art. */
  weekKey?: string;
}): string {
  const body = `
    ${eyebrow("The Market Note", "lilac")}
    ${heading(args.subject)}
    ${args.lede ? paragraph(escapeHtml(args.lede), 22) : ""}
    ${markdownToEmailHtml(args.bodyMd)}
    ${pillButton(`${args.siteUrl}/pricing`, "See what members get")}
    <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:13px;color:${TEXT_DIM};line-height:1.6;">
      This note is market commentary, not investment advice, and never our
      picks — those are members-only.
    </p>
  `;

  return shell({
    preview: args.subject,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: { url: args.unsubscribeUrl, label: "Unsubscribe" },
    banner: args.banner,
    artUrl: artAbsoluteUrl(
      args.weekKey ? artForWeek(args.weekKey) : artForKey(args.subject),
      args.siteUrl,
    ),
  });
}

/* --------------------------------- Shell --------------------------------- */

function shell(args: {
  preview: string;
  bodyHtml: string;
  siteUrl: string;
  /** Thin strip above the header. Used by the ops test send. */
  banner?: string;
  unsubscribe?: { url: string; label: string };
  /**
   * Absolute URL of a dithered landscape for the content-mail masthead.
   * Omit on transactional mail (verify, magic link, delete, ops alerts).
   */
  artUrl?: string;
}): string {
  const preview = escapeHtml(args.preview);
  const banner = args.banner
    ? `<tr><td style="padding:0 0 18px 0;">
         <div style="background:${TONES.coral};border-radius:999px;padding:7px 16px;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${INVERSE};text-align:center;">
           ${escapeHtml(args.banner)}
         </div>
       </td></tr>`
    : "";

  const artBand = args.artUrl
    ? `<tr>
         <td style="padding:0;line-height:0;font-size:0;">
           <img
             src="${escapeHtml(args.artUrl)}"
             width="600"
             alt=""
             style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"
           />
         </td>
       </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(SITE_NAME)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=Outfit:wght@400;500;600;700&display=swap');
    body { margin: 0; padding: 0; background: ${BG_SOFT}; }
    a { text-decoration: none; }
    @media (max-width: 600px) {
      .container { width: 100% !important; }
      .px-7 { padding-left: 22px !important; padding-right: 22px !important; }
      .py-9 { padding-top: 28px !important; padding-bottom: 28px !important; }
      .h1 { font-size: 23px !important; }
      .ticker { font-size: 44px !important; }
    }
    /* Dark is the opt-in on the site, and the same here. Inline styles beat a
       class, so every override needs !important. Kept to ground, ink and
       edges — the pastels are theme-invariant by design and must not flip. */
    @media (prefers-color-scheme: dark) {
      body, .dm-body { background: #0A0A0A !important; }
      .dm-shell { background: #0A0A0A !important; }
      .dm-text { color: #FAFAFA !important; }
      .dm-muted { color: #A3A3A3 !important; }
      .dm-dim { color: #808080 !important; }
      .dm-card { background: #141414 !important; border-color: #262626 !important; }
      .dm-rule { border-color: #262626 !important; }
      .dm-btn { background: #FAFAFA !important; }
      .dm-btn-a { color: #0A0A0A !important; }
      .dm-up { color: #22C55E !important; }
      .dm-down { color: #EF4444 !important; }
    }
  </style>
</head>
<body class="dm-body" style="margin:0;padding:0;background:${BG_SOFT};font-family:${FONT_SANS};color:${TEXT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-body" style="background:${BG_SOFT};">
    <tr>
      <td align="center" style="padding:28px 16px 48px 16px;">
        <table role="presentation" class="container dm-shell" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${BG};border-radius:20px;overflow:hidden;">
          ${banner}
          <!-- Header -->
          <tr>
            <td class="px-7 dm-rule" style="padding:26px 30px 20px 30px;border-bottom:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${args.siteUrl}" class="dm-text" style="color:${TEXT};text-decoration:none;font-family:${FONT_MONO};font-size:17px;font-weight:700;letter-spacing:-0.2px;">
                      Outpick
                    </a>
                  </td>
                  <td align="right" class="dm-dim" style="font-family:${FONT_SANS};font-size:10px;font-weight:700;color:${TEXT_DIM};letter-spacing:1.2px;text-transform:uppercase;">
                    Value Equity Research
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${artBand}
          <!-- Body -->
          <tr>
            <td class="px-7 py-9" style="padding:32px 30px 34px 30px;">
              ${args.bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="px-7 dm-rule" style="padding:20px 30px 26px 30px;border-top:1px solid ${BORDER};">
              <p class="dm-dim" style="margin:0 0 10px 0;font-family:${FONT_SANS};font-size:11px;color:${TEXT_DIM};line-height:1.6;">
                ${escapeHtml(SITE_NAME)} is an independent equity research publication. Not investment advice. Past performance does not guarantee future results.
              </p>
              <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:10px;font-weight:600;color:${TEXT_DIM};letter-spacing:0.8px;text-transform:uppercase;">
                <a href="${args.unsubscribe?.url ?? `${args.siteUrl}/dashboard/settings`}" class="dm-dim" style="color:${TEXT_DIM};text-decoration:underline;">${escapeHtml(args.unsubscribe?.label ?? "Manage email preferences")}</a>
                &nbsp;·&nbsp;
                <a href="${args.siteUrl}" class="dm-dim" style="color:${TEXT_DIM};text-decoration:underline;">${escapeHtml(args.siteUrl.replace(/^https?:\/\//, ""))}</a>
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

/* ------------------------------ New pick email ---------------------------- */

export type PickStat = {
  label: string;
  value: string;
  /** Colours the value green/red. Omit for a neutral figure. */
  direction?: "up" | "down";
};

/**
 * The pick announcement. The ticker is the headline.
 *
 * It used to lead with the article title and tuck the ticker into a box
 * underneath, which buried the one thing the reader opened the mail for — and
 * made every pick alert look like every other blog notification in the inbox.
 * Now the symbol is the first thing rendered, at display size, in the mono face
 * the product already uses for tickers everywhere else.
 */
export function renderNewPickEmail(args: {
  recipientName: string | null;
  ticker: string;
  companyName?: string | null;
  /** Optional figures under the symbol; rendered only when non-empty. */
  stats?: PickStat[];
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  siteUrl: string;
  banner?: string;
  /** ISO week key (`2026-W35`) — prefers the pre-generated weekly pool art. */
  weekKey?: string;
}): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName.split(" ")[0])},`
    : "Hi there,";

  const company = args.companyName
    ? `<p class="dm-muted" style="margin:6px 0 0 0;font-family:${FONT_SANS};font-size:16px;font-weight:500;color:${TEXT_MUTED};">${escapeHtml(args.companyName)}</p>`
    : "";

  const stats = (args.stats ?? []).filter((s) => s.value);
  const statCells = stats
    .map((s) => {
      const colour =
        s.direction === "up" ? GREEN : s.direction === "down" ? RED : TEXT;
      const cls =
        s.direction === "up" ? "dm-up" : s.direction === "down" ? "dm-down" : "dm-text";
      return `
        <td width="${Math.floor(100 / stats.length)}%" style="padding:0 12px 0 0;vertical-align:top;">
          ${fieldLabel(s.label)}
          <p class="${cls}" style="margin:0;font-family:${FONT_MONO};font-size:17px;font-weight:600;color:${colour};">${escapeHtml(s.value)}</p>
        </td>`;
    })
    .join("");

  const statBlock = stats.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;"><tr>${statCells}</tr></table>`
    : "";

  const body = `
    ${eyebrow("New pick", "coral")}

    <p class="ticker dm-text" style="margin:0;font-family:${FONT_MONO};font-size:56px;line-height:1;font-weight:700;color:${TEXT};letter-spacing:-2px;">
      ${escapeHtml(args.ticker)}
    </p>
    ${company}
    ${statBlock}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 24px 0;">
      <tr><td class="dm-rule" style="border-top:1px solid ${BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>

    ${paragraph(greeting, 14)}
    ${heading(args.articleTitle)}
    ${paragraph(escapeHtml(args.articleDescription), 26)}

    ${pillButton(args.articleUrl, "Read the research")}
    ${fallbackLink(args.articleUrl)}
  `;

  return shell({
    preview: `${args.ticker} — ${args.articleTitle}`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
    artUrl: artAbsoluteUrl(
      args.weekKey ? artForWeek(args.weekKey) : artForKey(args.ticker),
      args.siteUrl,
    ),
  });
}

/* -------------------------- Delete account email -------------------------- */

export function renderDeleteAccountEmail(args: {
  name: string | null;
  confirmUrl: string;
  siteUrl: string;
  banner?: string;
}): string {
  const greeting = args.name
    ? `Hi ${escapeHtml(args.name.split(" ")[0])},`
    : "Hi there,";

  const body = `
    ${eyebrow("Confirm account deletion", "coral")}
    ${heading("Are you sure you want to delete your account?")}
    ${paragraph(greeting, 14)}
    ${paragraph(
      `We received a request to permanently delete your ${escapeHtml(SITE_NAME)} account. If that was you, confirm within the next hour. This signs you out everywhere and removes your account data.`,
      26
    )}
    ${pillButton(args.confirmUrl, "Confirm deletion")}
    ${fallbackLink(args.confirmUrl)}
    <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${TEXT_DIM};line-height:1.6;">
      Didn't request this? You can safely ignore this email — your account is unchanged.
    </p>
  `;

  return shell({
    preview: `Confirm your ${SITE_NAME} account deletion`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
  });
}

/* ------------------------------ Verify email ------------------------------ */

export function renderVerifyEmail(args: {
  name: string | null;
  verifyUrl: string;
  siteUrl: string;
  banner?: string;
}): string {
  const greeting = args.name
    ? `Hi ${escapeHtml(args.name.split(" ")[0])},`
    : "Hi there,";

  const body = `
    ${eyebrow("Welcome to Outpick", "mint")}
    ${heading("One click, then you’re on your way")}
    ${paragraph(greeting, 14)}
    ${paragraph(
      `Thanks for creating an ${escapeHtml(SITE_NAME)} account. Confirm this address to continue to secure membership checkout.`,
      26
    )}
    ${pillButton(args.verifyUrl, "Verify email")}
    ${fallbackLink(args.verifyUrl)}
    <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${TEXT_DIM};line-height:1.6;">
      Didn't sign up? You can safely ignore this email.
    </p>
  `;

  return shell({
    preview: `Welcome to ${SITE_NAME} — verify your email to continue.`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
  });
}

/* ---------------------------- Magic-link sign-in --------------------------- */

export function renderMagicLinkEmail(args: {
  signInUrl: string;
  siteUrl: string;
  banner?: string;
}): string {
  const body = `
    ${eyebrow("Sign in to Outpick", "mint")}
    ${heading("One click and you’re in")}
    ${paragraph(
      `Click below to sign in. No password to remember — this link works once and expires shortly, so request a new one if it's gone stale.`,
      26
    )}
    ${pillButton(args.signInUrl, "Sign in to Outpick")}
    ${fallbackLink(args.signInUrl)}
    <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${TEXT_DIM};line-height:1.6;">
      Didn't request this? You can safely ignore this email — no account changes happen until the link is clicked.
    </p>
  `;

  return shell({
    preview: `Sign in to ${SITE_NAME} — click the link, no password needed.`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
  });
}

/* ------------------------- Membership welcome email ------------------------- */

export function renderMembershipWelcomeEmail(args: {
  name: string | null;
  welcomeUrl: string;
  siteUrl: string;
  banner?: string;
}): string {
  const greeting = args.name
    ? `Hi ${escapeHtml(args.name.split(" ")[0])},`
    : "Hi there,";

  const body = `
    ${eyebrow("Membership active", "mint")}
    ${heading("You’re in. Here’s where to start.")}
    ${paragraph(greeting, 14)}
    ${paragraph(
      `Your ${escapeHtml(SITE_NAME)} membership is active. We built the product to work like a transparent research desk, not a stream of trading alerts.`,
      24
    )}

    ${card(`
      ${fieldLabel("01 — Live book")}
      <p class="dm-muted" style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
        See every open position, the decision ledger, and performance against the S&amp;P 500.
      </p>
      ${fieldLabel("02 — Research")}
      <p class="dm-muted" style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
        Read the thesis, evidence, risks, and rules behind each published pick.
      </p>
      ${fieldLabel("03 — Cadence")}
      <p class="dm-muted" style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
        New high-conviction picks arrive roughly every two weeks. You control which updates reach your inbox.
      </p>`) }

    ${pillButton(args.welcomeUrl, "See how Outpick works")}
    ${fallbackLink(args.welcomeUrl)}
    <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${TEXT_DIM};line-height:1.6;">
      Billing and email preferences live in <a href="${args.siteUrl}/dashboard/settings" class="dm-text" style="color:${TEXT};text-decoration:underline;">account settings</a>.
    </p>
  `;

  return shell({
    preview: `Your ${SITE_NAME} membership is active — start with the live book and research.`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
    artUrl: artAbsoluteUrl(ART[2], args.siteUrl),
  });
}

/* ----------------------- Market note welcome email ----------------------- */

export function renderMarketNoteWelcomeEmail(args: {
  unsubscribeUrl: string;
  siteUrl: string;
  banner?: string;
}): string {
  const body = `
    ${eyebrow("You're on the list", "cyan")}
    ${heading("The Market Note lands every Monday")}
    ${paragraph(
      `Every Monday we send one short read: what the model is seeing across ~3,600 US-listed stocks, which sectors are scoring, and what we make of it. No hype, no urgency, no forwarding your address to anyone.`,
      22
    )}

    ${card(`
      ${fieldLabel("To be clear about what this is")}
      <p class="dm-muted" style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
        The note is market commentary, not our picks. Published picks, the live
        portfolio, and the full research archive are for members only.
      </p>`)}

    ${paragraph(
      `While you wait for the first one, our track record — backtest, live book, wins and losses — is published in full on the site.`,
      26
    )}
    ${pillButton(`${args.siteUrl}/track-record`, "See the track record")}

    <p class="dm-dim" style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${TEXT_DIM};line-height:1.6;">
      Didn't sign up? <a href="${args.unsubscribeUrl}" class="dm-text" style="color:${TEXT};text-decoration:underline;">Remove yourself here</a> — one click, no questions.
    </p>
  `;

  return shell({
    preview: `Welcome to the ${SITE_NAME} Market Note — one short read every week.`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: { url: args.unsubscribeUrl, label: "Unsubscribe" },
    banner: args.banner,
    artUrl: artAbsoluteUrl(ART[3], args.siteUrl),
  });
}

/* ----------------------------- Weekly summary ----------------------------- */

export type WeeklyMove = {
  ticker: string;
  /** "Bought" / "Sold" — plain reader-facing words, never internal actions. */
  action: string;
  /** e.g. "Mon, Aug 3". Empty is fine; the row just loses its date. */
  when: string;
};

/* --------------------------- Weekly review -------------------------------- */

/**
 * The Friday member email: the written review, not the retired stats digest.
 *
 * Same bones as the pick alert — eyebrow, title, lede, button to the note —
 * without a ticker at display size, because this is a book-level piece.
 */
/**
 * A position closed, and here is the note explaining why.
 *
 * Deliberately plainer than `renderNewPickEmail`: that template leads with the
 * quant rating and the Street range, which are forward-looking figures about a
 * position we no longer hold. Reprinting them beside a closed trade would read
 * as a fresh call.
 */
export function renderExitNoteEmail(args: {
  recipientName: string | null;
  ticker: string;
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  siteUrl: string;
  /** Round-trip return, pre-formatted (e.g. "+38.2%"). Omitted when unknown. */
  returnLabel?: string | null;
  unsubscribeUrl?: string;
  banner?: string;
}): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName.split(" ")[0])},`
    : "Hi there,";

  // Tone follows the result rather than the event: a peach eyebrow over a loss
  // is the small dishonesty that makes a whole email feel like spin.
  const tone: Tone = args.returnLabel?.startsWith("-") ? "coral" : "mint";
  const summary = args.returnLabel
    ? `${escapeHtml(args.ticker)} closed at ${escapeHtml(args.returnLabel)}.`
    : `${escapeHtml(args.ticker)} is closed.`;

  const body = `
    ${eyebrow("Position closed", tone)}
    ${heading(args.articleTitle)}
    ${paragraph(greeting, 14)}
    ${paragraph(summary, 14)}
    ${paragraph(escapeHtml(args.articleDescription), 26)}
    ${pillButton(args.articleUrl, "Read the exit note")}
    ${fallbackLink(args.articleUrl)}
  `;

  return shell({
    preview: args.articleTitle,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: args.unsubscribeUrl
      ? { url: args.unsubscribeUrl, label: "Unsubscribe" }
      : undefined,
    banner: args.banner,
    artUrl: artAbsoluteUrl(artForKey(args.articleTitle), args.siteUrl),
  });
}

export function renderWeeklyReviewEmail(args: {
  recipientName: string | null;
  title: string;
  lede: string;
  articleUrl: string;
  siteUrl: string;
  periodLabel?: string;
  unsubscribeUrl?: string;
  banner?: string;
  /** ISO week key (`2026-W35`) — prefers the pre-generated weekly pool art. */
  weekKey?: string;
}): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName.split(" ")[0])},`
    : "Hi there,";

  const body = `
    ${eyebrow("Weekly review", "mint")}
    ${heading(args.title)}
    ${paragraph(greeting, 14)}
    ${paragraph(escapeHtml(args.lede), 26)}
    ${pillButton(args.articleUrl, "Read the review")}
    ${fallbackLink(args.articleUrl)}
  `;

  return shell({
    preview: args.title,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: args.unsubscribeUrl
      ? { url: args.unsubscribeUrl, label: "Unsubscribe" }
      : undefined,
    banner: args.banner,
    artUrl: artAbsoluteUrl(
      args.weekKey ? artForWeek(args.weekKey) : artForKey(args.title),
      args.siteUrl,
    ),
  });
}

/**
 * Admin-only: the 10am draft is ready, or noon ran and nobody confirmed.
 *
 * Same channel as job-failure mail. Not a mailing list, no unsubscribe.
 */
export function renderWeeklyReviewOpsEmail(args: {
  kind: "ready" | "skipped";
  periodLabel: string;
  sendAtLabel: string;
  opsUrl: string;
  siteUrl: string;
  banner?: string;
}): string {
  const ready = args.kind === "ready";
  const title = ready
    ? `Weekly review ready — ${args.periodLabel}`
    : `Weekly review skipped — ${args.periodLabel}`;
  const body = `
    ${eyebrow(ready ? "Draft ready" : "Send skipped", ready ? "mint" : "coral")}
    ${heading(title)}
    ${paragraph(
      ready
        ? `A draft of this week's portfolio review is waiting. Confirm it before ${escapeHtml(args.sendAtLabel)} and it will publish on Insights and email paid subscribers at noon PT. If you do not confirm, it will not go out.`
        : `Noon PT passed without a confirm, so this week's review was not published and was not emailed. The draft is still in ops if you want to confirm and send it now.`,
      24,
    )}
    ${pillButton(args.opsUrl, "Open weekly review")}
  `;

  return shell({
    preview: title,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
  });
}

/**
 * Admin-only: the Monday send fired and there was nothing confirmed, or an
 * issue still needs writing. Same channel as the weekly-review ops mail.
 */
export function renderMarketNoteOpsEmail(args: {
  kind: "reminder" | "skipped" | "sent";
  weekKey: string;
  opsUrl: string;
  siteUrl: string;
  detail?: string;
  banner?: string;
}): string {
  const copy = {
    reminder: {
      label: "Market Note — needs writing",
      head: `No Market Note is ready for ${args.weekKey}`,
      body: "Monday's send has nothing confirmed behind it. Write the issue and mark it ready, and the next tick will mail it.",
    },
    skipped: {
      label: "Market Note — skipped",
      head: `Monday passed without a Market Note (${args.weekKey})`,
      body: "The send fired and found no confirmed issue, so nothing went out. Nobody was mailed a half-written note, which is the intended outcome — but the list heard nothing this week.",
    },
    sent: {
      label: "Market Note — sent",
      head: `The Market Note went out (${args.weekKey})`,
      body: args.detail ?? "The issue was mailed to the free list.",
    },
  }[args.kind];

  const body = `
    ${eyebrow(copy.label, args.kind === "sent" ? "mint" : "coral")}
    ${heading(copy.head)}
    ${paragraph(escapeHtml(copy.body), 24)}
    ${pillButton(args.opsUrl, "Open the Market Note queue")}
    ${fallbackLink(args.opsUrl)}
  `;

  return shell({
    preview: copy.head,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
  });
}

/* ---------------------------- Performance alert --------------------------- */

export type PerformanceAlertKind = "milestone" | "drawdown";

/**
 * A position crossing a milestone, or the book entering a drawdown.
 *
 * Tone matters more here than anywhere else in this file. A "+100%" mail is
 * exactly the shape of every pump newsletter ever written, so it states the
 * fact, links to the research, and says nothing about what the reader should
 * do next — no urgency, no exhortation, no implied target.
 */
export function renderPerformanceAlertEmail(args: {
  recipientName: string | null;
  kind: PerformanceAlertKind;
  headline: string;
  detail: string;
  stats: PickStat[];
  dashboardUrl: string;
  siteUrl: string;
  unsubscribeUrl?: string;
  banner?: string;
}): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName.split(" ")[0])},`
    : "Hi there,";

  const stats = args.stats.filter((s) => s.value);
  const statCells = stats
    .map((s) => {
      const colour =
        s.direction === "up" ? GREEN : s.direction === "down" ? RED : TEXT;
      const cls =
        s.direction === "up" ? "dm-up" : s.direction === "down" ? "dm-down" : "dm-text";
      return `
        <td width="${Math.floor(100 / stats.length)}%" style="padding:0 12px 0 0;vertical-align:top;">
          ${fieldLabel(s.label)}
          <p class="${cls}" style="margin:0;font-family:${FONT_MONO};font-size:20px;font-weight:600;color:${colour};">${escapeHtml(s.value)}</p>
        </td>`;
    })
    .join("");

  const body = `
    ${eyebrow(
      args.kind === "milestone" ? "Position milestone" : "Portfolio drawdown",
      args.kind === "milestone" ? "mint" : "peach",
    )}
    ${heading(args.headline)}
    ${paragraph(greeting, 14)}
    ${paragraph(escapeHtml(args.detail), 24)}
    ${
      stats.length
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;"><tr>${statCells}</tr></table>`
        : ""
    }
    ${card(`
      <p class="dm-muted" style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
        This is a notification, not a recommendation. We publish what the book
        did; what you do about it is your decision.
      </p>`)}
    ${pillButton(args.dashboardUrl, "See the portfolio")}
  `;

  return shell({
    preview: args.headline,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: args.unsubscribeUrl
      ? { url: args.unsubscribeUrl, label: "Unsubscribe" }
      : undefined,
    banner: args.banner,
  });
}

/* ----------------------------- Product update ----------------------------- */

/**
 * Admin-composed product news.
 *
 * `bodyHtml` is rendered from markdown by the caller — this template does not
 * parse anything, because a template that accepts raw HTML from one caller and
 * escaped text from another is how unescaped user input eventually reaches an
 * inbox. The single caller sanitises.
 */
export function renderProductUpdateEmail(args: {
  recipientName: string | null;
  subject: string;
  bodyHtml: string;
  siteUrl: string;
  unsubscribeUrl?: string;
  banner?: string;
}): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName.split(" ")[0])},`
    : "Hi there,";

  const body = `
    ${eyebrow("Product update", "lilac")}
    ${heading(args.subject)}
    ${paragraph(greeting, 18)}
    ${args.bodyHtml}
  `;

  return shell({
    preview: args.subject,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    unsubscribe: args.unsubscribeUrl
      ? { url: args.unsubscribeUrl, label: "Unsubscribe" }
      : undefined,
    banner: args.banner,
    artUrl: artAbsoluteUrl(ART[1], args.siteUrl),
  });
}

/* ----------------------------- Feature request ---------------------------- */

/**
 * A member asked for something. Goes to admins only, never to a member.
 *
 * The submitter's address is in the body rather than in Reply-To: the send is
 * to the whole ADMIN_EMAILS list, and a Reply-To that silently redirects a
 * group thread to a customer is how an internal aside gets mailed to them.
 */
export function renderFeatureRequestEmail(args: {
  title: string;
  body: string;
  fromLabel: string;
  fromEmail: string;
  opsUrl: string;
  siteUrl: string;
}): string {
  const detail = args.body
    ? `
      ${fieldLabel("Details")}
      <p class="dm-muted" style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;white-space:pre-wrap;">${escapeHtml(args.body)}</p>`
    : `
      ${fieldLabel("Details")}
      <p class="dm-muted" style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${TEXT_MUTED};line-height:1.6;">None given.</p>`;

  const html = `
    ${eyebrow("Feature request", "lilac")}
    ${heading(args.title)}
    ${card(`
      ${fieldLabel("From")}
      <p class="dm-text" style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:14px;color:${TEXT};">${escapeHtml(args.fromLabel)} &lt;${escapeHtml(args.fromEmail)}&gt;</p>
      ${detail}`)}
    ${pillButton(args.opsUrl, "Open triage")}
  `;

  return shell({
    preview: `${args.fromLabel}: ${args.title.slice(0, 80)}`,
    bodyHtml: html,
    siteUrl: args.siteUrl,
  });
}

/* ------------------------------- Job failure ------------------------------ */

/**
 * Operational alert. Goes to admins only, never to a member.
 *
 * Plain on purpose: it is read at speed by someone deciding whether to get out
 * of bed, so the job name, the time and the error come before anything else.
 */
export function renderJobFailureEmail(args: {
  jobName: string;
  failedAt: string;
  detail: string;
  opsUrl: string;
  siteUrl: string;
  banner?: string;
  headline?: string;
  eyebrow?: string;
}): string {
  const headline = args.headline ?? args.jobName;
  const eyebrowLabel = args.eyebrow ?? "Scheduled job failed";
  const body = `
    ${eyebrow(eyebrowLabel, "coral")}
    ${heading(headline)}
    ${card(`
      ${fieldLabel("Failed at")}
      <p class="dm-text" style="margin:0 0 16px 0;font-family:${FONT_MONO};font-size:14px;color:${TEXT};">${escapeHtml(args.failedAt)}</p>
      ${fieldLabel("Error")}
      <p class="dm-muted" style="margin:0;font-family:${FONT_MONO};font-size:13px;color:${TEXT_MUTED};line-height:1.55;word-break:break-word;">${escapeHtml(args.detail)}</p>`)}
    ${paragraph(
      `This mail exists so a failure is not waiting silently for someone to open the ops page.`,
      24,
    )}
    ${pillButton(args.opsUrl, "Open ops")}
  `;

  return shell({
    preview: `${headline} — ${args.detail.slice(0, 80)}`,
    bodyHtml: body,
    siteUrl: args.siteUrl,
    banner: args.banner,
  });
}
