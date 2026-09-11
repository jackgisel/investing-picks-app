import { SITE_URL } from "@/lib/constants";

export const DATAFAST_SCRIPT_PATH = "/js/script.js";
export const DATAFAST_EVENTS_PATH = "/datafast-events";
export const DATAFAST_VISITOR_COOKIE = "datafast_visitor_id";
export const DATAFAST_SESSION_COOKIE = "datafast_session_id";
export const DATAFAST_CHECKOUT_GOAL = "checkout_started";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function datafastWebsiteId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID?.trim();
  return id || undefined;
}

export function datafastDomain(): string {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return "outpick.xyz";
  }
}

export function sanitizeDatafastId(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !ID_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

export function datafastCheckoutMetadata(args: {
  visitorId?: string | null;
  sessionId?: string | null;
}): Record<string, string> {
  const metadata: Record<string, string> = {};
  const visitorId = sanitizeDatafastId(args.visitorId);
  const sessionId = sanitizeDatafastId(args.sessionId);
  if (visitorId) metadata.datafast_visitor_id = visitorId;
  if (sessionId) metadata.datafast_session_id = sessionId;
  return metadata;
}
