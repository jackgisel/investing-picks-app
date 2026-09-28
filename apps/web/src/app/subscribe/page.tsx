import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureMigrations } from "@/lib/auth";
import { isSubscriptionEntitled } from "@/lib/billing";
import { getServerUser } from "@/lib/server-session";
import { getSubscription } from "@/lib/subscription";
import { DatafastSignupGoal } from "@/components/analytics/datafast-signup-goal";
import { SubscribeRedirect } from "./subscribe-redirect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscribe",
  robots: { index: false, follow: false },
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string }>;
}) {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) redirect("/login?next=/subscribe");

  const subscription = await getSubscription(user.id);
  if (isSubscriptionEntitled(subscription.status)) {
    redirect("/dashboard/settings");
  }

  const query = await searchParams;

  return (
    <>
      <DatafastSignupGoal enabled={query.signup === "1"} />
      <SubscribeRedirect />
    </>
  );
}

