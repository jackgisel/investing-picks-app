"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        const result = await signUp.email({ email, password, name });
        if (result.error) {
          setError(result.error.message || "Could not create account");
          setLoading(false);
          return;
        }
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/">
            <OutpickWordmark size={28} />
          </Link>
          <p className="font-mono text-[11px] text-text-dim tracking-[2px] mt-4">
            {mode === "login" ? "SIGN IN TO YOUR ACCOUNT" : "CREATE YOUR ACCOUNT"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border border-border mb-6">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 font-mono text-[11px] py-3 tracking-wider transition-colors ${
              mode === "login"
                ? "bg-bg-tertiary text-text"
                : "text-text-dim hover:text-text-muted"
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 font-mono text-[11px] py-3 tracking-wider transition-colors border-l border-border ${
              mode === "signup"
                ? "bg-bg-tertiary text-text"
                : "text-text-dim hover:text-text-muted"
            }`}
          >
            SIGN UP
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="font-mono text-[10px] text-text-dim tracking-[1.5px] block mb-2">
                NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === "signup"}
                className="w-full bg-bg-secondary border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="font-mono text-[10px] text-text-dim tracking-[1.5px] block mb-2">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-secondary border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] text-text-dim tracking-[1.5px] block mb-2">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-bg-secondary border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          {error && (
            <div className="bg-accent-red-soft border border-accent-red/30 px-4 py-3">
              <p className="font-sans text-[13px] text-accent-red">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono text-[12px] bg-accent-green text-black py-3.5 font-semibold tracking-wider hover:bg-accent-green-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "LOADING..."
              : mode === "login"
                ? "SIGN IN"
                : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className="text-center font-sans text-[12px] text-text-dim mt-6">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="text-accent-green hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="text-accent-green hover:underline"
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
