import { redirect } from "next/navigation";
import { ensureMigrations } from "@/lib/auth";
import { isSubscriptionEntitled } from "@/lib/billing";
import { getServerUser } from "@/lib/server-session";
import { getSubscription } from "@/lib/subscription";
import { SubscribeRedirect } from "./subscribe-redirect";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) redirect("/login?next=/subscribe");

  const subscription = await getSubscription(user.id);
  if (isSubscriptionEntitled(subscription.status)) {
    redirect("/dashboard/settings");
  }

  return <SubscribeRedirect />;
}

