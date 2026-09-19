import { parseCheckoutSessionId } from "./google-ads";

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
  const pathname = path.split("?")[0].split("#")[0];
  const search = path.includes("?")
    ? path.slice(path.indexOf("?") + 1).split("#")[0]
    : "";
  if (pathname === "/subscribe") return search.length === 0;
  if (pathname === "/welcome") return isSafeWelcomeSearch(search);
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isSafeWelcomeSearch(search: string): boolean {
  if (!search) return true;
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (key !== "checkout" && key !== "session_id") return false;
  }
  const checkout = params.get("checkout");
  if (checkout !== null && checkout !== "success") return false;
  const sessionId = params.get("session_id");
  if (sessionId !== null && !parseCheckoutSessionId(sessionId)) return false;
  return true;
}

export function welcomeLoginNext(query: {
  checkout?: string;
  session_id?: string;
}): string {
  const sessionId = parseCheckoutSessionId(query.session_id);
  if (query.checkout === "success" && sessionId) {
    return `/welcome?checkout=success&session_id=${encodeURIComponent(sessionId)}`;
  }
  return "/welcome";
}

export function resolveCallbackPath(requested: string | null): string {
  if (requested && isSafeCallbackPath(requested)) return requested;
  return "/subscribe";
}
