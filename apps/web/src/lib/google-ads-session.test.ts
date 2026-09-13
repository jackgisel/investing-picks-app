import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  stripe: {
    checkout: { sessions: { retrieve: vi.fn() } },
  } as { checkout: { sessions: { retrieve: ReturnType<typeof vi.fn> } } } | null,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => state.stripe,
}));

import { loadGoogleAdsCheckoutConversion } from "./google-ads-session";

describe("loadGoogleAdsCheckoutConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO;
    state.stripe = {
      checkout: { sessions: { retrieve: vi.fn() } },
    };
  });

  it("does not look up Stripe unless this is the Checkout thank-you", async () => {
    expect(
      await loadGoogleAdsCheckoutConversion({
        userId: "user_1",
        checkout: undefined,
        sessionId: "cs_test_abc123",
      }),
    ).toBeNull();
    expect(state.stripe?.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("returns the paid session amount and Checkout Session id", async () => {
    state.stripe!.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_test_abc123",
      status: "complete",
      payment_status: "paid",
      amount_total: 25_000,
      client_reference_id: "user_1",
      metadata: { outpick_user_id: "user_1" },
      payment_intent: "pi_paid",
    });
    expect(
      await loadGoogleAdsCheckoutConversion({
        userId: "user_1",
        checkout: "success",
        sessionId: "cs_test_abc123",
      }),
    ).toEqual({
      sendTo: "AW-967967302/0AqvCL3y2vYcEMaEyM0D",
      value: 250,
      currency: "USD",
      transactionId: "cs_test_abc123",
    });
  });

  it("ignores a missing Stripe client or a session that is not this user's", async () => {
    state.stripe = null;
    expect(
      await loadGoogleAdsCheckoutConversion({
        userId: "user_1",
        checkout: "success",
        sessionId: "cs_test_abc123",
      }),
    ).toBeNull();

    state.stripe = {
      checkout: { sessions: { retrieve: vi.fn() } },
    };
    state.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_test_abc123",
      status: "complete",
      payment_status: "paid",
      amount_total: 25_000,
      client_reference_id: "user_other",
      metadata: { outpick_user_id: "user_other" },
    });
    expect(
      await loadGoogleAdsCheckoutConversion({
        userId: "user_1",
        checkout: "success",
        sessionId: "cs_test_abc123",
      }),
    ).toBeNull();
  });
});
