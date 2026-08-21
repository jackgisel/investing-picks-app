export type BillingPath = "/api/billing/checkout" | "/api/billing/portal";

type BillingSessionBody = {
  url?: string;
  error?: string;
};

/**
 * Turn a billing route's HTTP body into a Checkout/Portal URL.
 *
 * Production Next.js (and some proxies) answer an unhandled server throw
 * with an empty 500. Calling `response.json()` on that is the
 * "Unexpected end of JSON input" dead end on /subscribe after sign-in.
 */
export function billingUrlFromResponse(
  status: number,
  text: string,
  fallbackError: string,
): string {
  let body: BillingSessionBody = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text) as BillingSessionBody;
    } catch {
      throw new Error(fallbackError);
    }
  }
  if (status < 200 || status >= 300 || !body.url) {
    throw new Error(body.error || fallbackError);
  }
  return body.url;
}

export async function requestBillingUrl(
  path: BillingPath,
  options?: { signal?: AbortSignal; fallbackError?: string },
): Promise<string> {
  const fallbackError = options?.fallbackError ?? "Billing could not be opened";
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: options?.signal,
  });
  return billingUrlFromResponse(
    response.status,
    await response.text(),
    fallbackError,
  );
}
