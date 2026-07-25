"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One-time admin bootstrap.
 *
 * Deliberately NOT under /dashboard/ops — that route is admin-gated, so
 * claiming admin from inside it would be a chicken-and-egg. This page only
 * requires a session (enforced by middleware).
 */
export default function ClaimAdminPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error" | "done">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);
    try {
      const res = await fetch("/api/admin/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Claim rejected");
        setStatus("error");
        return;
      }
      setStatus("done");
      router.refresh();
    } catch {
      setError("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <header>
        <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text-dim mb-2">
          Bootstrap
        </p>
        <h1 className="font-sans text-3xl font-bold text-text">Claim admin</h1>
        <p className="text-text-muted mt-2 text-sm">
          Enter the <code className="font-mono text-xs">ADMIN_BOOTSTRAP_TOKEN</code>{" "}
          from the deployment environment. Your account must also be on the{" "}
          <code className="font-mono text-xs">ADMIN_EMAILS</code> allowlist.
        </p>
      </header>

      {status === "done" ? (
        <div className="soft-card p-6 space-y-4">
          <p className="text-accent-green font-sans font-bold">
            Admin granted.
          </p>
          <p className="text-text-muted text-sm">
            You can now reach the ops surface.
          </p>
          <a href="/dashboard/ops" className="btn-primary inline-block">
            Go to ops
          </a>
        </div>
      ) : (
        <form onSubmit={submit} className="soft-card p-6 space-y-4">
          <label className="block">
            <span className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text-dim">
              Bootstrap token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              className="mt-2 w-full bg-transparent border border-white/15 px-3 py-2 font-mono text-sm text-text focus:outline-none focus:border-accent-green"
              placeholder="paste token"
            />
          </label>

          {error && (
            <p className="text-accent-red font-mono text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={!token.trim() || status === "working"}
            className="btn-primary disabled:opacity-40"
          >
            {status === "working" ? "Claiming…" : "Claim admin"}
          </button>
        </form>
      )}
    </div>
  );
}
