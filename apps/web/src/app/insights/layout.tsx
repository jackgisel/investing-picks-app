import Link from "next/link";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { getAccess } from "@/lib/api-gate";

export const dynamic = "force-dynamic";

/**
 * Insights are the paid research archive — not marketing content.
 * Same entitlement as /api/data/* (active/trialing/past_due subscription, or admin).
 */
export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();

  if (!access.entitled) {
    if (access.reason === "anonymous") {
      redirect("/login");
    }
    return <MembersOnly />;
  }

  return <>{children}</>;
}

function MembersOnly() {
  return (
    <section className="border-b border-border">
      <div className="container-op py-24 flex flex-col items-center text-center gap-4">
        <Lock size={22} className="text-text-dim" />
        <p className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
          Members only
        </p>
        <h1 className="font-sans text-[28px] sm:text-[34px] font-extrabold tracking-tight uppercase max-w-[560px]">
          Insights are part of Outpick membership
        </h1>
        <p className="font-sans text-[15px] text-text-muted leading-relaxed max-w-[480px]">
          Research notes on every position — thesis, financials, and cycle context —
          are available to subscribers. Your account is signed in but does not have an
          active membership.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          <Link href="/#pricing" className="btn-primary !text-xs !px-6 !py-3">
            View membership
          </Link>
          <Link
            href="/dashboard/settings"
            className="font-sans text-[12px] text-text font-semibold underline underline-offset-2 hover:opacity-70"
          >
            Check subscription status
          </Link>
        </div>
      </div>
    </section>
  );
}
