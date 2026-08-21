/**
 * Paths the magic-link callback is allowed to return to.
 *
 * Anything else falls back to /subscribe. The allowlist is the whole defence
 * against an open redirect via ?next=.
 */
export function isSafeCallbackPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("://") || path.includes("..")) {
    return false;
  }
  if (path === "/subscribe" || path === "/welcome") return true;
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

export function resolveCallbackPath(requested: string | null): string {
  if (requested && isSafeCallbackPath(requested)) return requested;
  return "/subscribe";
}
