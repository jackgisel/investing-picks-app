"use client";

import {
  PADDLE_CLIENT_TOKEN,
  PADDLE_FOUNDERS_PRICE_ID,
  PADDLE_PRICE_ID,
} from "@/lib/constants";
import { isFoundersDealActive } from "@/lib/portfolio";

/**
 * Resolve the price ID to charge. While the founders deal is active and a
 * founders price ID is configured, new members check out at the founders rate;
 * otherwise everyone gets the standard annual price.
 */
export function resolveCheckoutPriceId(): string {
  if (isFoundersDealActive() && PADDLE_FOUNDERS_PRICE_ID) {
    return PADDLE_FOUNDERS_PRICE_ID;
  }
  return PADDLE_PRICE_ID;
}

let paddleInitialized = false;

export async function initPaddle() {
  if (paddleInitialized || typeof window === "undefined") return;

  try {
    const { initializePaddle } = await import("@paddle/paddle-js");
    // NEXT_PUBLIC_PADDLE_ENV=sandbox lets us verify the full checkout →
    // webhook → subscription-active loop before switching to live billing,
    // without a code change.
    const environment =
      process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : undefined;
    await initializePaddle({
      token: PADDLE_CLIENT_TOKEN,
      ...(environment ? { environment } : {}),
    });
    paddleInitialized = true;
  } catch (error) {
    console.error("Failed to initialize Paddle:", error);
  }
}

export async function openCheckout(email?: string, priceIdOverride?: string) {
  await initPaddle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paddle = (window as any).Paddle;
  if (paddle) {
    const priceId = priceIdOverride ?? resolveCheckoutPriceId();
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: email ? { email } : undefined,
      settings: {
        displayMode: "overlay",
        theme: "dark",
        successUrl: `${window.location.origin}/dashboard?subscribed=true`,
      },
    });
  }
}
