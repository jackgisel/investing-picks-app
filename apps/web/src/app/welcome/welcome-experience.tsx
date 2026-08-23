"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  ChartNoAxesCombined,
  CircleCheck,
  Mail,
  RefreshCw,
} from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/constants";

type State = "waiting" | "active" | "delayed";

const MEMBER_STATUSES = new Set(["active", "trialing", "past_due"]);

const steps = [
  {
    number: "01",
    title: "Start with the live book",
    copy: "See every open position, the full decision ledger, and performance against the S&P 500 without cherry-picking.",
    href: "/dashboard",
    label: "Open dashboard",
    icon: ChartNoAxesCombined,
    tone: "bg-accent-mint",
  },
  {
    number: "02",
    title: "Read the research",
    copy: "Each published pick comes with the thesis, evidence, risks, and the rules that allowed it into the portfolio.",
    href: "/dashboard/insights",
    label: "Browse research",
    icon: BookOpenText,
    tone: "bg-accent-lilac",
  },
  {
    number: "03",
    title: "Let the cadence work",
    copy: "We evaluate on schedule and publish new high-conviction picks roughly every two weeks. Choose which updates reach your inbox.",
    href: "/dashboard/settings",
    label: "Set preferences",
    icon: Mail,
    tone: "bg-accent-cyan",
  },
] as const;

export function WelcomeExperience({
  firstName,
  initiallyActive,
}: {
  firstName: string | null;
  initiallyActive: boolean;
}) {
  const [state, setState] = useState<State>(
    initiallyActive ? "active" : "waiting",
  );

  useEffect(() => {
    if (initiallyActive) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      try {
        const response = await fetch("/api/me/subscription", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const body = (await response.json()) as {
            subscription?: { status?: string };
          };
          if (MEMBER_STATUSES.has(body.subscription?.status ?? "")) {
            setState("active");
            return;
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      if (attempts >= 15) {
        setState("delayed");
        return;
      }
      timer = setTimeout(() => void poll(), 2_000);
    }

    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [initiallyActive]);

  if (state !== "active") {
    return (
      <div className="min-h-[calc(100dvh-72px)] flex items-center justify-center px-5 py-20">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-accent-yellow text-on-accent">
            <RefreshCw
              size={27}
              strokeWidth={1.8}
              className={state === "waiting" ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </div>
          <p className="section-label justify-center">Membership</p>
          <h1 className="font-sans text-[32px] sm:text-[42px] font-bold tracking-tight text-text">
            {state === "waiting"
              ? "Confirming your membership"
              : "Stripe is taking a little longer"}
          </h1>
          <p className="mx-auto mt-5 max-w-lg font-sans text-[15px] sm:text-[16px] leading-relaxed text-text-muted">
            {state === "waiting"
              ? "Your payment is complete. We’re waiting for Stripe’s signed confirmation before unlocking the research dashboard."
              : "Your payment is not lost. Refresh this page in a moment; if it still does not activate, contact us and we’ll trace the Stripe event."}
          </p>
          {state === "delayed" ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Try again
              </button>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-outline">
                Contact support
              </a>
            </div>
          ) : (
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
              This usually takes only a few seconds
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      <section className="container-op py-16 sm:py-24">
        <div className="max-w-3xl">
          <div className="badge mb-8 !text-[11px] !px-4 !py-2 text-accent-green bg-accent-green-soft">
            <CircleCheck size={14} aria-hidden="true" />
            Membership active
          </div>
          <p className="section-label">Welcome to Outpick</p>
          <h1 className="max-w-2xl font-sans text-[42px] sm:text-[64px] font-bold leading-[0.98] tracking-[-0.045em] text-text">
            {firstName ? `${firstName}, you’re in.` : "You’re in."}
          </h1>
          <p className="mt-7 max-w-2xl font-sans text-[17px] sm:text-[19px] leading-relaxed text-text-muted">
            Outpick is built to be read like a research desk, not watched like a
            trading feed. Here is the quickest way to find your footing.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.number} className="bg-bg p-7 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${step.tone} text-on-accent`}>
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <span className="font-mono text-[11px] text-text-dim">
                    {step.number}
                  </span>
                </div>
                <h2 className="mt-8 font-sans text-[20px] font-bold tracking-tight text-text">
                  {step.title}
                </h2>
                <p className="mt-3 min-h-[96px] font-sans text-[14px] leading-relaxed text-text-muted">
                  {step.copy}
                </p>
                <Link
                  href={step.href}
                  className="mt-6 inline-flex items-center gap-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text hover:gap-3 transition-all"
                >
                  {step.label}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/dashboard" className="btn-primary">
            Enter the dashboard
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <p className="font-sans text-[13px] text-text-dim">
            Your receipt and membership guide are on their way by email.
          </p>
        </div>
      </section>
    </div>
  );
}
