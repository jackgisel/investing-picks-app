export const COOKIE_CONSENT_STORAGE_KEY = "tli-cookie-consent";
export const COOKIE_CONSENT_CHANGED_EVENT = "outpick-cookie-consent";

export type CookieConsent = {
  accepted: boolean;
  timestamp: string;
};

export function parseCookieConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      accepted?: unknown;
      timestamp?: unknown;
    };
    if (typeof parsed.accepted !== "boolean") return null;
    return {
      accepted: parsed.accepted,
      timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : "",
    };
  } catch {
    return null;
  }
}

export function cookieConsentRecord(accepted: boolean): string {
  return JSON.stringify({
    accepted,
    timestamp: new Date().toISOString(),
  } satisfies CookieConsent);
}
