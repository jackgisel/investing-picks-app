"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, FlaskConical, Mail, RefreshCw } from "lucide-react";

type JobRun = {
  id: number;
  job_name: string;
  status: string;
  detail: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type NextEvaluation = {
  /** The nominal evaluation Friday — the date subscribers are shown. */
  target: string;
  /** The session it actually executes on. Earlier than target on a holiday. */
  runs_on: string;
  moved_for_holiday: boolean;
  last_run: { status: string; detail: string | null; started_at: string | null } | null;
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

  const [simulate, setSimulate] = useState(false);

  const dry = useQuery({
    queryKey: ["ops-dry-run", simulate],
    queryFn: async () => {
      const res = await fetch(`/api/ops/dry-run${simulate ? "?simulate=true" : ""}`, {
        cache: "no-store",
      });
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
      return res.json() as Promise<{
        jobs: JobRun[];
        next_evaluation?: NextEvaluation | null;
      }>;
    },
    staleTime: 0,
    gcTime: 0,
    // A refresh takes minutes, so poll while one is in flight and stop as soon
    // as it settles rather than making the operator reload to find out.
    refetchInterval: (query) =>
      query.state.data?.jobs?.some((j) => j.status === "running") ? 5000 : false,
  });

  const running = (jobs.data?.jobs || []).some((j) => j.status === "running");

  const refresh = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/refresh", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || body.error || "Could not start refresh");
      }
      return body;
    },
    onSuccess: () => {
      jobs.refetch();
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label panel-label-coral mb-2">OPS</p>
        <h1 className="page-title">Decision ledger</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Every buy and sell is recorded with the exact rule checks that fired — not LLM prose.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="panel-label panel-label-coral">NEXT EVAL (DRY-RUN)</h2>
          <div className="flex items-center gap-3">
            {dry.dataUpdatedAt > 0 && !dry.isFetching && (
              <span className="font-mono text-xs text-text-dim">
                ran {new Date(dry.dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={() => (simulate ? setSimulate(false) : dry.refetch())}
              disabled={dry.isFetching}
              className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={dry.isFetching ? "animate-spin" : undefined} />
              {dry.isFetching && !simulate ? "Running…" : "Run dry-run"}
            </button>
            <button
              type="button"
              onClick={() => (simulate ? dry.refetch() : setSimulate(true))}
              disabled={dry.isFetching}
              className="btn-outline !py-2 !px-4 !text-[11px] !border-accent-purple !text-accent-purple hover:!bg-accent-purple hover:!text-on-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FlaskConical size={13} />
              {dry.isFetching && simulate ? "Simulating…" : "Simulate"}
            </button>
          </div>
        </div>
        <p className="text-xs text-text-dim max-w-xl">
          Read-only. Computes what the strategy would do against current marks and scores —
          writes nothing to the book or the decision ledger.
        </p>
        {dry.isFetching && !dry.data && <p className="text-text-muted text-sm">Computing…</p>}
        {dry.error && <p className="text-accent-red text-sm">Dry-run unavailable (is the API up?)</p>}
        {dry.data?.simulation?.enabled && (
          <div className="rounded-soft border border-accent-purple/40 bg-accent-purple/5 p-3 space-y-1">
            <p className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-accent-purple">
              Simulation — not a Run 118 decision
            </p>
            <p className="text-xs text-text-muted">
              Re-scored in memory with rules a universe-wide missing factor makes
              unanswerable waived. Every other rule ran unchanged. Nothing was written.
            </p>
            <p className="font-mono text-xs text-text-dim">
              waived: {(dry.data.simulation.waived_rules || []).join(" · ") || "none"}
            </p>
          </div>
        )}
        {dry.data && (
          <div
            className={`data-card space-y-3 transition-opacity ${
              dry.isFetching ? "opacity-50" : "opacity-100"
            } ${dry.data.simulation?.enabled ? "ring-1 ring-accent-purple/30" : ""}`}
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
              entry{" "}
              <span className="font-mono text-text">
                ${Math.round(Number(dry.data.target_notional ?? 0)).toLocaleString()}
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
              {(dry.data.signals || []).length === 0 &&
                (dry.data.universe?.ranked_candidates > 0 ? (
                  <li className="text-sm text-text-muted space-y-1">
                    <span className="block">
                      No signals — book is quiet.{" "}
                      <span className="font-mono text-text-dim">
                        {dry.data.universe.ranked_candidates} candidates scored,{" "}
                        {dry.data.universe.held_with_scores}/
                        {dry.data.portfolio?.position_count ?? 0} holdings have scores
                      </span>
                    </span>
                    {dry.data.universe.passing_revisions_gate === 0 && (
                      <span className="block text-accent-red">
                        0 of {dry.data.universe.ranked_candidates} candidates pass the{" "}
                        {dry.data.universe.revisions_gate} revisions gate — every buy is
                        blocked. Estimate revisions need two fundamentals snapshots
                        spanning the lookback, so this clears once a second snapshot
                        exists.
                      </span>
                    )}
                  </li>
                ) : (
                  <li className="text-sm text-accent-red space-y-1">
                    <span className="block">
                      No signals — the universe is unscored, so the strategy
                      evaluated neither a buy nor a sell.
                    </span>
                    <span className="block text-text-muted">
                      {dry.data.diagnosis?.detail ??
                        "Check that weekly_refresh (universe → fundamentals → score) has run."}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="panel-label panel-label-coral">WORKER JOBS</h2>
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || running}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database size={13} className={running ? "animate-pulse" : undefined} />
            {running ? "Refreshing…" : refresh.isPending ? "Starting…" : "Refresh universe"}
          </button>
        </div>
        <p className="text-xs text-text-dim max-w-xl">
          Runs universe → fundamentals → score → marks against FMP. Takes several
          minutes and writes reference data only — it never touches the book,
          trades, or the decision ledger. Status updates below automatically.
        </p>
        {refresh.error && (
          <p className="text-accent-red text-sm">{(refresh.error as Error).message}</p>
        )}
        {jobs.data?.next_evaluation && (
          <NextEvaluationPanel next={jobs.data.next_evaluation} />
        )}
        {jobs.error && <p className="text-accent-red text-sm">Could not load job history</p>}
        {jobs.data && jobs.data.jobs.length === 0 && (
          <p className="text-sm text-accent-red">
            No job has ever run. The worker is not reaching this database — that
            alone explains an unscored universe.
          </p>
        )}
        <div className="divide-y divide-border data-panel">
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

      <EmailTestPanel />

      <section className="space-y-3">
        <h2 className="panel-label panel-label-coral">HISTORY</h2>
        {isLoading && <p className="text-text-muted text-sm">Loading…</p>}
        {error && <p className="text-accent-red text-sm">Could not load evaluations</p>}
        <div className="divide-y divide-border data-panel">
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

const EMAIL_TEMPLATES = [
  { id: "", label: "All four" },
  { id: "verify", label: "Verify address" },
  { id: "new-pick", label: "New pick" },
  { id: "delete-account", label: "Delete account" },
  { id: "market-note", label: "Market note welcome" },
] as const;

type EmailTestResult = {
  ok: boolean;
  to: string;
  sent: number;
  failed: number;
  results: { template: string; ok: boolean; error?: string; id?: string }[];
};

/**
 * Send a template to your own address to check Resend and the rendering.
 *
 * There is deliberately no recipient field — the API sends to the signed-in
 * admin's address and nowhere else. Subscriber sends go through
 * /api/internal/notify-pick, which is a different route with a different guard.
 */
function EmailTestPanel() {
  const [template, setTemplate] = useState<string>("");

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template ? { template } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Send failed");
      return body as EmailTestResult;
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="panel-label panel-label-coral">EMAIL TEST</h2>
        <div className="flex items-center gap-3">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="bg-bg-secondary border border-border rounded-soft px-3 py-2 font-mono text-[11px] text-text"
          >
            {EMAIL_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail size={13} />
            {send.isPending ? "Sending…" : "Send to me"}
          </button>
        </div>
      </div>
      <p className="text-xs text-text-dim max-w-xl">
        Sends to your own address only — the route takes no recipient. Payloads are
        obvious placeholders (ticker TEST, links that do not resolve), so nothing
        that lands can be mistaken for a real alert.
      </p>
      {send.error && (
        <p className="text-accent-red text-sm">{(send.error as Error).message}</p>
      )}
      {send.data && (
        <div className="data-panel px-4 py-3 space-y-1">
          <p className="text-sm text-text-muted">
            Sent <span className="font-mono text-text">{send.data.sent}</span> to{" "}
            <span className="font-mono text-text">{send.data.to}</span>
            {send.data.failed > 0 && (
              <>
                {" · "}
                <span className="font-mono text-accent-red">
                  {send.data.failed} failed
                </span>
              </>
            )}
          </p>
          {send.data.results.map((r) => (
            <p key={r.template} className="font-mono text-xs text-text-dim break-all">
              {r.template}{" "}
              <span className={r.ok ? "text-accent-green" : "text-accent-red"}>
                {r.ok ? "ok" : (r.error ?? "failed")}
              </span>
              {/* Resend's id. "It said ok and never arrived" is only
                  answerable by looking this up in the Resend dashboard. */}
              {r.id && <span className="text-text-dim"> · {r.id}</span>}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The evaluation cycle, from the operator's side.
 *
 * `target` and `runs_on` are shown separately because they legitimately
 * differ: the scheduler fires every weekday of an evaluation week and runs on
 * the last session on or before the target Friday, so a holiday Friday moves
 * the cycle EARLIER. Showing only the Friday makes a correctly-early run look
 * like a missed cycle, which is the one reading that would prompt a needless
 * manual trigger.
 */
function NextEvaluationPanel({ next }: { next: NextEvaluation }) {
  const last = next.last_run;
  return (
    <div className="data-panel px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="panel-label panel-label-mint">Next evaluation</span>
        <span className="font-mono text-sm text-text">{next.target}</span>
        {next.moved_for_holiday && (
          <span className="font-mono text-xs text-accent-yellow">
            runs {next.runs_on} — target Friday is a market holiday
          </span>
        )}
      </div>
      <p className="text-xs text-text-dim">
        {last
          ? `Last biweekly_evaluate: ${last.status}${
              last.started_at
                ? ` at ${new Date(last.started_at).toLocaleString()}`
                : ""
            }`
          : "biweekly_evaluate has never run."}
      </p>
      {last?.detail && (
        <p className="font-mono text-xs text-text-dim break-all">{last.detail}</p>
      )}
    </div>
  );
}
