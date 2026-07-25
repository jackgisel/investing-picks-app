import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { verifyPaddleWebhook } from "@/lib/paddle-webhook";
import {
  upsertSubscriptionFromWebhook,
  type SubscriptionStatus,
} from "@/lib/subscription";

// Paddle's status strings → our internal status enum
function normalizeStatus(raw: unknown): SubscriptionStatus {
  if (typeof raw !== "string") return "inactive";
  switch (raw) {
    case "active":
    case "trialing":
    case "past_due":
    case "paused":
    case "canceled":
      return raw;
    default:
      return "inactive";
  }
}

type PaddleSubscriptionEvent = {
  event_type?: string;
  data?: {
    id?: string;
    customer_id?: string;
    status?: string;
    canceled_at?: string | null;
    current_billing_period?: { ends_at?: string | null } | null;
    customer?: { email?: string | null } | null;
    custom_data?: { email?: string | null } | null;
  };
};

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");

    // Fail closed. An unset secret or a missing signature is a rejection, not
    // a bypass — otherwise anyone could POST a fake subscription.activated for
    // an arbitrary email and grant themselves a paid account.
    const verified = verifyPaddleWebhook({
      rawBody,
      signatureHeader: signature,
      secret: process.env.PADDLE_WEBHOOK_SECRET,
    });
    if (!verified.ok) {
      console.warn(`[Paddle] Rejected webhook: ${verified.reason}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    await ensureMigrations();

    const event = JSON.parse(rawBody) as PaddleSubscriptionEvent;
    const data = event.data ?? {};

    const subscriptionEventTypes = new Set([
      "subscription.created",
      "subscription.activated",
      "subscription.updated",
      "subscription.canceled",
      "subscription.past_due",
      "subscription.paused",
      "subscription.resumed",
    ]);

    if (event.event_type && subscriptionEventTypes.has(event.event_type)) {
      // For canceled events, force status to canceled regardless of payload.
      const status: SubscriptionStatus =
        event.event_type === "subscription.canceled"
          ? "canceled"
          : event.event_type === "subscription.past_due"
            ? "past_due"
            : event.event_type === "subscription.paused"
              ? "paused"
              : normalizeStatus(data.status ?? "active");

      const email =
        data.customer?.email || data.custom_data?.email || null;
      const paddleCustomerId = data.customer_id ?? null;
      const paddleSubscriptionId = data.id ?? null;
      const currentPeriodEnd = data.current_billing_period?.ends_at ?? null;
      const canceledAt = data.canceled_at ?? null;

      const updated = await upsertSubscriptionFromWebhook({
        email,
        paddleCustomerId,
        paddleSubscriptionId,
        status,
        currentPeriodEnd,
        canceledAt,
      });

      if (!updated) {
        console.warn(
          `[Paddle] ${event.event_type}: no matching user (email=${email}, customer=${paddleCustomerId})`
        );
      } else {
        console.log(
          `[Paddle] ${event.event_type}: synced subscription ${paddleSubscriptionId} → ${status}`
        );
      }
    } else {
      console.log(`[Paddle] Unhandled event: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Paddle] Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
