"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "idle" | "working" | "done" | "error";

type Variant = "inline" | "panel";

/**
 * The only free thing on the site.
 *
 * `source` is stored with the address so we can tell which placement actually
 * converts — hero, blog footer, or the standalone panel — rather than guessing.
 */
export function MarketNoteSignup({
  source,
  variant = "inline",
  className,
}: {
  source: string;
  variant?: Variant;
  className?: string;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "working") return;

    setStatus("working");
    setMessage("");

    try {
      const res = await fetch("/api/market-note/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, company }),
      });
      const body = (await res.json()) as { status?: string; error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "Something went wrong. Try again shortly.");
        return;
      }

      setStatus("done");
      setMessage(
        body.status === "already"
          ? "You're already on the list — next note lands this week."
          : "You're in. Check your inbox for a confirmation."
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again shortly.");
    }
  }

  if (status === "done") {
    return (
      <div
        className={cn(
          variant === "panel" &&
            "rounded-soft border border-accent-green/25 bg-accent-green-soft/40 px-7 py-8",
          className
        )}
        role="status"
      >
        <p className="font-sans text-[14px] text-text font-semibold mb-1">
          {message}
        </p>
        <p className="font-sans text-[13px] text-text-muted leading-relaxed">
          One short read a week. Unsubscribe from any email in one click.
        </p>
      </div>
    );
  }

  const form = (
    <form onSubmit={onSubmit} className="w-full">
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>

      {/* Honeypot — hidden from people, tempting to bots. Not display:none,
          which some bots detect and skip. */}
      <div
        aria-hidden
        className="absolute w-px h-px -left-[9999px] overflow-hidden"
      >
        <label htmlFor={`${id}-company`}>Company</label>
        <input
          id={`${id}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={status === "error"}
          aria-describedby={message ? `${id}-msg` : undefined}
          className="flex-1 min-w-0 rounded-pill border border-border-strong bg-bg px-5 py-2.5 font-sans text-[14px] text-text placeholder:text-text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
        <button
          type="submit"
          disabled={status === "working"}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-pill border border-transparent bg-inverse px-5 py-2.5 font-sans text-xs sm:text-sm font-semibold uppercase tracking-[0.08em] text-inverse-fg transition-[color,background-color,border-color,transform] duration-200 hover:bg-inverse/90 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {status === "working" ? "Sending…" : "Get the note"}
        </button>
      </div>

      {message && (
        <p
          id={`${id}-msg`}
          role={status === "error" ? "alert" : "status"}
          className={cn(
            "font-sans text-[12px] mt-2.5",
            status === "error" ? "text-accent-red" : "text-text-muted"
          )}
        >
          {message}
        </p>
      )}
    </form>
  );

  if (variant === "inline") {
    return <div className={cn("relative", className)}>{form}</div>;
  }

  return (
    <div
      className={cn(
        "relative rounded-soft border border-border bg-bg-secondary/40 px-7 py-8 sm:px-8",
        className
      )}
    >
      <p className="section-label section-label-mint">The Market Note</p>
      <h3 className="font-sans text-[20px] sm:text-[22px] font-bold tracking-tight mb-2.5">
        One short read, every week. Free.
      </h3>
      <p className="font-sans text-[14px] text-text-muted leading-relaxed mb-6 max-w-[46ch]">
        What the model is seeing across ~3,600 US-listed stocks, which sectors
        are scoring, and what we make of it. Market commentary — the picks stay
        behind the membership.
      </p>
      {form}
    </div>
  );
}
