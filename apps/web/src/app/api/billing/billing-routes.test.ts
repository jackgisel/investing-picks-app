import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: {
    id: "user_1",
    email: "member@example.test",
    name: "Member",
    emailVerified: true,
  } as
    | { id: string; email: string; name: string | null; emailVerified: boolean }
    | null,
  // Annotated rather than inferred: the literals would narrow
  // `stripeCustomerId` to `string` and `foundersDiscountRedeemedAt` to `null`,
  // so the tests that swap them (no Customer yet; founders already redeemed)
  // could not assign the value they exist to exercise.
  subscription: {
    status: "inactive",
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    foundersDiscountRedeemedAt: null,
  } as {
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    foundersDiscountRedeemedAt: string | null;
  },
  foundersActive: true,
  /** Whether the deployment asks anyone to verify. See `requireEmailVerification`. */
  verificationRequired: true,
  stripe: {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    subscriptions: { list: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
  saveCustomer: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  ensureMigrations: vi.fn(),
  requireEmailVerification: () => state.verificationRequired,
}));
vi.mock("@/lib/server-session", () => ({ getServerUser: async () => state.user }));
vi.mock("@/lib/founders-server", () => ({
  isFoundersWindowActive: async () => state.foundersActive,
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => state.stripe }));
vi.mock("@/lib/subscription", () => ({
  getSubscriptionRecord: async () => state.subscription,
  saveStripeCustomer: state.saveCustomer,
}));

import { POST as checkout } from "./checkout/route";
import { POST as portal } from "./portal/route";

function request(origin = "https://outpick.test") {
  return new NextRequest("https://outpick.test/api/billing/test", {
    method: "POST",
    headers: { origin },
  });
}

describe("billing routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://outpick.test";
    process.env.STRIPE_SECRET_KEY = "sk_test_value";
    process.env.STRIPE_ANNUAL_PRICE_ID = "price_annual";
    process.env.STRIPE_FOUNDERS_COUPON_ID = "coupon_founders";
    process.env.STRIPE_AUTOMATIC_TAX_ENABLED = "false";
    delete process.env.STRIPE_PRODUCTION_TEST_EMAIL;
    delete process.env.STRIPE_PRODUCTION_TEST_COUPON_ID;
    state.user = {
      id: "user_1",
      email: "member@example.test",
      name: "Member",
      emailVerified: true,
    };
    Object.assign(state.subscription, {
      status: "inactive",
      stripeCustomerId: "cus_existing",
      foundersDiscountRedeemedAt: null,
    });
    state.foundersActive = true;
    state.verificationRequired = true;
    state.stripe.customers.retrieve.mockResolvedValue({
      id: "cus_existing",
      deleted: false,
    });
    state.stripe.customers.create.mockResolvedValue({ id: "cus_new" });
    state.stripe.subscriptions.list.mockResolvedValue({ data: [] });
    state.stripe.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
    state.stripe.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.test/session",
    });
  });

  it("requires authentication", async () => {
    state.user = null;
    const response = await checkout(request());
    expect(response.status).toBe(401);
  });

  it("requires a verified account before creating Checkout", async () => {
    if (!state.user) throw new Error("expected signed-in test user");
    state.user.emailVerified = false;
    const response = await checkout(request());
    expect(response.status).toBe(403);
    expect(state.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("tells the client the refusal is fixable, and by whom", async () => {
    // The dead end: the message alone gave the UI nothing to act on, so an
    // unverified user got a flat error and no way to request a new link.
    if (!state.user) throw new Error("expected signed-in test user");
    state.user.emailVerified = false;
    const body = await (await checkout(request())).json();
    expect(body).toMatchObject({
      reason: "email_unverified",
      email: "member@example.test",
    });
  });

  it("does NOT require verification when the deployment does not", async () => {
    // The bug this pins. Checkout demanded `emailVerified` unconditionally
    // while a separate setting decided whether anyone was ever asked to
    // verify. With verification off, no account is ever verified — so checkout
    // was unreachable for every user, with nothing they could do about it.
    if (!state.user) throw new Error("expected signed-in test user");
    state.user.emailVerified = false;
    state.verificationRequired = false;

    const response = await checkout(request());

    expect(response.status).toBe(200);
    expect(state.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin browser POSTs", async () => {
    const response = await checkout(request("https://evil.test"));
    expect(response.status).toBe(403);
  });

  it("reports missing billing configuration as unavailable", async () => {
    delete process.env.STRIPE_ANNUAL_PRICE_ID;
    const response = await checkout(request());
    expect(response.status).toBe(503);
  });

  it("does not silently charge full price when the founders coupon is missing", async () => {
    delete process.env.STRIPE_FOUNDERS_COUPON_ID;
    const response = await checkout(request());
    expect(response.status).toBe(503);
    expect(state.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("reuses an existing Customer and rejects an active membership", async () => {
    state.subscription.status = "active";
    expect((await checkout(request())).status).toBe(409);
    expect(state.stripe.customers.retrieve).not.toHaveBeenCalled();

    state.subscription.status = "inactive";
    expect((await checkout(request())).status).toBe(200);
    expect(state.stripe.customers.retrieve).toHaveBeenCalledWith("cus_existing");
    expect(state.stripe.customers.create).not.toHaveBeenCalled();
  });

  it("rejects an active Stripe subscription before its webhook arrives", async () => {
    state.stripe.subscriptions.list.mockResolvedValue({
      data: [{ status: "active" }],
    });
    expect((await checkout(request())).status).toBe(409);
    expect(state.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates and saves a Customer when the account has none", async () => {
    state.subscription.stripeCustomerId = null;
    await checkout(request());
    expect(state.stripe.customers.create).toHaveBeenCalledWith({
      email: "member@example.test",
      name: "Member",
      metadata: { outpick_user_id: "user_1" },
    });
    expect(state.saveCustomer).toHaveBeenCalledWith("user_1", "cus_new");
  });

  it("applies the founders coupon and configured tax behavior with trusted redirects", async () => {
    await checkout(request());
    expect(state.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ coupon: "coupon_founders" }],
        automatic_tax: { enabled: false },
        success_url: "https://outpick.test/welcome?checkout=success",
        cancel_url: "https://outpick.test/subscribe?checkout=canceled",
      }),
      { idempotencyKey: "outpick-checkout-user_1-founders" },
    );
  });

  it("enables automatic tax only when explicitly configured", async () => {
    process.env.STRIPE_AUTOMATIC_TAX_ENABLED = "true";
    await checkout(request());
    expect(state.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ automatic_tax: { enabled: true } }),
      expect.anything(),
    );
  });

  it("gives the allowlisted production test coupon priority over founders", async () => {
    process.env.STRIPE_PRODUCTION_TEST_EMAIL = " MEMBER@example.TEST ";
    process.env.STRIPE_PRODUCTION_TEST_COUPON_ID = "coupon_one_dollar";
    await checkout(request());
    expect(state.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ coupon: "coupon_one_dollar" }],
        metadata: expect.objectContaining({
          offer_type: "production_test",
          founders_offer: "true",
        }),
      }),
      { idempotencyKey: "outpick-checkout-user_1-production_test" },
    );
  });

  it("fails safely instead of charging full price when the test coupon is missing", async () => {
    process.env.STRIPE_PRODUCTION_TEST_EMAIL = "member@example.test";
    delete process.env.STRIPE_PRODUCTION_TEST_COUPON_ID;
    const response = await checkout(request());
    expect(response.status).toBe(503);
    expect(state.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("never reapplies the founders coupon after redemption", async () => {
    state.subscription.foundersDiscountRedeemedAt = "2026-06-01T00:00:00.000Z";
    await checkout(request());
    expect(state.stripe.checkout.sessions.create.mock.calls[0][0]).not.toHaveProperty(
      "discounts",
    );
  });

  it("opens the portal with the configured return URL", async () => {
    const response = await portal(request());
    expect(response.status).toBe(200);
    expect(state.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://outpick.test/dashboard/settings",
    });
  });
});
