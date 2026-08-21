import type { Metadata } from "next";
import { PillButton } from "@/components/ui/pill-button";
import { UnsubscribeConfirm } from "./unsubscribe-confirm";

export const metadata: Metadata = {
  title: "Unsubscribe — Outpick Market Note",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <section className="border-b border-border">
      <div className="container-op py-20 sm:py-28">
        <div className="max-w-[520px]">
          <p className="section-label">Market note</p>
          <h1 className="section-title">Leaving the list?</h1>

          {token ? (
            <UnsubscribeConfirm token={token} />
          ) : (
            <div className="rounded-soft border border-border bg-bg-secondary/40 px-7 py-8">
              <p className="font-sans text-[15px] text-text-muted leading-relaxed mb-6">
                This link is missing its unsubscribe code. Use the link at the
                bottom of any market note email, or reply to one and we&apos;ll
                remove you by hand.
              </p>
              <PillButton href="/" variant="outline" arrow>
                Back to Outpick
              </PillButton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
