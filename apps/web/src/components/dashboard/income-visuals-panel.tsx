"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Send } from "lucide-react";
import { incomeVisualUrl } from "@/lib/income-visual/url";
import type { PeriodType } from "@/lib/income-visual/model";
import { communicationHref } from "@/lib/communication";

/**
 * Preview and queue the earnings cards.
 *
 * The worker drafts a sankey or a pie when a theme-list company reports.
 * This page is for looking at them first, pulling any other ticker, and
 * queueing one by hand. Holdings preview here too but cannot be queued.
 */

type Item = {
  ticker: string;
  name: string | null;
  sector: string | null;
  market_cap: number | null;
  period: string;
  fiscal_label: string;
  accepted_date: string | null;
  revenue: number | null;
  held: boolean;
};

type Payload = {
  recent: Item[];
  held: Item[];
  days: number;
  config: { autoPost: boolean; reviewHours: number; perDay: number };
  xConfigured: boolean;
};

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Request failed (${res.status})`;
}

const QUERY_KEY = ["ops-income-visuals"];

async function fetchPayload(): Promise<Payload> {
  const res = await fetch("/api/ops/income-visuals", { cache: "no-store" });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export function IncomeVisualsPanel() {
  const qc = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [selected, setSelected] = useState<{ ticker: string; held: boolean } | null>(null);
  const [period, setPeriod] = useState<PeriodType>("quarter");
  const [version, setVersion] = useState(0);
  const [queued, setQueued] = useState<string | null>(null);

  const page = useQuery({ queryKey: QUERY_KEY, queryFn: fetchPayload });

  const load = useMutation({
    mutationFn: async (t: string) => {
      const res = await fetch("/api/ops/income-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as { ticker: string };
    },
    onSuccess: async ({ ticker: t }) => {
      const data = await qc.fetchQuery({ queryKey: QUERY_KEY, queryFn: fetchPayload, staleTime: 0 });
      setSelected({ ticker: t, held: data.held.some((h) => h.ticker === t) });
      setVersion((v) => v + 1);
      setQueued(null);
    },
  });

  const queue = useMutation({
    mutationFn: async (args: { ticker: string; period_type: PeriodType }) => {
      const res = await fetch("/api/ops/income-visuals/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as { created: boolean };
    },
    onSuccess: (r) =>
      setQueued(r.created ? "Queued in X Threads." : "Already in the X queue."),
  });

  const data = page.data;
  const select = (item: Item) => {
    setSelected({ ticker: item.ticker, held: item.held });
    setQueued(null);
    queue.reset();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label mb-2">Income visuals</p>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Income statements drawn as flows, square for X. Every 15 minutes on
          weekdays the worker checks the earnings calendar. A print is drafted
          only when the company is on the theme list (platforms, semiconductors,
          AI infrastructure, energy and power). Holdings are never posted.
        </p>
      </header>

      <section className="data-card flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="panel-label">Auto-post</p>
          {data ? (
            <>
              <p className="font-mono text-sm text-text">
                {data.config.autoPost
                  ? `On: posts ${data.config.reviewHours}h after drafting, one per hourly tick`
                  : "Off: drafts wait for Confirm"}
              </p>
              <p className="font-mono text-xs text-text-muted">
                Up to {data.config.perDay} theme-list names a day; a bigger print
                replaces the smallest unposted draft.{" "}
                {data.xConfigured ? "X credentials configured." : "No X credentials on this deployment."}
              </p>
              <p className="font-sans text-xs text-text-dim">
                Reject a draft in{" "}
                <a className="underline underline-offset-2" href={communicationHref("x")}>
                  X Threads
                </a>{" "}
                to stop it.
              </p>
            </>
          ) : (
            <p className="font-mono text-xs text-text-muted"> </p>
          )}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = ticker.trim().toUpperCase();
            if (t) load.mutate(t);
          }}
        >
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ticker"
            aria-label="Ticker"
            maxLength={10}
            className="w-28 rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus:border-border-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={load.isPending || !ticker.trim()}
            className="btn-outline !px-4 !py-2 !text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={13} className={load.isPending ? "animate-spin" : undefined} />
            Load from FMP
          </button>
        </form>
      </section>

      {(page.error || load.error) && (
        <p className="text-sm text-accent-red">
          {((page.error ?? load.error) as Error).message}
        </p>
      )}

      {selected && (
        <section className="data-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="font-mono text-lg font-semibold text-text">{selected.ticker}</p>
              {selected.held && <span className="badge badge-buy !text-[9px]">Holding</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PeriodToggle value={period} onChange={setPeriod} />
              <a
                href={incomeVisualUrl(selected.ticker, period, version)}
                download={`${selected.ticker}-${period}-income.png`}
                className="btn-outline !px-4 !py-2 !text-[11px]"
              >
                <Download size={13} /> PNG
              </a>
              <button
                type="button"
                disabled={selected.held || queue.isPending}
                title={selected.held ? "Holdings are never posted" : undefined}
                onClick={() => queue.mutate({ ticker: selected.ticker, period_type: period })}
                className="btn-outline !px-4 !py-2 !text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={13} /> Queue for X
              </button>
            </div>
          </div>
          {queue.error && (
            <p className="text-sm text-accent-red">{(queue.error as Error).message}</p>
          )}
          {queued && (
            <p className="text-sm text-text-muted">
              {queued}{" "}
              <a className="underline underline-offset-2" href={communicationHref("x")}>
                Review it
              </a>
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${selected.ticker}-${period}-${version}`}
            src={incomeVisualUrl(selected.ticker, period, version)}
            alt={`${selected.ticker} income statement flow`}
            width={1080}
            height={1080}
            className="mx-auto aspect-square w-full max-w-[640px] rounded-xl border border-border bg-bg"
          />
        </section>
      )}

      <Gallery
        title={`Reported in the last ${data?.days ?? 7} days`}
        empty="No stored filings this week yet. They appear as companies report, or load a ticker above."
        items={data?.recent ?? []}
        onSelect={select}
        selected={selected?.ticker}
      />
      <Gallery
        title="Holdings (in-app only)"
        empty="No holdings have a stored statement yet."
        items={data?.held ?? []}
        onSelect={select}
        selected={selected?.ticker}
      />
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: PeriodType;
  onChange: (v: PeriodType) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border p-0.5" role="group" aria-label="Period">
      {(["quarter", "annual"] as const).map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={`rounded-[10px] px-3 py-1.5 font-mono text-[11px] ${
            value === p ? "bg-bg-tertiary text-text" : "text-text-dim hover:text-text"
          }`}
        >
          {p === "quarter" ? "Quarter" : "Fiscal year"}
        </button>
      ))}
    </div>
  );
}

function Gallery({
  title,
  empty,
  items,
  onSelect,
  selected,
}: {
  title: string;
  empty: string;
  items: Item[];
  onSelect: (item: Item) => void;
  selected?: string;
}) {
  return (
    <section className="space-y-3">
      <p className="panel-label">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.ticker}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                aria-pressed={selected === item.ticker}
                className={`group w-full overflow-hidden rounded-xl border text-left transition-colors ${
                  selected === item.ticker ? "border-border-strong" : "border-border hover:border-border-light"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={incomeVisualUrl(item.ticker)}
                  alt=""
                  loading="lazy"
                  width={1080}
                  height={1080}
                  className="aspect-square w-full bg-bg"
                />
                <div className="flex items-baseline justify-between gap-2 px-3 py-2">
                  <span className="font-mono text-[13px] font-semibold text-text">{item.ticker}</span>
                  <span className="font-mono text-[10px] text-text-dim">
                    {item.fiscal_label}
                    {item.accepted_date ? ` · ${item.accepted_date.slice(5)}` : ""}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
