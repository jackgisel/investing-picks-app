import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations, requireEmailVerification } from "@/lib/auth";
import {
  isFoundersOfferEligible,
  isSubscriptionEntitled,
  normalizeStripeStatus,
} from "@/lib/billing";
import {
  configuredAppUrl,
  isSameOriginBrowserPost,
} from "@/lib/billing-security";
import { isFoundersWindowActive } from "@/lib/founders-server";
import { getServerUser } from "@/lib/server-session";
import { getStripe } from "@/lib/stripe";
import {
  automaticTaxEnabled,
  buildCheckoutParams,
  isProductionTestAccount,
  type CheckoutOffer,
} from "@/lib/stripe-checkout";
import {
  getSubscriptionRecord,
  saveStripeCustomer,
} from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    return await createCheckoutResponse(request);
  } catch (error) {
    console.error("Checkout failed:", error);
    return NextResponse.json(
      { error: "Checkout could not be started" },
      { status: 502 },
    );
  }
}

async function createCheckoutResponse(request: NextRequest) {
  const appUrl = configuredAppUrl();
  const stripe = getStripe();
  const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID?.trim();
  if (!appUrl || !stripe || !annualPriceId) {
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
  /*
   * Verification gate, tied to the SAME setting that governs sign-in.
   *
   * This used to demand `emailVerified` unconditionally while
   * `requireEmailVerification()` decided whether anyone was ever asked to
   * verify. With that setting off — explicitly, or because RESEND_API_KEY is
   * absent so `sendVerifyEmail` no-ops — accounts can sign up and sign in but
   * `emailVerified` never becomes true for anybody, and checkout is
   * unreachable for the entire userbase with no way to clear it.
   *
   * Two independent settings governing one requirement is what made an
   * ordinary account permanently unable to pay. One rule now governs both: if
   * an unverified user may sign in, they may also subscribe.
   */
  if (requireEmailVerification() && !user.emailVerified) {
    return NextResponse.json(
      {
        error: "Verify your email before starting a membership",
        reason: "email_unverified",
        email: user.email,
      },
      { status: 403 },
    );
  }

  const subscription = await getSubscriptionRecord(user.id);
  if (isSubscriptionEntitled(subscription.status)) {
    return NextResponse.json(
      { error: "Membership is already active" },
      { status: 409 },
    );
  }

  let customerId = subscription.stripeCustomerId;
  if (customerId) {
    const existing = await stripe.customers.retrieve(customerId);
    if (existing.deleted) {
      customerId = null;
    } else {
      // Check Stripe as well as the webhook-backed row. This closes the brief
      // window after payment where a delayed webhook could otherwise allow a
      // second active subscription for the same Customer.
      const currentSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      if (
        currentSubscriptions.data.some((candidate) =>
          isSubscriptionEntitled(normalizeStripeStatus(candidate.status)),
        )
      ) {
        return NextResponse.json(
          { error: "Membership is already active" },
          { status: 409 },
        );
      }
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { outpick_user_id: user.id },
    });
    customerId = customer.id;
    await saveStripeCustomer(user.id, customerId);
  }

  const productionTest = isProductionTestAccount(
    user.email,
    process.env.STRIPE_PRODUCTION_TEST_EMAIL,
  );
  const productionTestCouponId =
    process.env.STRIPE_PRODUCTION_TEST_COUPON_ID?.trim() || null;
  if (productionTest && !productionTestCouponId) {
    // Never let a missing smoke-test variable turn a planned $1 purchase into
    // a full-price live charge.
    return NextResponse.json(
      { error: "Production test checkout is temporarily unavailable" },
      { status: 503 },
    );
  }

  const foundersEligible = !productionTest && isFoundersOfferEligible({
    foundersWindowActive: await isFoundersWindowActive(),
    redeemedAt: subscription.foundersDiscountRedeemedAt,
  });
  const foundersCouponId = process.env.STRIPE_FOUNDERS_COUPON_ID?.trim() || null;
  if (foundersEligible && !foundersCouponId) {
    return NextResponse.json(
      { error: "Founders checkout is temporarily unavailable" },
      { status: 503 },
    );
  }

  const offer: CheckoutOffer = productionTest
    ? "production_test"
    : foundersEligible
      ? "founders"
      : "standard";
  const couponId = productionTest
    ? productionTestCouponId
    : foundersEligible
      ? foundersCouponId
      : null;

  const session = await stripe.checkout.sessions.create(
    buildCheckoutParams({
      appUrl,
      userId: user.id,
      customerId,
      annualPriceId,
      couponId,
      offer,
      automaticTax: automaticTaxEnabled(),
    }),
    {
      // Checkout Sessions default to a 24-hour lifetime, matching Stripe's
      // minimum idempotency retention. Repeated or parallel attempts therefore
      // cannot create two founders-discounted subscriptions.
      idempotencyKey: `outpick-checkout-${user.id}-${offer}`,
    },
  );
  if (!session.url) {
    return NextResponse.json(
      { error: "Checkout could not be created" },
      { status: 502 },
    );
  }
  return NextResponse.json({ url: session.url });
}
