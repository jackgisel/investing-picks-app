import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccess } from "@/lib/api-gate";
import { resolveCallbackPath } from "@/lib/login-redirect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Insights" };

/**
 * Insights are the paid research archive — same entitlement as /api/data/*
 * (active/trialing/past_due subscription, or admin).
 *
 * This gate moved here from app/insights/layout.tsx along with the routes.
 * Note the dashboard layout above does not gate on subscription — it only
 * resolves admin for the nav — so this check is still doing real work and is
 * not made redundant by sitting inside /dashboard.
 */
export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();

  if (!access.entitled) {
    if (access.reason === "anonymous") {
      const pathname =
        (await headers()).get("x-pathname") ?? "/dashboard/insights";
      redirect(`/login?next=${encodeURIComponent(resolveCallbackPath(pathname))}`);
    }
    return <MembersOnly />;
  }

  return <>{children}</>;
}

function MembersOnly() {
  return (
    <div className="space-y-5">
      <h1 className="page-title">Insights</h1>
      <div className="data-card flex flex-col items-center gap-3 py-12 text-center">
        <span className="rounded-full bg-accent-lilac/15 p-3">
          <Lock size={18} className="text-text-muted" />
        </span>
        <p className="panel-label panel-label-lilac">Members only</p>
        <p className="max-w-[440px] font-sans text-[14px] leading-relaxed text-text-muted">
          Research notes on every position — thesis, financials, and cycle
          context — are part of membership. Your account is signed in but does
          not have an active subscription.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
          <Link href="/subscribe" className="btn-primary !px-6 !py-3 !text-xs">
            Start membership
          </Link>
          <Link
            href="/dashboard/settings"
            className="font-sans text-[12px] font-semibold text-text underline underline-offset-2 hover:opacity-70"
          >
            Check subscription status
          </Link>
        </div>
      </div>
    </div>
  );
}
