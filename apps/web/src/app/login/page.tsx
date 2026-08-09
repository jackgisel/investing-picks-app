"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || "Invalid credentials");
          setLoading(false);
          return;
        }
      } else {
        const result = await signUp.email({
          email,
          password,
          name,
          // Better Auth embeds this trusted relative path in the verification
          // link. Verification auto-signs the new user in, then continues to
          // Outpick's account-first membership flow.
          callbackURL: "/subscribe",
        });
        if (result.error) {
          setError(result.error.message || "Could not create account");
          setLoading(false);
          return;
        }
        setVerificationSentTo(email.trim());
        setLoading(false);
        return;
      }
      const requested = new URLSearchParams(window.location.search).get("next");
      router.push(
        requested === "/subscribe" || requested === "/welcome"
          ? requested
          : "/dashboard",
      );
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-bg-secondary border border-border rounded-pill px-5 py-3.5 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";

  if (verificationSentTo) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-accent-mint text-on-accent">
            <MailCheck size={28} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="section-label section-label-mint justify-center">
            One quick check
          </p>
          <h1 className="font-sans text-[30px] sm:text-[36px] font-bold tracking-tight text-text">
            Check your inbox
          </h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-text-muted">
            We sent a welcome and verification link to{" "}
            <span className="font-semibold text-text">{verificationSentTo}</span>.
            Verify that address and we&apos;ll take you directly to secure checkout.
          </p>
          <div className="soft-card mt-8 text-left">
            <p className="field-label mb-2">WHAT HAPPENS NEXT</p>
            <p className="font-sans text-[14px] leading-relaxed text-text-muted">
              The link signs you in, opens your membership payment page, and
              returns you to a short tour once Stripe confirms the subscription.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVerificationSentTo(null);
              setEmail("");
            }}
            className="btn-outline mt-7"
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
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <div className="flex soft-card !p-1 mb-6 gap-1">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 font-sans text-[11px] py-2.5 tracking-[0.1em] uppercase font-bold rounded-pill transition-colors ${
              mode === "login"
                ? "bg-inverse text-inverse-fg"
                : "text-text-dim hover:text-text"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`flex-1 font-sans text-[11px] py-2.5 tracking-[0.1em] uppercase font-bold rounded-pill transition-colors ${
              mode === "signup"
                ? "bg-inverse text-inverse-fg"
                : "text-text-dim hover:text-text"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === "signup"}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
          )}

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
            />
          </div>

          <div>
            <label className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
              placeholder="Min. 8 characters"
            />
          </div>

          {error && (
            <div className="bg-accent-red-soft rounded-2xl px-4 py-3">
              <p className="font-sans text-[13px] text-accent-red">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Loading..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="text-center font-sans text-[13px] text-text-dim mt-6">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                className="text-text font-semibold underline underline-offset-2"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="text-text font-semibold underline underline-offset-2"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
