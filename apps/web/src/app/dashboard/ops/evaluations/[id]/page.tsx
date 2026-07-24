"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";

export default function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["ops-evaluation", id],
    queryFn: async () => {
      const res = await fetch(`/api/ops/evaluations/${id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <p className="text-text-muted text-sm">Loading…</p>;
  if (error || !data) return <p className="text-accent-red text-sm">Not found</p>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <Link href="/dashboard/ops" className="text-xs text-text-dim hover:text-text">
          ← Ledger
        </Link>
        <h1 className="font-sans text-3xl font-bold text-text mt-2">
          Evaluation #{data.id}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {data.mode} · params {data.params_version} ·{" "}
          {data.executed ? "executed" : "dry-run"}
        </p>
      </div>

      <div className="space-y-6">
        {(data.signals || []).map(
          (s: {
            id: number;
            ticker: string;
            action: string;
            reason: string;
            rules: {
              rule_id: string;
              passed: boolean;
              inputs: Record<string, unknown>;
              threshold: Record<string, unknown>;
              message?: string;
            }[];
          }) => (
            <article key={s.id} className="soft-card !p-4 space-y-3">
              <div className="flex gap-3 items-baseline">
                <span className="font-mono text-accent-green text-sm">{s.action}</span>
                <span className="font-mono text-lg text-text">{s.ticker}</span>
              </div>
              <p className="text-sm text-text-muted">{s.reason}</p>
              <div className="space-y-1">
                <p className="font-mono text-[10px] tracking-[1px] text-text-dim">RULE CHECKS</p>
                {(s.rules || []).map((r, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono flex flex-wrap gap-x-3 gap-y-1 py-1 border-t border-border/50"
                  >
                    <span className={r.passed ? "text-accent-green" : "text-text-dim"}>
                      {r.passed ? "PASS" : "FAIL"}
                    </span>
                    <span className="text-text">{r.rule_id}</span>
                    <span className="text-text-muted">
                      in={JSON.stringify(r.inputs)} thr={JSON.stringify(r.threshold)}
                    </span>
                    {r.message && <span className="text-text-dim w-full">{r.message}</span>}
                  </div>
                ))}
              </div>
            </article>
          )
        )}
      </div>
    </div>
  );
}
