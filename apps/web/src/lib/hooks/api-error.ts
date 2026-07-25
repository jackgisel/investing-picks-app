/**
 * Typed errors for the `/api/*` fetch surface.
 *
 * Every data hook used to do this:
 *
 *     if (!res.ok) throw new Error("Failed to fetch picks");
 *
 * which collapsed "you are signed out", "you need to subscribe" and "the
 * backend is on fire" into one indistinguishable string. Pages then only read
 * `isLoading`, so a 402 rendered as a spinner that never resolved — React Query
 * retried the doomed request with backoff and the UI never left its loading
 * branch.
 *
 * `ApiError` keeps the HTTP status and a coarse `kind` so the UI can pick a
 * terminal state, and `retryTransient` stops us burning seconds retrying
 * responses that will never change.
 */

export type ApiErrorKind =
  /** 401 — no session. Sign in. */
  | "unauthenticated"
  /** 402/403 — signed in, not entitled. Upgrade. */
  | "subscription_required"
  /** 404 — the thing genuinely is not there. */
  | "not_found"
  /** Any other 4xx — our bug, not the user's. Retrying will not help. */
  | "client"
  /** 5xx — backend broken. Worth retrying. */
  | "server"
  /** fetch() rejected, or the body was not JSON. Worth retrying. */
  | "network";

export function classifyStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthenticated";
  // 403 is grouped with 402 deliberately: api-gate currently answers 402 for a
  // signed-in non-subscriber, but any "you are known and still not allowed"
  // response should land on the upgrade prompt rather than a generic error.
  if (status === 402 || status === 403) return "subscription_required";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "server";
}

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never produced a response. */
  readonly status: number;
  readonly kind: ApiErrorKind;
  /** Server-supplied `error` string, when there was one. */
  readonly detail?: string;

  constructor(status: number, kind: ApiErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.detail = detail;
  }

  /** True for anything a retry cannot fix. */
  get isTerminal(): boolean {
    return this.kind !== "server" && this.kind !== "network";
  }
}

/**
 * Coerce anything React Query hands back into an ApiError so render code has a
 * single shape to branch on. A non-ApiError here means something threw inside
 * the query function that was not an HTTP failure — treat it as a network-class
 * problem, which is the honest description and stays retryable.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return new ApiError(0, "network", message);
}

/** Extract `{ error }` from a JSON error body without letting parsing throw. */
async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as unknown;
    if (body && typeof body === "object") {
      const value = (body as Record<string, unknown>).error;
      if (typeof value === "string" && value) return value;
    }
  } catch {
    // Non-JSON error body (an HTML proxy page, an empty 502). Nothing to add.
  }
  return undefined;
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  unauthenticated: "You need to be signed in",
  subscription_required: "A subscription is required",
  not_found: "Not found",
  client: "Request rejected",
  server: "The server failed to respond",
  network: "Could not reach the server",
};

/**
 * fetch + JSON decode that throws `ApiError` on any non-OK response.
 * `cache: "no-store"` because these responses are per-user and the paywalled
 * ones must never be served from a cache belonging to a different session.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch (e) {
    throw new ApiError(
      0,
      "network",
      e instanceof Error && e.message ? e.message : DEFAULT_MESSAGES.network
    );
  }

  if (!res.ok) {
    const kind = classifyStatus(res.status);
    const detail = await readErrorDetail(res);
    throw new ApiError(res.status, kind, detail ?? DEFAULT_MESSAGES[kind], detail);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "network", "The server returned a malformed response");
  }
}

/** How many times a genuinely transient failure is retried. */
const MAX_RETRIES = 2;

/**
 * React Query `retry` predicate. 4xx fails on the first attempt so the upgrade
 * / sign-in prompt appears immediately; 5xx and network faults still get a
 * couple of goes.
 */
export function retryTransient(failureCount: number, error: unknown): boolean {
  if (toApiError(error).isTerminal) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * Shared query options for every `/api/data/*` hook. Spread this rather than
 * repeating the policy — the retry rule is the half of the fix that stops a
 * paywalled screen from sitting on a spinner for ten seconds.
 */
export const dataQueryOptions = {
  retry: retryTransient,
  retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 4000),
} as const;
