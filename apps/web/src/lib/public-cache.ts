/**
 * Public-page cache policy.
 *
 * Next.js default for a fully static App Router page is
 * `Cache-Control: s-maxage=31536000` (one year). ISR pages add
 * `stale-while-revalidate` of ~one year minus `revalidate`.
 *
 * On Railway that header is what made PR 20 invisible: the web service
 * *did* auto-deploy the merge, but the new container served a build-time
 * prerender (empty live return, previous copy) with a year-long stale
 * window. Cloudflare was DYNAMIC — this is Next's own Cache-Control, not
 * an HTML CDN cache in front of us.
 *
 * `expireTime` in next.config.js is the ISR stale-while-revalidate cap.
 * These numeric literals must stay in sync with that config and with
 * `export const revalidate = 60` on public pages — Next requires the
 * segment config to be a statically analyzable number, so pages cannot
 * import this constant as their `revalidate` export.
 */

/** ISR revalidate window for public HTML, in seconds. */
export const PUBLIC_PAGE_REVALIDATE_SECONDS = 60;

/**
 * `expireTime` in next.config.js. stale-while-revalidate is
 * `expireTime - revalidate`. Keep equal to the revalidate window so a
 * deploy cannot keep serving last week's HTML for a year.
 */
export const PUBLIC_PAGE_EXPIRE_SECONDS = 60;

/**
 * Combined freshness + stale window above this is the class of bug that
 * hid PR 20 (one-year s-maxage / stale-while-revalidate).
 */
export const PUBLIC_PAGE_MAX_CACHE_SECONDS = 3600;

const NO_STORE_RE = /(?:^|[,;\s])(?:no-store|no-cache)(?:[,;\s]|$)/i;

export function cacheControlIsShortEnough(header: string | null | undefined): boolean {
  if (!header) return false;
  const value = header.trim();
  if (!value) return false;
  if (NO_STORE_RE.test(value)) return true;

  const directives = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const numberAfter = (name: string): number | null => {
    for (const d of directives) {
      if (d.startsWith(`${name}=`)) {
        const n = Number(d.slice(name.length + 1));
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  };

  const sMaxAge = numberAfter("s-maxage");
  const maxAge = numberAfter("max-age");
  const swr = numberAfter("stale-while-revalidate") ?? 0;
  const fresh = sMaxAge ?? maxAge;

  if (fresh === null) return false;
  if (fresh === 0 && directives.includes("must-revalidate")) return true;
  return fresh + swr <= PUBLIC_PAGE_MAX_CACHE_SECONDS;
}

/** Pages whose first HTML a crawler or a deploy must not serve stale. */
export const PUBLIC_CACHE_PAGE_FILES = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/faq/page.tsx",
  "src/app/blog/page.tsx",
  "src/app/track-record/page.tsx",
  "src/app/sitemap.ts",
] as const;
