"use client";

import { useEffect, useState } from "react";
import { PillButton } from "@/components/ui/pill-button";
import { useSession } from "@/lib/auth-client";
import type { SubscriptionStatus } from "@/lib/billing";
import { heroPrimaryCta } from "./hero-cta";

/**
 * Resolves the hero primary button from the live subscription, not merely
 * the session. The homepage stays statically cached; this hydrates after
 * paint the same way the header Dashboard control does.
 */
export function HeroCtaButton() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    if (!session) {
      setStatus(null);
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/me/subscription", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          subscription?: { status?: SubscriptionStatus };
        };
        setStatus(data.subscription?.status ?? null);
      } catch {
        if (controller.signal.aborted) return;
        // Fail closed: keep the membership CTA.
      }
    }

    void load();
    return () => controller.abort();
  }, [session]);

  const cta = heroPrimaryCta(session ? status : null);

  return (
    <PillButton href={cta.href} arrow data-fast-goal={cta.checkoutGoal}>
      {cta.label}
    </PillButton>
  );
}
