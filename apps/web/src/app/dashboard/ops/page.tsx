"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

type JobRun = {
  id: number;
  job_name: string;
  status: string;
  detail: string | null;
  started_at: string | null;
  finished_at: string | null;
};

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
      const res = await fetch("/api/ops/dry-run", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to dry-run");
      return res.json();
    },
    // Never serve this from cache. The point of the button is to see what the
    // strategy decides against *current* marks and scores.
    staleTime: 0,
    gcTime: 0,
  });

  const jobs = useQuery({
    queryKey: ["ops-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/ops/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json() as Promise<{ jobs: JobRun[] }>;
    },
    staleTime: 0,
    gcTime: 0,
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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">NEXT EVAL (DRY-RUN)</h2>
          <div className="flex items-center gap-3">
            {dry.dataUpdatedAt > 0 && !dry.isFetching && (
              <span className="font-mono text-xs text-text-dim">
                ran {new Date(dry.dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={() => dry.refetch()}
              disabled={dry.isFetching}
              className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={dry.isFetching ? "animate-spin" : undefined} />
              {dry.isFetching ? "Running…" : "Run dry-run"}
            </button>
          </div>
        </div>
        <p className="text-xs text-text-dim max-w-xl">
          Read-only. Computes what the strategy would do against current marks and scores —
          writes nothing to the book or the decision ledger.
        </p>
        {dry.isFetching && !dry.data && <p className="text-text-muted text-sm">Computing…</p>}
        {dry.error && <p className="text-accent-red text-sm">Dry-run unavailable (is the API up?)</p>}
        {dry.data && (
          <div
            className={`soft-card p-4 space-y-3 transition-opacity ${
              dry.isFetching ? "opacity-50" : "opacity-100"
            }`}
          >
            <p className="text-sm text-text-muted">
              Params <span className="font-mono text-text">{dry.data.params_version}</span>
              {" · "}
              Equity{" "}
              <span className="font-mono text-text">
                ${Number(dry.data.portfolio?.equity ?? 0).toLocaleString()}
              </span>
              {" · "}
              <span className="font-mono text-text">
                {dry.data.portfolio?.position_count ?? 0}
              </span>{" "}
              positions
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
              {(dry.data.signals || []).length === 0 &&
                (dry.data.universe?.ranked_candidates > 0 ? (
                  <li className="text-sm text-text-muted">
                    No signals — book is quiet.{" "}
                    <span className="font-mono text-text-dim">
                      {dry.data.universe.ranked_candidates} candidates scored,{" "}
                      {dry.data.universe.held_with_scores}/
                      {dry.data.portfolio?.position_count ?? 0} holdings have scores
                    </span>
                  </li>
                ) : (
                  <li className="text-sm text-accent-red">
                    No signals because the universe is unscored — 0 candidates. The
                    strategy could not evaluate a single buy or sell. Check that
                    weekly_refresh (universe → fundamentals → score) has run.
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">WORKER JOBS</h2>
        {jobs.error && <p className="text-accent-red text-sm">Could not load job history</p>}
        {jobs.data && jobs.data.jobs.length === 0 && (
          <p className="text-sm text-accent-red">
            No job has ever run. The worker is not reaching this database — that
            alone explains an unscored universe.
          </p>
        )}
        <div className="divide-y divide-border soft-card !p-0 overflow-hidden">
          {(jobs.data?.jobs || []).map((j) => (
            <div key={j.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-sm text-text">{j.job_name}</p>
                <span
                  className={`font-mono text-xs ${
                    j.status === "ok"
                      ? "text-accent-green"
                      : j.status === "running"
                        ? "text-text-dim"
                        : "text-accent-red"
                  }`}
                >
                  {j.status}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {j.started_at ? new Date(j.started_at).toLocaleString() : "—"}
              </p>
              {j.detail && (
                <p className="font-mono text-xs text-text-dim mt-1 break-all">{j.detail}</p>
              )}
            </div>
          ))}
        </div>
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
