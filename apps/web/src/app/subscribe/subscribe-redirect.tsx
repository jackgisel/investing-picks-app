"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sendVerificationEmail } from "@/lib/auth-client";

export function SubscribeRedirect() {
  const [error, setError] = useState<string | null>(null);
  // Set only for the unverified-email refusal, which is the one checkout
  // failure the user can actually fix from here.
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          url?: string;
          error?: string;
          reason?: string;
          email?: string;
        };
        if (!response.ok || !body.url) {
          if (body.reason === "email_unverified") {
            setUnverified(body.email ?? "");
          }
          throw new Error(body.error || "Checkout could not be started");
        }
        window.location.assign(body.url);
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

  async function resend() {
    if (!unverified) return;
    setResending(true);
    try {
      await sendVerificationEmail({
        email: unverified,
        callbackURL: "/subscribe",
      });
    } catch {
      /* reported identically either way — see the login page */
    }
    setResending(false);
    setResent(true);
  }

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 py-16">
      <div className="soft-card w-full max-w-md text-center">
        {error && unverified !== null ? (
          <>
            <p className="panel-label panel-label-yellow mb-3">
              One quick check
            </p>
            <p className="font-sans text-[14px] text-text-muted mb-2">
              Confirm your email address and we&apos;ll take you straight to
              checkout.
            </p>
            {unverified && (
              <p className="font-sans text-[14px] font-semibold text-text mb-6">
                {unverified}
              </p>
            )}
            <button
              type="button"
              onClick={() => void resend()}
              disabled={resending || resent}
              className="btn-primary disabled:opacity-60"
            >
              {resending
                ? "Sending…"
                : resent
                  ? "Sent — check your inbox"
                  : "Send the link"}
            </button>
            <p className="font-sans text-[12px] text-text-dim mt-4">
              Already clicked it? <Link href="/subscribe" className="underline">Try again</Link>.
              Nothing arriving? Check spam.
            </p>
          </>
        ) : error ? (
          <>
            <p className="panel-label panel-label-red mb-3">Billing unavailable</p>
            <p className="font-sans text-[14px] text-text-muted mb-6">{error}</p>
            <Link href="/dashboard/settings" className="btn-outline">
              Return to settings
            </Link>
          </>
        ) : (
          <>
            <p className="panel-label panel-label-green mb-3">Secure checkout</p>
            <p className="font-sans text-[14px] text-text-muted">
              Redirecting you to Stripe…
            </p>
          </>
        )}
      </div>
    </div>
  );
}

