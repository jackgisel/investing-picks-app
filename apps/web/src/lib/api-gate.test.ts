import { describe, expect, it } from "vitest";
import {
  anonymiseStrategy,
  decideAccess,
  paywallResponse,
  NO_STORE_HEADERS,
} from "./api-gate";

/**
 * The paywall, tested against the real module.
 *
 * scripts/test-api-gate.mjs covered this decision table well but did it by
 * re-implementing decideAccess and anonymiseStrategy inline — its own header
 * comment said "if you change the entitlement logic, change it here too". A
 * paywall validated against a copy of itself passes no matter what the
 * shipped code does. These import the shipped code.
 */

function deps(over: {
  user?: { id: string } | null;
  status?: string | (() => Promise<string>);
  admin?: boolean | (() => Promise<boolean>);
}) {
  let adminCalls = 0;
  const d = {
    getUser: async () => (over.user === undefined ? { id: "u1" } : over.user),
    getSubscriptionStatus: async () =>
      typeof over.status === "function"
        ? over.status()
        : (over.status ?? "none"),
    isAdmin: async () => {
      adminCalls++;
      return typeof over.admin === "function"
        ? over.admin()
        : (over.admin ?? false);
    },
  };
  return { d, adminCalls: () => adminCalls };
}

describe("decideAccess", () => {
  it("denies anonymous callers", async () => {
    const { d } = deps({ user: null });
    expect(await decideAccess(d)).toEqual({
      entitled: false,
      reason: "anonymous",
    });
  });

  it("denies a signed-in user with no subscription", async () => {
    const { d } = deps({ status: "none" });
    expect(await decideAccess(d)).toEqual({
      entitled: false,
      reason: "unsubscribed",
    });
  });

  it.each(["active", "trialing", "past_due"])(
    "entitles %s via subscription",
    async (status) => {
      const { d } = deps({ status });
      expect(await decideAccess(d)).toEqual({
        entitled: true,
        userId: "u1",
        via: "subscription",
      });
    },
  );

  it.each([
    "inactive",
    "incomplete",
    "incomplete_expired",
    "canceled",
    "unpaid",
    "paused",
  ])("does not entitle %s", async (status) => {
    const { d } = deps({ status });
    expect(await decideAccess(d)).toMatchObject({ entitled: false });
  });

  // past_due is deliberate: Stripe retries for days, and locking a paying
  // customer out mid-dunning churns them.
  it("keeps past_due entitled", async () => {
    const { d } = deps({ status: "past_due" });
    expect(await decideAccess(d)).toMatchObject({ entitled: true });
  });

  it("entitles an admin with no subscription", async () => {
    const { d } = deps({ status: "none", admin: true });
    expect(await decideAccess(d)).toEqual({
      entitled: true,
      userId: "u1",
      via: "admin",
    });
  });

  it("does not pay for an admin lookup when the subscription already grants", async () => {
    const { d, adminCalls } = deps({ status: "active", admin: true });
    const access = await decideAccess(d);
    expect(access).toMatchObject({ via: "subscription" });
    expect(adminCalls()).toBe(0);
  });

  it("fails closed when the subscription lookup throws", async () => {
    const { d } = deps({
      status: () => Promise.reject(new Error("db down")),
    });
    expect(await decideAccess(d)).toEqual({
      entitled: false,
      reason: "unsubscribed",
    });
  });

  it("fails closed when the admin lookup throws", async () => {
    const { d } = deps({
      status: "none",
      admin: () => Promise.reject(new Error("db down")),
    });
    expect(await decideAccess(d)).toMatchObject({ entitled: false });
  });

  it("fails closed when both lookups throw", async () => {
    const { d } = deps({
      status: () => Promise.reject(new Error("x")),
      admin: () => Promise.reject(new Error("y")),
    });
    expect(await decideAccess(d)).toEqual({
      entitled: false,
      reason: "unsubscribed",
    });
  });
});

describe("paywallResponse", () => {
  // api-error.ts classifies on exactly these codes, so the two halves must
  // agree. Each was tested alone and never against the other.
  it("returns 401 for anonymous", async () => {
    const res = paywallResponse({ entitled: false, reason: "anonymous" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Authentication required",
      reason: "anonymous",
    });
  });

  it("returns 402 for a signed-in non-subscriber", async () => {
    const res = paywallResponse({ entitled: false, reason: "unsubscribed" });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      error: "Subscription required",
      reason: "unsubscribed",
    });
  });
});

describe("anonymiseStrategy", () => {
  const payload = {
    holdings: [
      {
        ticker: "WDC",
        entry_date: "2026-01-02",
        pnl_pct: 12.5,
        weight_pct: 8.1,
        sector: "Technology",
        fundamentals: {
          revenue_actual: 12_345_678_901,
          eps_actual: 4.2,
        },
      },
    ],
    portfolio: {
      position_count: 1,
      tickers: ["WDC"],
      picks: {
        return_pct: 31.3,
        deployed: 100000,
        open_value: 131300,
        realized: 4200,
        open_count: 1,
        closed_count: 3,
      },
    },
  };

  it("strips the ticker and entry date from holdings", () => {
    const out = anonymiseStrategy(payload);
    expect(out.holdings[0]).toEqual({
      // Present and null, not absent: consumers type these as `string | null`,
      // and an omitted key reads as `undefined` at runtime while still
      // satisfying that type — which is how a ticker-less row reached
      // `ticker.toUpperCase()` and crashed the positions page.
      ticker: null,
      entry_date: null,
      pnl_pct: 12.5,
      weight_pct: 8.1,
      sector: "Technology",
    });
  });

  it("leaks no identifying value, whatever the key shape", () => {
    const serialised = JSON.stringify(anonymiseStrategy(payload));
    expect(serialised).not.toContain("WDC");
    expect(serialised).not.toContain("2026-01-02");
    expect(serialised).not.toContain("12345678901");
  });

  it("strips the ticker list and every dollar figure", () => {
    const out = anonymiseStrategy(payload);
    expect(out.portfolio).not.toHaveProperty("tickers");
    expect(out.portfolio.picks).toEqual({
      return_pct: 31.3,
      open_count: 1,
      closed_count: 3,
    });
  });

  it("does not mutate its input", () => {
    const copy = structuredClone(payload);
    anonymiseStrategy(payload);
    expect(payload).toEqual(copy);
  });

  // A flat position must survive as 0, not be replaced by the `?? 0` default.
  // Indistinguishable in the output, so this pins the intent.
  it("preserves a pnl_pct of exactly 0", () => {
    const out = anonymiseStrategy({
      holdings: [{ ticker: "X", pnl_pct: 0, weight_pct: 0 }],
    });
    expect(out.holdings[0].pnl_pct).toBe(0);
  });

  it("survives a payload with no holdings array", () => {
    expect(() => anonymiseStrategy({ portfolio: { position_count: 0 } })).not.toThrow();
  });

  it("survives a portfolio with no picks", () => {
    const out = anonymiseStrategy({ portfolio: { position_count: 0 } });
    expect(out.portfolio).toEqual({ position_count: 0 });
  });

  it("leaves a non-array holdings value alone", () => {
    const out = anonymiseStrategy({ holdings: null });
    expect(out.holdings).toBeNull();
  });
});

describe("NO_STORE_HEADERS", () => {
  // This header is what keeps a paywalled per-user response out of a shared
  // cache. Nothing asserted it existed.
  it("marks responses private and uncacheable", () => {
    expect(NO_STORE_HEADERS["Cache-Control"]).toContain("private");
    expect(NO_STORE_HEADERS["Cache-Control"]).toContain("no-store");
  });
});
