import { NextResponse } from "next/server";
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
 */

/** Statuses that still grant access. */
const ENTITLED = new Set(["active", "trialing", "past_due"]);
// `past_due` keeps access deliberately: Paddle retries failed payments for
// several days, and locking a paying customer out mid-dunning causes more
// churn than the few days of access costs. `paused` and `canceled` do not.

export type Access =
  | { entitled: true; userId: string }
  | { entitled: false; reason: "anonymous" | "unsubscribed" };

export async function getAccess(): Promise<Access> {
  const user = await getServerUser();
  if (!user) return { entitled: false, reason: "anonymous" };
  try {
    const sub = await getSubscription(user.id);
    if (ENTITLED.has(sub.status)) return { entitled: true, userId: user.id };
    return { entitled: false, reason: "unsubscribed" };
  } catch (e) {
    // Fail closed — a DB error must not hand out the paid product.
    console.error("Subscription lookup failed:", e);
    return { entitled: false, reason: "unsubscribed" };
  }
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
      pnl_pct: h.pnl_pct ?? 0,
      weight_pct: h.weight_pct ?? 0,
      sector: h.sector ?? null,
    }));
  }

  const portfolio = out.portfolio;
  if (portfolio && typeof portfolio === "object") {
    const { tickers: _tickers, ...rest } = portfolio as Record<string, unknown>;
    out.portfolio = rest;
  }

  return out as T;
}

/** Private, per-user responses must never land in a shared cache. */
export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;
