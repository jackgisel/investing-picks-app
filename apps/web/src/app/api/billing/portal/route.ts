import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import {
  configuredAppUrl,
  isSameOriginBrowserPost,
} from "@/lib/billing-security";
import { getServerUser } from "@/lib/server-session";
import { getStripe } from "@/lib/stripe";
import { getSubscriptionRecord } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    return await createPortalResponse(request);
  } catch (error) {
    console.error("Billing portal failed:", error);
    return NextResponse.json(
      { error: "Billing could not be opened" },
      { status: 502 },
    );
  }
}

async function createPortalResponse(request: NextRequest) {
  const appUrl = configuredAppUrl();
  const stripe = getStripe();
  if (!appUrl || !stripe) {
    return NextResponse.json(
      { error: "Billing is temporarily unavailable" },
      { status: 503 },
    );
  }
  if (!isSameOriginBrowserPost(request, appUrl)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureMigrations();
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const subscription = await getSubscriptionRecord(user.id);
  if (!subscription.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account exists" },
      { status: 409 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: new URL("/dashboard/settings", appUrl).toString(),
  });
  return NextResponse.json({ url: session.url });
}

