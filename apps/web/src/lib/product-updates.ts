/**
 * Product update types and the markdown-to-email renderer.
 *
 * Split from `product-updates-db.ts` for the reason `insights.ts` is split from
 * `insights-db.ts`: the ops page is a client component, and a `pg` import in a
 * module it touches drags the driver into the browser bundle.
 */

export type ProductUpdateStatus = "draft" | "sent";

export type ProductUpdate = {
  id: string;
  subject: string;
  bodyMd: string;
  status: ProductUpdateStatus;
  sentAt: string | null;
  recipients: number | null;
  createdAt: string;
  updatedAt: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT_SANS = `'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const TEXT = "#0A0A0A";
const TEXT_MUTED = "#525252";

/**
 * Inline spans: links, bold, italic, code.
 *
 * Runs AFTER the whole string is escaped, so the markdown syntax characters are
 * the only things left that can produce a tag. A renderer that substituted tags
 * first and escaped afterwards would escape its own output.
 */
function inlineMd(escaped: string): string {
  return (
    escaped
      // [label](url) — http/https/mailto only. Anything else (javascript:,
      // data:) is left as literal text rather than becoming an anchor.
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
        (_m, label: string, url: string) =>
          `<a href="${url}" style="color:${TEXT};text-decoration:underline;">${label}</a>`,
      )
      .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${TEXT};">$1</strong>`)
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(
        /`([^`]+)`/g,
        `<code style="font-family:'IBM Plex Mono',monospace;font-size:13px;">$1</code>`,
      )
  );
}

/**
 * A deliberately small markdown subset, rendered with inline styles.
 *
 * Email clients strip stylesheets, so every element has to carry its own
 * styling — which is why this exists instead of a general-purpose markdown
 * library whose output would arrive unstyled. Supported: paragraphs, `##`
 * headings, `-`/`*` bullets, and the inline spans above. Everything else
 * degrades to a paragraph rather than failing.
 */
export function renderProductUpdateBody(markdown: string): string {
  const blocks = markdown.trim().split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));

    if (isList) {
      const items = lines
        .map(
          (l) =>
            `<li style="margin:0 0 8px 0;font-family:${FONT_SANS};font-size:15px;color:${TEXT_MUTED};line-height:1.65;">${inlineMd(
              escapeHtml(l.replace(/^\s*[-*]\s+/, "")),
            )}</li>`,
        )
        .join("");
      out.push(
        `<ul class="dm-muted" style="margin:0 0 18px 0;padding-left:22px;">${items}</ul>`,
      );
      continue;
    }

    const heading = /^#{2,3}\s+(.*)$/.exec(block);
    if (heading) {
      out.push(
        `<h2 class="dm-text" style="margin:26px 0 12px 0;font-family:${FONT_SANS};font-size:18px;font-weight:700;color:${TEXT};letter-spacing:-0.2px;">${inlineMd(
          escapeHtml(heading[1]),
        )}</h2>`,
      );
      continue;
    }

    out.push(
      `<p class="dm-muted" style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:15px;color:${TEXT_MUTED};line-height:1.65;">${inlineMd(
        escapeHtml(block.replace(/\n/g, " ")),
      )}</p>`,
    );
  }

  return out.join("\n");
}

/** Plain-text alternative. Strips the syntax rather than rendering it. */
export function productUpdateText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{2,3}\s+/gm, "")
    .trim();
}
