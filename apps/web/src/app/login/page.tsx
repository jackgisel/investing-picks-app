"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import Link from "next/link";
import { MailCheck } from "lucide-react";

/** Where the magic link should land after it verifies. */
function resolveCallbackURL(): string {
  if (typeof window === "undefined") return "/subscribe";
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested === "/subscribe" ||
    requested === "/welcome" ||
    requested === "/dashboard"
    ? requested
    : "/subscribe";
}

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  /**
   * There is no password on this account model — one email field, one link.
   * The same call signs in a returning member and creates the account for a
   * new one; `name` is only used the first time an address is seen.
   */
  async function requestLink(address: string, displayName: string) {
    const result = await signIn.magicLink({
      email: address,
      name: displayName || undefined,
      callbackURL: resolveCallbackURL(),
    });
    if (result.error) {
      throw new Error(result.error.message || "Could not send the link");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestLink(email.trim(), name.trim());
      setLinkSentTo(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resend(address: string) {
    setResending(true);
    try {
      await requestLink(address, name.trim());
    } catch {
      /* deliberately silent — see the button copy below */
    }
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 6000);
  }

  const inputClass = "field-input !py-3.5";

  if (linkSentTo) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-accent-mint text-on-accent">
            <MailCheck size={28} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="section-label section-label-mint justify-center">
            One click, no password
          </p>
          <h1 className="font-sans text-[30px] sm:text-[36px] font-bold tracking-tight text-text">
            Check your inbox
          </h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-text-muted">
            We sent a sign-in link to{" "}
            <span className="font-semibold text-text">{linkSentTo}</span>.
            Click it and you&apos;re in — nothing to remember, nothing to type.
          </p>
          <div className="soft-card mt-8 text-left">
            <p className="field-label mb-2">WHAT HAPPENS NEXT</p>
            <p className="font-sans text-[14px] leading-relaxed text-text-muted">
              The link signs you in, opens your membership payment page, and
              returns you to a short tour once Stripe confirms the subscription.
            </p>
          </div>
          <div className="mt-7 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void resend(linkSentTo)}
              disabled={resending || resent}
              className="btn-primary disabled:opacity-60"
            >
              {resending
                ? "Sending…"
                : resent
                  ? "Sent — check your inbox"
                  : "Resend the link"}
            </button>
            <p className="font-sans text-[12px] text-text-dim">
              Nothing after a minute? Check spam, then resend.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLinkSentTo(null);
              setEmail("");
            }}
            className="btn-outline mt-5"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/">
            <OutpickWordmark size={28} />
          </Link>
          <p className="font-sans text-[12px] font-bold tracking-[0.14em] uppercase text-text-dim mt-5">
            Sign in or create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2">
              Name <span className="normal-case font-normal text-text-dim">(new accounts only)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="bg-accent-red-soft rounded-soft px-4 py-3">
              <p className="font-sans text-[13px] text-accent-red">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending…" : "Continue with email"}
          </button>

          <p className="text-center font-sans text-[11px] text-text-dim leading-relaxed">
            No password — we&apos;ll email you a one-click sign-in link. By
            continuing, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
