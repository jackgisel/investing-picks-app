/**
 * Entitlement decision-table tests for the /api/data/* paywall.
 *
 * Run from apps/web:  node scripts/test-api-gate.mjs
 *
 * Kept as a standalone script because the web app has no JS test runner
 * configured (same pattern as test-paddle-webhook.mjs). Mirrors
 * `decideAccess` and `anonymiseStrategy` in src/lib/api-gate.ts — if you
 * change the entitlement logic, change it here too.
 */
import assert from "assert";

// --- mirror of src/lib/api-gate.ts ----------------------------------------

const ENTITLED = new Set(["active", "trialing", "past_due"]);

async function decideAccess(deps) {
  const user = await deps.getUser();
  if (!user) return { entitled: false, reason: "anonymous" };

  let subscribed = false;
  try {
    subscribed = ENTITLED.has(await deps.getSubscriptionStatus(user.id));
  } catch {
    // Fail closed — a DB error must not hand out the paid product.
  }
  if (subscribed) {
    return { entitled: true, userId: user.id, via: "subscription" };
  }

  try {
    if (await deps.isAdmin()) {
      return { entitled: true, userId: user.id, via: "admin" };
    }
  } catch {
    // Fail closed.
  }

  return { entitled: false, reason: "unsubscribed" };
}

function anonymiseStrategy(payload) {
  const out = { ...payload };

  const holdings = out.holdings;
  if (Array.isArray(holdings)) {
    out.holdings = holdings.map((h) => ({
      pnl_pct: h.pnl_pct ?? 0,
      weight_pct: h.weight_pct ?? 0,
      sector: h.sector ?? null,
    }));
  }

  const portfolio = out.portfolio;
  if (portfolio && typeof portfolio === "object") {
    const { tickers: _tickers, picks, ...rest } = portfolio;
    if (picks && typeof picks === "object") {
      rest.picks = {
        return_pct: picks.return_pct ?? null,
        open_count: picks.open_count ?? 0,
        closed_count: picks.closed_count ?? 0,
      };
    }
    out.portfolio = rest;
  }

  return out;
}

// --- fixtures --------------------------------------------------------------

const USER = { id: "usr_owner" };

/** Builds deps and records how many times each lookup was hit. */
function makeDeps({ user = USER, status = "inactive", admin = false } = {}) {
  const calls = { subscription: 0, admin: 0 };
  return {
    calls,
    deps: {
      getUser: async () => user,
      getSubscriptionStatus: async () => {
        calls.subscription++;
        if (status instanceof Error) throw status;
        return status;
      },
      isAdmin: async () => {
        calls.admin++;
        if (admin instanceof Error) throw admin;
        return admin;
      },
    },
  };
}

/** The upstream /strategy payload, with the fields the owner was missing. */
const STRATEGY = {
  holdings: [
    {
      ticker: "NVDA",
      entry_date: "2025-03-04",
      pnl_pct: 41.2,
      weight_pct: 12.5,
      sector: "Technology",
    },
    {
      ticker: "CELH",
      entry_date: "2025-06-18",
      pnl_pct: -8.1,
      weight_pct: 9.0,
      sector: "Consumer Defensive",
    },
  ],
  portfolio: {
    tickers: ["NVDA", "CELH"],
    equity_pct: 82.4,
    picks: {
      return_pct: 31.7,
      open_count: 8,
      closed_count: 14,
      deployed: 91234.56,
      open_value: 120987.65,
      realized: 8321.0,
    },
  },
};

// ---------------------------------------------------------------------------

let passed = 0;
const check = (name, fn) => {
  const done = (e) => {
    if (e) {
      console.error(`  FAIL ${name}\n       ${e.message}`);
      process.exitCode = 1;
    } else {
      console.log(`  ok   ${name}`);
      passed++;
    }
  };
  return Promise.resolve()
    .then(fn)
    .then(() => done(), done);
};

console.log("api gate — entitlement decision table");

await check("anonymous caller is not entitled (401 path)", async () => {
  const { deps, calls } = makeDeps({ user: null });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: false, reason: "anonymous" });
  assert.strictEqual(calls.subscription, 0, "must not query for a logged-out visitor");
  assert.strictEqual(calls.admin, 0, "must not query for a logged-out visitor");
});

await check("signed in with no subscription is not entitled (402 path)", async () => {
  const { deps } = makeDeps({ status: "inactive", admin: false });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: false, reason: "unsubscribed" });
});

await check("canceled and paused subscriptions do not entitle", async () => {
  for (const status of ["canceled", "paused", "inactive", ""]) {
    const { deps } = makeDeps({ status });
    const a = await decideAccess(deps);
    assert.strictEqual(a.entitled, false, `status=${status}`);
  }
});

await check("active / trialing / past_due subscribers are entitled", async () => {
  for (const status of ["active", "trialing", "past_due"]) {
    const { deps } = makeDeps({ status });
    const a = await decideAccess(deps);
    assert.deepStrictEqual(
      a,
      { entitled: true, userId: USER.id, via: "subscription" },
      `status=${status}`
    );
  }
});

await check("ADMIN with no subscription is entitled (the reported bug)", async () => {
  const { deps } = makeDeps({ status: "inactive", admin: true });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: true, userId: USER.id, via: "admin" });
});

await check("admin whose subscription lapsed is still entitled", async () => {
  for (const status of ["canceled", "paused"]) {
    const { deps } = makeDeps({ status, admin: true });
    const a = await decideAccess(deps);
    assert.strictEqual(a.entitled, true, `status=${status}`);
  }
});

await check("admin WITH a subscription is entitled via the subscription", async () => {
  const { deps, calls } = makeDeps({ status: "active", admin: true });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: true, userId: USER.id, via: "subscription" });
  assert.strictEqual(calls.admin, 0, "entitled subscribers must not pay for an admin query");
});

await check("no extra round-trip for anyone entitled by subscription", async () => {
  const { deps, calls } = makeDeps({ status: "trialing", admin: false });
  await decideAccess(deps);
  assert.strictEqual(calls.subscription, 1);
  assert.strictEqual(calls.admin, 0);
});

await check("FAILS CLOSED when the subscription lookup throws", async () => {
  const { deps } = makeDeps({ status: new Error("db down"), admin: false });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: false, reason: "unsubscribed" });
});

await check("FAILS CLOSED when the admin lookup throws", async () => {
  const { deps } = makeDeps({ status: "inactive", admin: new Error("migrations failed") });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: false, reason: "unsubscribed" });
});

await check("FAILS CLOSED when both lookups throw", async () => {
  const { deps } = makeDeps({
    status: new Error("db down"),
    admin: new Error("db down"),
  });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: false, reason: "unsubscribed" });
});

await check("a confirmed admin still gets in when only the sub lookup fails", async () => {
  const { deps } = makeDeps({ status: new Error("db down"), admin: true });
  const a = await decideAccess(deps);
  assert.deepStrictEqual(a, { entitled: true, userId: USER.id, via: "admin" });
});

console.log("\napi gate — anonymised /strategy payload (landing page)");

await check("entitled callers get the untouched upstream payload", async () => {
  const { deps } = makeDeps({ status: "active" });
  const access = await decideAccess(deps);
  const payload = access.entitled ? STRATEGY : anonymiseStrategy(STRATEGY);
  assert.strictEqual(payload, STRATEGY);
  assert.strictEqual(payload.holdings[0].ticker, "NVDA");
  assert.strictEqual(payload.holdings[0].entry_date, "2025-03-04");
});

await check("admins get the same untouched payload a subscriber gets", async () => {
  const { deps } = makeDeps({ status: "inactive", admin: true });
  const access = await decideAccess(deps);
  const payload = access.entitled ? STRATEGY : anonymiseStrategy(STRATEGY);
  assert.deepStrictEqual(payload, STRATEGY, "admin payload must equal subscriber payload");
  for (const h of payload.holdings) {
    assert.ok(h.ticker, "admin holdings must have real tickers");
    assert.ok(h.entry_date, "admin holdings must have real entry dates");
  }
  assert.deepStrictEqual(payload.portfolio.tickers, ["NVDA", "CELH"]);
});

await check("anonymous visitors still get holdings stripped of ticker/entry_date", async () => {
  const { deps } = makeDeps({ user: null });
  const access = await decideAccess(deps);
  assert.strictEqual(access.entitled, false);
  const payload = anonymiseStrategy(STRATEGY);
  assert.strictEqual(payload.holdings.length, 2, "counts must survive for stats-bar");
  for (const h of payload.holdings) {
    assert.strictEqual(h.ticker, undefined);
    assert.strictEqual(h.entry_date, undefined);
    assert.strictEqual(typeof h.pnl_pct, "number");
    assert.strictEqual(typeof h.weight_pct, "number");
  }
});

await check("anonymous visitors still get portfolio.tickers removed", async () => {
  const payload = anonymiseStrategy(STRATEGY);
  assert.strictEqual(payload.portfolio.tickers, undefined);
  assert.strictEqual(payload.portfolio.equity_pct, 82.4, "aggregates must survive");
});

await check("anonymous visitors still get dollar fields stripped from picks", async () => {
  const { picks } = anonymiseStrategy(STRATEGY).portfolio;
  assert.deepStrictEqual(picks, {
    return_pct: 31.7,
    open_count: 8,
    closed_count: 14,
  });
  for (const field of ["deployed", "open_value", "realized"]) {
    assert.strictEqual(picks[field], undefined, `picks.${field} must not be published`);
  }
});

await check("anonymising does not mutate the upstream payload", async () => {
  const before = JSON.stringify(STRATEGY);
  anonymiseStrategy(STRATEGY);
  assert.strictEqual(JSON.stringify(STRATEGY), before);
});

console.log(process.exitCode ? "\nFAILED" : `\nall ${passed} checks passed`);
