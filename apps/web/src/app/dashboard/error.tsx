"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

/**
 * Keeps a render bug inside the page it happened on.
 *
 * There was no boundary here, so one bad row — a ticker-less holding from the
 * anonymised payload — replaced the entire shell, sidebar and all, with
 * "Application error: a client-side exception has occurred". A dashboard that
 * can white-screen on one unexpected field is worse than one that loses a
 * single panel.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render failed:", error);
  }, [error]);

  return (
    <div className="space-y-5">
      <h1 className="page-title">Something went wrong</h1>
      <div className="data-card flex flex-col items-start gap-3 py-8">
        <p className="panel-label">Render error</p>
        <p className="max-w-[520px] font-sans text-[14px] leading-relaxed text-text-muted">
          This page failed to render. Your data is unaffected — the rest of the
          dashboard still works, and reloading usually clears it.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-text-dim">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="btn-outline mt-1 !px-5 !py-2 !text-[11px]"
        >
          <RotateCw size={12} />
          Try again
        </button>
      </div>
    </div>
  );
}
