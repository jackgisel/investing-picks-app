import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { getServerUser } from "@/lib/server-session";
import { getSubscription } from "@/lib/subscription";

/**
 * Paywall for the /api/data/* surface.
 *
 * These routes previously had no auth at all — picks, trades and the full
 * holdings list were readable by anyone, logged in or not. That is the product.
 *
 * Two tiers:
 *  - PUBLIC:     aggregate numbers the marketing site needs to render.
 *  - SUBSCRIBER: anything that identifies a position (tickers, entry dates,
 *                trade history).
 *
 * Entitlement has two independent grants: a live Paddle subscription, or being
 * an admin. Admins own the product and must see exactly what a subscriber sees
 * — without a grant they were served the anonymised payload and their own
 * dashboard rendered blank tickers and "Entered —" for every row.
 */

/** Statuses that still grant access. */
const ENTITLED = new Set(["active", "trialing", "past_due"]);
// `past_due` keeps access deliberately: Paddle retries failed payments for
// several days, and locking a paying customer out mid-dunning causes more
// churn than the few days of access costs. `paused` and `canceled` do not.

export type Access =
  | { entitled: true; userId: string; via: "subscription" | "admin" }
  | { entitled: false; reason: "anonymous" | "unsubscribed" };

/**
 * The entitlement decision table, with every lookup injected so it can be
 * exercised without a database. `scripts/test-api-gate.mjs` mirrors this
 * function — if you change the decision logic, change it there too.
 *
 *   anonymous          -> not entitled, "anonymous"   (401)
 *   signed in, no sub   -> not entitled, "unsubscribed" (402)
 *   entitled sub        -> entitled via "subscription"
 *   admin, no sub       -> entitled via "admin"
 *   admin + sub         -> entitled via "subscription" (no admin lookup)
 *
 * Order matters for cost as well as correctness: `getAccess()` runs on every
 * gated request, so the subscription is resolved first and `isAdmin` is only
 * awaited for callers the subscription did not already entitle. Ordinary
 * subscribers therefore pay exactly the same one round-trip they did before.
 */
export async function decideAccess(deps: {
  getUser: () => Promise<{ id: string } | null>;
  /** Resolves the Paddle status. Throwing is treated as "not entitled". */
  getSubscriptionStatus: (userId: string) => Promise<string>;
  /** Resolves admin-ness for the current session. Throwing is "not admin". */
  isAdmin: () => Promise<boolean>;
}): Promise<Access> {
  const user = await deps.getUser();
  if (!user) return { entitled: false, reason: "anonymous" };

  let subscribed = false;
  try {
    subscribed = ENTITLED.has(await deps.getSubscriptionStatus(user.id));
  } catch (e) {
    // Fail closed — a DB error must not hand out the paid product.
    console.error("Subscription lookup failed:", e);
  }
  if (subscribed) {
    return { entitled: true, userId: user.id, via: "subscription" };
  }

  // Second grant, only reached by non-subscribers. A failed subscription
  // lookup lands here too, but that does not weaken anything: this path grants
  // access on a positive admin determination, never on an error.
  try {
    if (await deps.isAdmin()) {
      return { entitled: true, userId: user.id, via: "admin" };
    }
  } catch (e) {
    // Fail closed — same rule as above. getAdminUser() already swallows its own
    // query errors, but ensureMigrations()/session resolution can still throw.
    console.error("Admin lookup failed:", e);
  }

  return { entitled: false, reason: "unsubscribed" };
}

export async function getAccess(): Promise<Access> {
  return decideAccess({
    getUser: getServerUser,
    getSubscriptionStatus: async (userId) => (await getSubscription(userId)).status,
    // Reuse the single admin resolution in lib/admin.ts (ADMIN_EMAILS on a
    // verified address, plus the persisted `user.is_admin` column). A second,
    // parallel notion of admin here is how the two drift apart.
    isAdmin: async () => (await getAdminUser()) !== null,
  });
}

/** 402 for a signed-in non-subscriber, 401 for anonymous. */
export function paywallResponse(access: Extract<Access, { entitled: false }>) {
  const anonymous = access.reason === "anonymous";
  return NextResponse.json(
    {
      error: anonymous ? "Authentication required" : "Subscription required",
      reason: access.reason,
    },
    { status: anonymous ? 401 : 402 }
  );
}

/**
 * Guard for subscriber-only routes.
 *
 *   const gate = await requireSubscriber();
 *   if (!gate.ok) return gate.response;
 */
export async function requireSubscriber(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const access = await getAccess();
  if (!access.entitled) return { ok: false, response: paywallResponse(access) };
  return { ok: true, userId: access.userId };
}

type Holding = Record<string, unknown>;

/**
 * Strip identifying fields from holdings while keeping the aggregate shape the
 * landing page needs. `stats-bar` and `track-record` only ever COUNT holdings
 * (winners, doubles) — they never render a ticker — so anonymised rows keep the
 * marketing site working without publishing the picks.
 */
export function anonymiseStrategy<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = { ...payload };

  const holdings = out.holdings;
  if (Array.isArray(holdings)) {
    out.holdings = holdings.map((h: Holding) => ({
      // Explicitly null rather than absent: consumers type this as
      // `string | null`, and an omitted key reads as `undefined` at runtime
      // while still satisfying the type.
      ticker: null,
      entry_date: null,
      pnl_pct: h.pnl_pct ?? 0,
      weight_pct: h.weight_pct ?? 0,
      sector: h.sector ?? null,
    }));
  }

  const portfolio = out.portfolio;
  if (portfolio && typeof portfolio === "object") {
    const { tickers: _tickers, picks, ...rest } = portfolio as Record<
      string,
      unknown
    >;
    // Percentages and counts are marketing surface; dollar figures are not.
    // The site states everywhere that it publishes percentages, never book
    // values, so strip deployed/open_value/realized for non-subscribers.
    if (picks && typeof picks === "object") {
      const p = picks as Record<string, unknown>;
      rest.picks = {
        return_pct: p.return_pct ?? null,
        open_count: p.open_count ?? 0,
        closed_count: p.closed_count ?? 0,
      };
    }
    out.portfolio = rest;
  }

  return out as T;
}

/** Private, per-user responses must never land in a shared cache. */
export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;
