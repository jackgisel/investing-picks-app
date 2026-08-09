import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { ensureMigrations } from "@/lib/auth";
import { sendMembershipWelcomeEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { snapshotStripeSubscription } from "@/lib/stripe-webhook";
import {
  claimMembershipWelcomeEmail,
  markMembershipWelcomeEmailSent,
  recordStripeWebhookEvent,
  releaseMembershipWelcomeEmailClaim,
  syncStripeSubscription,
} from "@/lib/subscription";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const INVOICE_EVENTS = new Set(["invoice.paid", "invoice.payment_failed"]);

function subscriptionIdOf(value: string | Stripe.Subscription | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return subscriptionIdOf(
    invoice.parent?.subscription_details?.subscription ?? null,
  );
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID?.trim();
  if (!stripe || !webhookSecret || !annualPriceId) {
    return NextResponse.json(
      { error: "Webhook unavailable" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.warn("[Stripe] Rejected webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let subscriptionId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    subscriptionId = subscriptionIdOf(session.subscription);
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  } else if (INVOICE_EVENTS.has(event.type)) {
    subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
  }

  try {
    await ensureMigrations();
    if (!subscriptionId) {
      await recordStripeWebhookEvent(event.id, event.type);
      return NextResponse.json({ received: true });
    }
    // Always retrieve Stripe's current snapshot. Duplicate and out-of-order
    // deliveries therefore converge on current state instead of regressing it.
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    const snapshot = snapshotStripeSubscription(current, annualPriceId);
    if (!snapshot.currentPeriodEnd) {
      console.warn(
        `[Stripe] ${event.type}: subscription ${subscriptionId} has no configured membership Price`,
      );
      await recordStripeWebhookEvent(event.id, event.type);
      return NextResponse.json({ received: true });
    }
    const updated = await syncStripeSubscription(snapshot);
    if (!updated) {
      console.warn(
        `[Stripe] ${event.type}: no Outpick user mapped for customer ${snapshot.stripeCustomerId}`,
      );
    } else if (snapshot.status === "active") {
      const claim = await claimMembershipWelcomeEmail(
        snapshot.stripeSubscriptionId,
      );
      if (claim) {
        const sent = await sendMembershipWelcomeEmail({
          to: claim.email,
          name: claim.name,
          stripeSubscriptionId: snapshot.stripeSubscriptionId,
        });
        if (!sent.ok) {
          await releaseMembershipWelcomeEmailClaim(
            snapshot.stripeSubscriptionId,
          );
          throw new Error(
            `membership welcome email failed: ${sent.error ?? "unknown error"}`,
          );
        }
        await markMembershipWelcomeEmailSent(snapshot.stripeSubscriptionId);
      }
    }
    await recordStripeWebhookEvent(event.id, event.type);
  } catch (error) {
    console.error(`[Stripe] ${event.type}: webhook sync failed`, error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
