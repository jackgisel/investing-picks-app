import type { NextRequest } from "next/server";

export function configuredAppUrl(): URL | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Billing mutations are browser-only and must originate from this app. */
export function isSameOriginBrowserPost(
  request: Pick<NextRequest, "method" | "headers">,
  appUrl: URL,
): boolean {
  if (request.method !== "POST") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === appUrl.origin;
  } catch {
    return false;
  }
}

