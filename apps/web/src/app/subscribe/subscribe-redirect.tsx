"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestBillingUrl } from "@/lib/billing-client";

export function SubscribeRedirect() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const url = await requestBillingUrl("/api/billing/checkout", {
          signal: controller.signal,
          fallbackError: "Checkout could not be started",
        });
        window.location.assign(url);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Checkout could not be started",
          );
        }
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-[calc(100dvh-var(--nav-h))] flex items-center justify-center px-4 py-16">
      <div className="soft-card w-full max-w-md text-center">
        {error ? (
          <>
            <p className="panel-label mb-3">Billing unavailable</p>
            <p className="font-sans text-[14px] text-text-muted mb-6">{error}</p>
            <Link href="/dashboard/settings" className="btn-outline">
              Return to settings
            </Link>
          </>
        ) : (
          <>
            <p className="panel-label mb-3">Secure checkout</p>
            <p className="font-sans text-[14px] text-text-muted">
              Redirecting you to Stripe…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
