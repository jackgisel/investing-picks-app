import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Paddle webhook verification
function verifyPaddleWebhook(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest("hex");

  // Paddle sends: ts=TIMESTAMP;h1=HASH
  const parts = signature.split(";");
  const hashPart = parts.find((p) => p.startsWith("h1="));
  if (!hashPart) return false;

  const hash = hashPart.replace("h1=", "");
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");

    // Verify webhook signature in production
    if (process.env.PADDLE_WEBHOOK_SECRET && signature) {
      const isValid = verifyPaddleWebhook(
        rawBody,
        signature,
        process.env.PADDLE_WEBHOOK_SECRET
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const event = JSON.parse(rawBody);

    switch (event.event_type) {
      case "subscription.created":
      case "subscription.activated": {
        const customerId = event.data.customer_id;
        const subscriptionId = event.data.id;
        const email =
          event.data.customer?.email || event.data.custom_data?.email;

        // TODO: Update user in your database
        // - Set subscriptionStatus to "active"
        // - Store paddleCustomerId and paddleSubscriptionId
        console.log(
          `[Paddle] Subscription activated for ${email}: ${subscriptionId}`
        );
        break;
      }

      case "subscription.canceled":
      case "subscription.past_due": {
        const subscriptionId = event.data.id;

        // TODO: Update user in your database
        // - Set subscriptionStatus to "canceled" or "past_due"
        console.log(
          `[Paddle] Subscription ${event.event_type}: ${subscriptionId}`
        );
        break;
      }

      case "subscription.updated": {
        const subscriptionId = event.data.id;
        const status = event.data.status;

        // TODO: Update subscription status
        console.log(
          `[Paddle] Subscription updated: ${subscriptionId} → ${status}`
        );
        break;
      }

      default:
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
