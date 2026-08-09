import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  event: {
    id: "evt_123",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_123" } },
  },
  signatureError: false,
  mapped: true,
  currentStatus: "active",
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
  sync: vi.fn(),
  recordEvent: vi.fn(),
  claimWelcome: vi.fn(),
  markWelcomeSent: vi.fn(),
  releaseWelcome: vi.fn(),
  sendWelcome: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ ensureMigrations: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => state.stripe }));
vi.mock("@/lib/email", () => ({
  sendMembershipWelcomeEmail: state.sendWelcome,
}));
vi.mock("@/lib/subscription", () => ({
  syncStripeSubscription: state.sync,
  recordStripeWebhookEvent: state.recordEvent,
  claimMembershipWelcomeEmail: state.claimWelcome,
  markMembershipWelcomeEmailSent: state.markWelcomeSent,
  releaseMembershipWelcomeEmailClaim: state.releaseWelcome,
}));

import { POST } from "./route";

function request(body = '{"unaltered":true}', signature = "valid_signature") {
  return new NextRequest("https://outpick.test/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function subscription(status = state.currentStatus) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status,
    cancel_at_period_end: status === "active",
    canceled_at: status === "canceled" ? 1_800_000_001 : null,
    metadata: { outpick_user_id: "user_1", founders_offer: "true" },
    items: {
      data: [
        {
          price: { id: "price_annual" },
          current_period_end: 1_800_000_000,
        },
      ],
    },
  };
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_value";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_value";
    process.env.STRIPE_ANNUAL_PRICE_ID = "price_annual";
    state.event = {
      id: "evt_123",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    };
    state.signatureError = false;
    state.mapped = true;
    state.currentStatus = "active";
    state.stripe.webhooks.constructEvent.mockImplementation(() => {
      if (state.signatureError) throw new Error("bad signature");
      return state.event;
    });
    state.stripe.subscriptions.retrieve.mockImplementation(async () =>
      subscription(),
    );
    state.sync.mockImplementation(async () => state.mapped);
    state.recordEvent.mockResolvedValue(undefined);
    state.claimWelcome.mockResolvedValue(null);
    state.markWelcomeSent.mockResolvedValue(undefined);
    state.releaseWelcome.mockResolvedValue(undefined);
    state.sendWelcome.mockResolvedValue({ ok: true, id: "email_123" });
  });

  it("verifies the untouched raw body and signature", async () => {
    const raw = '{ "spacing": "must survive" }';
    const response = await POST(request(raw, "stripe_sig"));
    expect(response.status).toBe(200);
    expect(state.stripe.webhooks.constructEvent).toHaveBeenCalledWith(
      raw,
      "stripe_sig",
      "whsec_test_value",
    );
  });

  it("rejects missing or invalid signatures", async () => {
    expect((await POST(request("{}", ""))).status).toBe(400);
    state.signatureError = true;
    expect((await POST(request())).status).toBe(400);
  });

  it("is unavailable when webhook configuration is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await POST(request())).status).toBe(503);
  });

  it("retrieves current state so an old event cannot regress access", async () => {
    state.event = {
      id: "evt_deleted",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", status: "canceled" } },
    };
    state.currentStatus = "active";
    await POST(request());
    expect(state.stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(state.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: "2027-01-15T08:00:00.000Z",
      }),
    );
  });

  it("makes duplicate delivery idempotent through the same current snapshot", async () => {
    await POST(request());
    await POST(request());
    expect(state.stripe.subscriptions.retrieve).toHaveBeenCalledTimes(2);
    expect(state.sync.mock.calls[0][0]).toEqual(state.sync.mock.calls[1][0]);
    expect(state.recordEvent).toHaveBeenCalledTimes(2);
  });

  it("acknowledges a legitimate event for an unmapped Customer", async () => {
    state.mapped = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("handles checkout completion by retrieving its Subscription", async () => {
    state.event = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_checkout" } },
    };
    await POST(request());
    expect(state.stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_checkout");
  });

  it("sends the membership email once after the current snapshot is active", async () => {
    state.claimWelcome
      .mockResolvedValueOnce({
        userId: "user_1",
        email: "member@example.test",
        name: "Member",
      })
      .mockResolvedValueOnce(null);

    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect(state.sendWelcome).toHaveBeenCalledTimes(1);
    expect(state.sendWelcome).toHaveBeenCalledWith({
      to: "member@example.test",
      name: "Member",
      stripeSubscriptionId: "sub_123",
    });
    expect(state.markWelcomeSent).toHaveBeenCalledWith("sub_123");
  });

  it("releases the email claim and asks Stripe to retry when delivery fails", async () => {
    state.claimWelcome.mockResolvedValue({
      userId: "user_1",
      email: "member@example.test",
      name: "Member",
    });
    state.sendWelcome.mockResolvedValue({ ok: false, error: "provider down" });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(state.releaseWelcome).toHaveBeenCalledWith("sub_123");
    expect(state.markWelcomeSent).not.toHaveBeenCalled();
    expect(state.recordEvent).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not send the membership email for non-active snapshots", async () => {
    state.currentStatus = "past_due";
    await POST(request());
    expect(state.claimWelcome).not.toHaveBeenCalled();
    expect(state.sendWelcome).not.toHaveBeenCalled();
  });

  it.each(["invoice.paid", "invoice.payment_failed"])(
    "reconciles the current Subscription for %s",
    async (type) => {
      state.event = {
        id: `evt_${type}`,
        type,
        data: {
          object: {
            parent: {
              type: "subscription_details",
              subscription_details: { subscription: "sub_invoice" },
            },
          },
        },
      };
      await POST(request());
      expect(state.stripe.subscriptions.retrieve).toHaveBeenCalledWith(
        "sub_invoice",
      );
      expect(state.recordEvent).toHaveBeenCalledWith(`evt_${type}`, type);
    },
  );

  it("records acknowledged events that do not map to a Subscription", async () => {
    state.event = {
      id: "evt_irrelevant",
      type: "customer.created",
      data: { object: { id: "cus_123" } },
    };
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(state.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(state.recordEvent).toHaveBeenCalledWith(
      "evt_irrelevant",
      "customer.created",
    );
  });
});
