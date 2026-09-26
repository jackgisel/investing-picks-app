import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  invited: true,
  record: {
    status: "inactive",
    stripeCustomerId: null as string | null,
  },
  stripe: {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    subscriptions: { list: vi.fn(), create: vi.fn() },
  } as unknown,
  saveCustomer: vi.fn(),
  sync: vi.fn(async () => true),
}));

type StripeMock = {
  customers: { retrieve: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  subscriptions: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};
const stripe = () => state.stripe as StripeMock;

vi.mock("@/lib/stripe", () => ({ getStripe: () => state.stripe }));
vi.mock("@/lib/membership-invites", () => ({
  isComplimentaryInviteEmail: async () => state.invited,
  ensureComplimentaryCoupon: async () => "outpick_complimentary",
}));
vi.mock("@/lib/subscription", () => ({
  getSubscriptionRecord: async () => state.record,
  saveStripeCustomer: state.saveCustomer,
  syncStripeSubscription: state.sync,
}));
vi.mock("@/lib/stripe-webhook", () => ({
  snapshotStripeSubscription: (subscription: { id: string }) => ({
    stripeSubscriptionId: subscription.id,
  }),
}));

import { grantComplimentaryMembership } from "./complimentary-grant";

const invitee = {
  id: "user_1",
  email: "family@example.test",
  name: "Family",
  emailVerified: true,
};

describe("grantComplimentaryMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_ANNUAL_PRICE_ID = "price_annual";
    state.invited = true;
    state.record = { status: "inactive", stripeCustomerId: null };
    stripe().customers.create.mockResolvedValue({ id: "cus_new" });
    stripe().customers.retrieve.mockResolvedValue({ id: "cus_old", deleted: false });
    stripe().subscriptions.list.mockResolvedValue({ data: [] });
    stripe().subscriptions.create.mockResolvedValue({ id: "sub_free" });
  });

  it("creates a Customer and a $0 Subscription, then records it immediately", async () => {
    expect(await grantComplimentaryMembership(invitee)).toBe("granted");
    expect(state.saveCustomer).toHaveBeenCalledWith("user_1", "cus_new");
    expect(stripe().subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        discounts: [{ coupon: "outpick_complimentary" }],
      }),
      { idempotencyKey: "outpick-complimentary-v1-user_1-cus_new" },
    );
    expect(state.sync).toHaveBeenCalledWith({ stripeSubscriptionId: "sub_free" });
  });

  it("does nothing, and calls no Stripe API, for an address that was not invited", async () => {
    state.invited = false;
    expect(await grantComplimentaryMembership(invitee)).toBe("not_invited");
    expect(stripe().customers.create).not.toHaveBeenCalled();
    expect(stripe().subscriptions.create).not.toHaveBeenCalled();
  });

  it("never grants to an unproven address", async () => {
    expect(
      await grantComplimentaryMembership({ ...invitee, emailVerified: false }),
    ).toBe("not_invited");
    expect(stripe().subscriptions.create).not.toHaveBeenCalled();
  });

  it("leaves an existing membership alone", async () => {
    state.record = { status: "active", stripeCustomerId: "cus_old" };
    expect(await grantComplimentaryMembership(invitee)).toBe("already_active");
    expect(stripe().subscriptions.create).not.toHaveBeenCalled();
  });

  it("does not stack a Subscription on one Stripe has but the webhook has not delivered", async () => {
    state.record = { status: "inactive", stripeCustomerId: "cus_old" };
    stripe().subscriptions.list.mockResolvedValue({ data: [{ status: "active" }] });
    expect(await grantComplimentaryMembership(invitee)).toBe("already_active");
    expect(stripe().subscriptions.create).not.toHaveBeenCalled();
  });

  it("reuses a stored Customer", async () => {
    state.record = { status: "canceled", stripeCustomerId: "cus_old" };
    expect(await grantComplimentaryMembership(invitee)).toBe("granted");
    expect(stripe().customers.create).not.toHaveBeenCalled();
    expect(stripe().subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_old" }),
      { idempotencyKey: "outpick-complimentary-v1-user_1-cus_old" },
    );
  });
});
