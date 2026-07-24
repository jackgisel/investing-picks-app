"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type EvaluationSummary = {
  id: number;
  mode: string;
  params_version: string;
  executed: boolean;
  created_at: string | null;
  portfolio_snapshot: { cash?: number; equity?: number; position_count?: number };
  signal_count: number;
};

export default function OpsEvaluationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ops-evaluations"],
    queryFn: async () => {
      const res = await fetch("/api/ops/evaluations");
      if (!res.ok) throw new Error("Failed to load evaluations");
      return res.json() as Promise<{ evaluations: EvaluationSummary[] }>;
    },
  });

  const dry = useQuery({
    queryKey: ["ops-dry-run"],
    queryFn: async () => {
      const res = await fetch("/api/ops/dry-run");
      if (!res.ok) throw new Error("Failed to dry-run");
      return res.json();
    },
  });

  return (
    <div className="space-y-10 max-w-4xl">
      <header>
        <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text-dim mb-2">OPS</p>
        <h1 className="font-sans text-3xl font-bold text-text">Decision ledger</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Every buy and sell is recorded with the exact rule checks that fired — not LLM prose.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">NEXT EVAL (DRY-RUN)</h2>
        {dry.isLoading && <p className="text-text-muted text-sm">Computing…</p>}
        {dry.error && <p className="text-accent-red text-sm">Dry-run unavailable (is the API up?)</p>}
        {dry.data && (
          <div className="soft-card p-4 space-y-3">
            <p className="text-sm text-text-muted">
              Params <span className="font-mono text-text">{dry.data.params_version}</span>
              {" · "}
              Equity{" "}
              <span className="font-mono text-text">
                ${Number(dry.data.portfolio?.equity ?? 0).toLocaleString()}
              </span>
              {" · "}
              {dry.data.signals?.length ?? 0} signals
            </p>
            <ul className="space-y-2">
              {(dry.data.signals || []).map((s: { action: string; ticker: string; reason: string }, i: number) => (
                <li key={i} className="text-sm flex gap-3">
                  <span className="font-mono text-accent-green w-28 shrink-0">{s.action}</span>
                  <span className="font-mono text-text w-16">{s.ticker}</span>
                  <span className="text-text-muted">{s.reason}</span>
                </li>
              ))}
              {(dry.data.signals || []).length === 0 && (
                <li className="text-sm text-text-muted">No signals — book is quiet.</li>
              )}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">HISTORY</h2>
        {isLoading && <p className="text-text-muted text-sm">Loading…</p>}
        {error && <p className="text-accent-red text-sm">Could not load evaluations</p>}
        <div className="divide-y divide-border soft-card !p-0 overflow-hidden">
          {(data?.evaluations || []).map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/ops/evaluations/${e.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-bg-secondary transition-colors"
            >
              <div>
                <p className="font-mono text-sm text-text">
                  #{e.id} · {e.mode}
                  {e.executed ? "" : " (dry)"}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : "—"} · params{" "}
                  {e.params_version} · {e.signal_count} signals
                </p>
              </div>
              <span className="text-xs text-text-dim font-mono">
                {e.portfolio_snapshot?.position_count ?? "—"} pos
              </span>
            </Link>
          ))}
          {!isLoading && (data?.evaluations || []).length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">No evaluations yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
