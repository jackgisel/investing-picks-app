"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { insightForTicker, type InsightMeta } from "@/lib/insights";
import { formatWeekdayDate } from "@/lib/portfolio";

type RuleCheck = {
  rule_id: string;
  passed: boolean;
  inputs: Record<string, unknown>;
  threshold: Record<string, unknown>;
  message: string;
};

type Score = {
  ticker: string;
  quant_rating: number;
  valuation_grade: string;
  growth_grade: string;
  profitability_grade: string;
  momentum_grade: string;
  revisions_grade: string;
  sector: string | null;
};

type Candidate = {
  ticker: string;
  rank: number;
  name: string | null;
  held: boolean;
  criteria_ok: boolean;
  criteria: RuleCheck[];
  status: "selected" | "blocked" | "near_miss";
  blocked_by: string | null;
  message: string;
  action: string | null;
  score: Score;
};

type EnginePick = {
  ticker: string;
  action: string;
  reason: string;
  score: Score | null;
  rules: RuleCheck[];
};

type LastBuy = {
  ticker: string;
  action: string;
  reason: string | null;
  evaluation_id: number | null;
  executed_at: string | null;
  source: string;
};

type BuyQueue = {
  params_version: string;
  target_notional: number;
  next_evaluation: {
    target: string;
    runs_on: string;
    moved_for_holiday: boolean;
  } | null;
  portfolio: { cash: number; equity: number; position_count: number };
  engine_pick: EnginePick | null;
  last_buy: LastBuy | null;
  drawdown_halted: boolean;
  candidates: Candidate[];
};

const BLOCKED_LABEL: Record<string, string> = {
  max_adds: "One add taken",
  sector_cap: "Sector cap",
  no_slot: "No slot",
  insufficient_cash: "Cash",
  already_held: "Already held",
  conviction_add_gain: "Held",
  already_trimmed: "Trimmed",
  drawdown: "Drawdown",
  criteria: "Fails a gate",
  not_selected: "Not selected",
};

function statusLabel(row: Candidate): string {
  if (row.status === "selected") return "Engine pick";
  if (row.blocked_by && BLOCKED_LABEL[row.blocked_by]) {
    return BLOCKED_LABEL[row.blocked_by];
  }
  return row.status === "near_miss" ? "Near miss" : "Blocked";
}

function statusClass(status: Candidate["status"]): string {
  if (status === "selected") return "text-accent-green";
  if (status === "near_miss") return "text-accent-yellow";
  return "text-text-muted";
}

function qr(n: number): string {
  return n.toFixed(1);
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail ?? body?.error;
    if (typeof detail === "string") return detail;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

export default function OpsFridayBuyPage() {
  const [inspected, setInspected] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ["ops-buy-queue"],
    queryFn: async () => {
      const res = await fetch("/api/ops/buy-queue", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<BuyQueue>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const notes = useQuery({
    queryKey: ["ops-insights"],
    queryFn: async () => {
      const res = await fetch("/api/ops/insights", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ insights: InsightMeta[] }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const data = queue.data;
  const engineTicker = data?.engine_pick?.ticker ?? null;
  const inQueue = (ticker: string | null) =>
    Boolean(ticker && data?.candidates.some((c) => c.ticker === ticker));
  const activeTicker = inQueue(inspected)
    ? inspected
    : inQueue(engineTicker)
      ? engineTicker
      : (data?.candidates[0]?.ticker ?? null);
  const active = data?.candidates.find((c) => c.ticker === activeTicker);
  const lastNote = insightForTicker(notes.data?.insights ?? [], data?.last_buy?.ticker);

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label mb-2">OPS</p>
        <h1 className="page-title">Friday buy</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Ranked names the engine would consider this cycle. The default is the
          top pick. Click another row to inspect it. Live Friday still buys the
          engine pick.
        </p>
      </header>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-text-dim">
          {data
            ? `Params ${data.params_version} · ${data.portfolio.position_count} positions · entry $${Math.round(data.target_notional).toLocaleString()}`
            : " "}
        </p>
        <button
          type="button"
          onClick={() => queue.refetch()}
          disabled={queue.isFetching}
          className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={13} className={queue.isFetching ? "animate-spin" : undefined} />
          {queue.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {queue.error && (
        <p className="text-accent-red text-sm">{(queue.error as Error).message}</p>
      )}
      {queue.isFetching && !data && (
        <p className="text-text-muted text-sm">Computing the queue…</p>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <LastBuyCard last={data.last_buy} note={lastNote} />
            <NextEvalCard data={data} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className="space-y-3 min-w-0">
              <h2 className="panel-label">RANKED QUEUE</h2>
              {data.candidates.length === 0 ? (
                <p className="text-sm text-text-muted data-card">
                  No scored names to rank. Score the universe first.
                </p>
              ) : (
                <div className="divide-y divide-border data-panel">
                  {data.candidates.map((row) => {
                    const on = row.ticker === activeTicker;
                    return (
                      <button
                        key={row.ticker}
                        type="button"
                        onClick={() => setInspected(row.ticker)}
                        aria-pressed={on}
                        className={`w-full text-left px-4 py-3 hover:bg-bg-tertiary/60 transition-colors ${
                          on ? "bg-bg-tertiary" : ""
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-baseline gap-3 min-w-0">
                            <span className="font-mono text-xs text-text-dim w-6 shrink-0">
                              {row.rank}
                            </span>
                            <span className="font-mono text-sm text-text">
                              {row.ticker}
                            </span>
                            {row.held && (
                              <span className="text-[10px] uppercase tracking-[0.12em] text-text-dim">
                                held
                              </span>
                            )}
                            <span className="font-mono text-sm text-text-muted">
                              {qr(row.score.quant_rating)}
                            </span>
                          </div>
                          <span className={`font-mono text-xs shrink-0 ${statusClass(row.status)}`}>
                            {statusLabel(row)}
                          </span>
                        </div>
                        <p className="pl-9 mt-1 font-mono text-[11px] text-text-dim truncate">
                          Rev {row.score.revisions_grade} · Gro {row.score.growth_grade} · Prf{" "}
                          {row.score.profitability_grade} · Val {row.score.valuation_grade} · Mom{" "}
                          {row.score.momentum_grade}
                          {row.score.sector ? ` · ${row.score.sector}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3 min-w-0">
              <h2 className="panel-label">SUPPORTING DATA</h2>
              {active ? (
                <CandidateDetail
                  row={active}
                  engineTicker={engineTicker}
                  engineRules={
                    active.ticker === engineTicker ? data.engine_pick?.rules ?? [] : []
                  }
                />
              ) : (
                <p className="text-sm text-text-muted data-card">
                  Nothing to inspect. If the universe is scored, a name should
                  appear in the queue even when no buy clears.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function LastBuyCard({
  last,
  note,
}: {
  last: LastBuy | null;
  note: InsightMeta | undefined;
}) {
  return (
    <div className="data-card space-y-2">
      <p className="panel-label">Last live buy</p>
      {last ? (
        <>
          <p className="font-mono text-lg text-text">{last.ticker}</p>
          <p className="text-sm text-text-muted">
            {last.action}
            {last.executed_at
              ? ` · ${new Date(last.executed_at).toLocaleDateString()}`
              : ""}
            {last.evaluation_id ? (
              <>
                {" · "}
                <Link
                  href={`/dashboard/ops/evaluations/${last.evaluation_id}`}
                  className="text-text hover:text-text-muted"
                >
                  eval #{last.evaluation_id}
                </Link>
              </>
            ) : null}
          </p>
          {last.reason && (
            <p className="text-xs text-text-dim">{last.reason}</p>
          )}
          <p className="text-xs text-text-muted">
            {note ? (
              <>
                Research note:{" "}
                <Link
                  href="/dashboard/ops/insights"
                  className="text-text hover:text-text-muted"
                >
                  {note.status}
                </Link>
              </>
            ) : (
              "No research note yet."
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          No executed buy in the ledger. The book may still be empty, or every
          holding was a manual entry without a buy signal.
        </p>
      )}
    </div>
  );
}

function NextEvalCard({ data }: { data: BuyQueue }) {
  const pick = data.engine_pick;
  const next = data.next_evaluation;
  const when = next
    ? next.moved_for_holiday
      ? `Runs ${formatWeekdayDate(next.runs_on)} (Friday ${formatWeekdayDate(next.target)} is a holiday)`
      : formatWeekdayDate(next.target)
    : null;
  return (
    <div className="data-card space-y-2">
      <p className="panel-label">Next eval</p>
      {pick ? (
        <>
          <p className="font-mono text-lg text-text">{pick.ticker}</p>
          <p className="text-sm text-text-muted">{pick.action}</p>
          <p className="text-xs text-text-dim">{pick.reason}</p>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          {data.drawdown_halted
            ? "Buys are halted by the drawdown circuit breaker."
            : "Nothing clears the gates this cycle. The engine will not invent a ticker."}
        </p>
      )}
      {when && <p className="text-xs text-text-dim">{when}</p>}
    </div>
  );
}

function CandidateDetail({
  row,
  engineTicker,
  engineRules,
}: {
  row: Candidate;
  engineTicker: string | null;
  engineRules: RuleCheck[];
}) {
  const rules = engineRules.length > 0 ? engineRules : row.criteria;
  return (
    <div className="data-card space-y-3">
      <div>
        <p className="font-mono text-lg text-text">{row.ticker}</p>
        {row.name && <p className="text-sm text-text-muted">{row.name}</p>}
      </div>
      <p className={`text-sm ${statusClass(row.status)}`}>{statusLabel(row)}</p>
      {row.message && <p className="text-sm text-text-muted">{row.message}</p>}
      {row.ticker !== engineTicker && engineTicker && (
        <p className="text-xs text-text-dim">
          Engine pick remains {engineTicker}. Inspecting this row does not
          change Friday.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">QR</dt>
          <dd className="font-mono text-text">{qr(row.score.quant_rating)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Held</dt>
          <dd className="text-text">{row.held ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Rev</dt>
          <dd className="font-mono text-text">{row.score.revisions_grade}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Gro</dt>
          <dd className="font-mono text-text">{row.score.growth_grade}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Prf</dt>
          <dd className="font-mono text-text">{row.score.profitability_grade}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Val</dt>
          <dd className="font-mono text-text">{row.score.valuation_grade}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Mom</dt>
          <dd className="font-mono text-text">{row.score.momentum_grade}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-text-dim">Sector</dt>
          <dd className="text-text">{row.score.sector ?? "—"}</dd>
        </div>
      </dl>
      <div className="space-y-1">
        <p className="font-mono text-[10px] tracking-[1px] text-text-dim">RULE CHECKS</p>
        {rules.map((r, i) => (
          <div
            key={`${r.rule_id}-${i}`}
            className="text-xs font-mono flex flex-wrap gap-x-3 gap-y-1 py-1 border-t border-border/50"
          >
            <span className={r.passed ? "text-accent-green" : "text-accent-red"}>
              {r.passed ? "PASS" : "FAIL"}
            </span>
            <span className="text-text">{r.rule_id}</span>
            {r.message && <span className="text-text-dim w-full">{r.message}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
