"use client";

import { PADDLE_CLIENT_TOKEN, PADDLE_PRICE_ID } from "@/lib/constants";

let paddleInitialized = false;

export async function initPaddle() {
  if (paddleInitialized || typeof window === "undefined") return;

  try {
    const { initializePaddle } = await import("@paddle/paddle-js");
    await initializePaddle({
      token: PADDLE_CLIENT_TOKEN,
      // Use sandbox for development:
      // environment: "sandbox",
    });
    paddleInitialized = true;
  } catch (error) {
    console.error("Failed to initialize Paddle:", error);
  }
}

export async function openCheckout(email?: string) {
  await initPaddle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paddle = (window as any).Paddle;
  if (paddle) {
    paddle.Checkout.open({
      items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
      customer: email ? { email } : undefined,
      settings: {
        displayMode: "overlay",
        theme: "dark",
        successUrl: `${window.location.origin}/dashboard?subscribed=true`,
      },
    });
  }
}
