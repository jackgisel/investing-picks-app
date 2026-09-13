import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { GoogleAdsConversion } from "@/components/layout/google-ads-conversion";
import { ensureMigrations } from "@/lib/auth";
import { isSubscriptionEntitled } from "@/lib/billing";
import { loadGoogleAdsCheckoutConversion } from "@/lib/google-ads-session";
import { getServerUser } from "@/lib/server-session";
import { getSubscription } from "@/lib/subscription";
import { WelcomeExperience } from "./welcome-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) redirect("/login?next=/welcome");

  const query = await searchParams;
  const [subscription, conversion] = await Promise.all([
    getSubscription(user.id),
    loadGoogleAdsCheckoutConversion({
      userId: user.id,
      checkout: query.checkout,
      sessionId: query.session_id,
    }),
  ]);
  const active = isSubscriptionEntitled(subscription.status);

  // A query parameter never grants access. It only allows this page to wait
  // while the signed Stripe webhook updates the local subscription record.
  if (!active && query.checkout !== "success") redirect("/subscribe");

  return (
    <>
      {conversion ? <GoogleAdsConversion {...conversion} /> : null}
      <WelcomeExperience
        firstName={user.name?.trim().split(/\s+/)[0] || null}
        initiallyActive={active}
      />
    </>
  );
}
