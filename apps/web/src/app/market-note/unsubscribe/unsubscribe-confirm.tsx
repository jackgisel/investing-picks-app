"use client";

import { useState } from "react";
import { PillButton } from "@/components/ui/pill-button";

type State = "idle" | "working" | "done" | "error";

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");

  async function confirm() {
    setState("working");
    try {
      const res = await fetch(
        `/api/market-note/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
      const body = (await res.json()) as { ok?: boolean };
      setState(body.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-soft border border-border bg-bg-secondary/40 px-7 py-8">
        <p className="font-sans text-[15px] text-text mb-2 font-semibold">
          You&apos;re unsubscribed.
        </p>
        <p className="font-sans text-[14px] text-text-muted leading-relaxed mb-6">
          You won&apos;t get the market note again. No hard feelings — the track
          record stays public whether or not you&apos;re on the list.
        </p>
        <PillButton href="/" variant="outline" arrow>
          Back to Outpick
        </PillButton>
      </div>
    );
  }

  return (
    <div className="rounded-soft border border-border bg-bg-secondary/40 px-7 py-8">
      <p className="font-sans text-[15px] text-text-muted leading-relaxed mb-6">
        Confirm and we&apos;ll stop sending the weekly market note to this
        address.
      </p>
      <PillButton onClick={confirm} disabled={state === "working"}>
        {state === "working" ? "Unsubscribing…" : "Confirm unsubscribe"}
      </PillButton>
      {state === "error" && (
        <p className="font-sans text-[13px] text-accent-red mt-4">
          That link is no longer valid. If you keep getting the note, reply to
          any email and we&apos;ll remove you by hand.
        </p>
      )}
    </div>
  );
}
