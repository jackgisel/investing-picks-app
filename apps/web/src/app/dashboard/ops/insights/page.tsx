"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Send, Sparkles } from "lucide-react";
import type { Insight, InsightMeta, InsightStatus } from "@/lib/insights";

const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 font-sans text-sm text-text " +
  "placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";
const labelClass = "block field-label mb-1.5";

const STATUS_TONE: Record<InsightStatus, string> = {
  pending: "text-text-dim",
  draft: "text-accent-yellow",
  failed: "text-accent-red",
  approved: "text-accent-green",
};

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail ?? body?.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

type AnnounceResult = {
  sent: number;
  failed: number;
  total: number;
  errors: { email: string; error: string }[];
};

export default function OpsInsightsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sent, setSent] = useState<AnnounceResult | null>(null);

  const list = useQuery({
    queryKey: ["ops-insights"],
    queryFn: async () => {
      const res = await fetch("/api/ops/insights", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ insights: InsightMeta[] }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/insights", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-insights"] }),
  });

  const insights = list.data?.insights ?? [];
  const queue = insights.filter((i) => i.status !== "approved");
  const published = insights.filter((i) => i.status === "approved");

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label panel-label-lilac mb-2">OPS</p>
        <h1 className="page-title">Research notes</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Every pick gets a drafted note. Nothing reaches a subscriber until you
          approve it — and approving also emails the list, once.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="panel-label panel-label-lilac">
            AWAITING REVIEW ({queue.length})
          </h2>
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={13}
              className={sync.isPending ? "animate-spin" : undefined}
            />
            {sync.isPending ? "Drafting…" : "Sync drafts"}
          </button>
        </div>
        <p className="text-xs text-text-dim max-w-xl">
          Sync opens a note for any open pick that has none and drafts the ones
          still empty. It runs on a schedule too; this is for when you have just
          added a position and do not want to wait.
        </p>

        {list.error && (
          <p className="text-accent-red text-sm">
            {(list.error as Error).message}
          </p>
        )}
        {sync.error && (
          <p className="text-accent-red text-sm">
            {(sync.error as Error).message}
          </p>
        )}

        {queue.length === 0 && !list.isPending && (
          <div className="data-panel px-4 py-6">
            <p className="text-sm text-text-muted">
              Nothing waiting. Every open pick has an approved note.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {queue.map((meta) =>
            editingId === meta.id ? (
              <Editor
                key={meta.id}
                id={meta.id}
                onClose={() => setEditingId(null)}
                onSent={setSent}
              />
            ) : (
              <Row
                key={meta.id}
                meta={meta}
                onEdit={() => setEditingId(meta.id)}
              />
            ),
          )}
        </div>
      </section>

      {sent && (
        <section className="space-y-2">
          <h2 className="panel-label panel-label-mint">LAST ANNOUNCEMENT</h2>
          <div className="data-panel px-4 py-3 space-y-1">
            <p className="text-sm text-text-muted">
              Emailed <span className="font-mono text-text">{sent.sent}</span> of{" "}
              <span className="font-mono text-text">{sent.total}</span>{" "}
              subscribers
              {sent.failed > 0 && (
                <>
                  {" · "}
                  <span className="font-mono text-accent-red">
                    {sent.failed} failed
                  </span>
                </>
              )}
            </p>
            {sent.errors.map((e) => (
              <p key={e.email} className="font-mono text-xs text-accent-red">
                {e.email} — {e.error}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="panel-label panel-label-coral">
          PUBLISHED ({published.length})
        </h2>
        <div className="divide-y divide-border data-panel">
          {published.map((meta) => (
            <div
              key={meta.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-text">
                  {meta.ticker ?? "—"}
                </p>
                <p className="truncate text-xs text-text-muted mt-0.5">
                  {meta.title}
                </p>
              </div>
              <Link
                href={`/dashboard/insights/${meta.slug}`}
                className="shrink-0 flex items-center gap-1 font-mono text-[10px] text-text-dim hover:text-text"
              >
                VIEW <ExternalLink size={10} />
              </Link>
            </div>
          ))}
          {published.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">
              Nothing published yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ meta, onEdit }: { meta: InsightMeta; onEdit: () => void }) {
  return (
    <div className="data-card flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-text">
            {meta.ticker ?? "—"}
          </span>
          <span
            className={`font-mono text-xs ${STATUS_TONE[meta.status]}`}
          >
            {meta.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {meta.title ?? "No draft yet"}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="btn-outline !py-2 !px-4 !text-[11px] shrink-0"
      >
        Open
      </button>
    </div>
  );
}

function Editor({
  id,
  onClose,
  onSent,
}: {
  id: string;
  onClose: () => void;
  onSent: (r: AnnounceResult) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Insight> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const detail = useQuery({
    queryKey: ["ops-insight", id],
    queryFn: async () => {
      const res = await fetch(`/api/ops/insights/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = (await res.json()) as { insight: Insight };
      setForm(body.insight);
      return body;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ops-insights"] });
    qc.invalidateQueries({ queryKey: ["ops-insight", id] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form?.title ?? "",
          description: form?.description ?? "",
          lede: form?.lede ?? "",
          tldr: form?.tldr ?? [],
          bodyMd: form?.bodyMd ?? "",
          keyTakeaway: form?.keyTakeaway ?? "",
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/insights/${id}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = (await res.json()) as { insight: Insight };
      setForm(body.insight);
      return body;
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const approve = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/insights/${id}/approve`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      return body as AnnounceResult;
    },
    onSuccess: (r) => {
      onSent(r);
      invalidate();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (detail.isPending || !form) {
    return <div className="data-card text-sm text-text-muted">Loading…</div>;
  }

  const set = (patch: Partial<Insight>) =>
    setForm((f) => ({ ...(f ?? {}), ...patch }));

  return (
    <div className="data-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm text-text">
          {form.ticker} · {form.status}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] text-text-dim hover:text-text"
        >
          CLOSE
        </button>
      </div>

      {form.generationError && (
        <p className="text-accent-red text-sm">{form.generationError}</p>
      )}
      {error && <p className="text-accent-red text-sm">{error}</p>}

      <div>
        <label className={labelClass}>Title</label>
        <input
          className={inputClass}
          value={form.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass}>Description (deck / meta)</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={form.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass}>Lede</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={form.lede ?? ""}
          onChange={(e) => set({ lede: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass}>TLDR — one per line</label>
        <textarea
          className={`${inputClass} min-h-[110px]`}
          value={(form.tldr ?? []).join("\n")}
          onChange={(e) =>
            set({ tldr: e.target.value.split("\n").filter((l) => l.trim()) })
          }
        />
      </div>

      <div>
        <label className={labelClass}>Body (markdown)</label>
        <textarea
          className={`${inputClass} min-h-[420px] font-mono !text-[13px] leading-relaxed`}
          value={form.bodyMd ?? ""}
          onChange={(e) => set({ bodyMd: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass}>Key takeaway</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={form.keyTakeaway ?? ""}
          onChange={(e) => set({ keyTakeaway: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>

        <Link
          href={`/dashboard/insights/${form.slug}`}
          target="_blank"
          className="btn-outline !py-2 !px-4 !text-[11px]"
        >
          <ExternalLink size={12} /> Preview
        </Link>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Regenerate discards the current draft, including any edits. Continue?",
              )
            ) {
              regenerate.mutate();
            }
          }}
          disabled={regenerate.isPending}
          className="btn-outline !py-2 !px-4 !text-[11px] !border-accent-purple !text-accent-purple hover:!bg-accent-purple hover:!text-on-accent disabled:opacity-50"
        >
          <Sparkles size={12} />
          {regenerate.isPending ? "Drafting…" : "Regenerate"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `Publish this note and email every opted-in subscriber about ${form.ticker}?\n\nThis cannot be undone — there is no un-send.`,
              )
            ) {
              approve.mutate();
            }
          }}
          disabled={approve.isPending || save.isPending}
          className="btn-primary !py-2.5 !px-5 !text-[11px] disabled:opacity-50 ml-auto"
        >
          <Send size={12} />
          {approve.isPending ? "Sending…" : "Approve & send"}
        </button>
      </div>

      <p className="text-xs text-text-dim">
        Save your edits before approving — approve publishes what is stored, not
        what is on screen.
      </p>
    </div>
  );
}
