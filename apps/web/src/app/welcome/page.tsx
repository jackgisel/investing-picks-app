import { redirect } from "next/navigation";
import { ensureMigrations } from "@/lib/auth";
import { isSubscriptionEntitled } from "@/lib/billing";
import { getServerUser } from "@/lib/server-session";
import { getSubscription } from "@/lib/subscription";
import { WelcomeExperience } from "./welcome-experience";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) redirect("/login?next=/welcome");

  const [subscription, query] = await Promise.all([
    getSubscription(user.id),
    searchParams,
  ]);
  const active = isSubscriptionEntitled(subscription.status);

  // A query parameter never grants access. It only allows this page to wait
  // while the signed Stripe webhook updates the local subscription record.
  if (!active && query.checkout !== "success") redirect("/subscribe");

  return (
    <WelcomeExperience
      firstName={user.name?.trim().split(/\s+/)[0] || null}
      initiallyActive={active}
    />
  );
}
