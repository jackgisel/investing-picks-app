"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { signIn } from "@/lib/auth-client";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { resolveCallbackPath } from "@/lib/login-redirect";
import { LOGIN_ART } from "@/lib/art";

/** Where the magic link should land after it verifies. */
function resolveCallbackURL(): string {
  if (typeof window === "undefined") return "/subscribe";
  return resolveCallbackPath(
    new URLSearchParams(window.location.search).get("next"),
  );
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[calc(100dvh-72px)] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src={LOGIN_ART.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/85 via-bg/75 to-bg/90 dark:from-bg/90 dark:via-bg/80 dark:to-bg/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/40" />
      </div>
      <div className="relative flex min-h-[calc(100dvh-72px)] items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
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
      <LoginShell>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-accent-mint text-on-accent">
            <MailCheck size={28} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="section-label justify-center">
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
          <div className="soft-card mt-8 text-left bg-bg/80 backdrop-blur-sm">
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
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/">
            <OutpickWordmark size={28} />
          </Link>
          <p className="font-sans text-[12px] font-bold tracking-[0.14em] uppercase text-text-dim mt-5">
            Sign in or create your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-soft bg-bg/80 p-6 backdrop-blur-sm sm:p-7"
        >
          <div>
            <label
              htmlFor="login-name"
              className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2"
            >
              Name <span className="normal-case font-normal text-text-dim">(new accounts only)</span>
            </label>
            <input
              id="login-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor="login-email"
              className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2"
            >
              Email
            </label>
            <input
              id="login-email"
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
    </LoginShell>
  );
}
