"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { Insight, InsightMeta } from "@/lib/insights";

const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 font-sans text-sm text-text " +
  "placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";
const labelClass = "block field-label mb-1.5";

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

function countdown(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "noon has passed";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `sends in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `sends in ${hours}h ${minutes % 60}m`;
}

type PagePayload = {
  weekKey: string;
  periodLabel: string;
  sendAt: string;
  sendAtLabel: string;
  current: Insight | null;
  history: InsightMeta[];
};

type SendResult = {
  sent?: number;
  failed?: number;
  total?: number;
  published?: boolean;
  errors?: { email: string; error: string }[];
};

export default function OpsWeeklyReviewPage() {
  const qc = useQueryClient();
  const [sent, setSent] = useState<SendResult | null>(null);

  const page = useQuery({
    queryKey: ["ops-weekly-review"],
    queryFn: async () => {
      const res = await fetch("/api/ops/weekly-review", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<PagePayload>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const draft = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/weekly-review", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-weekly-review"] }),
  });

  const data = page.data;
  const current = data?.current ?? null;

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label mb-2">OPS</p>
        <h1 className="page-title">Weekly review</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Drafted Friday at 10am PT. Confirm it and it publishes on Insights and
          emails paid subscribers at noon PT. If you do not confirm, it does not
          go out.
        </p>
      </header>

      <section className="data-card space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="panel-label">This week</p>
            <p className="mt-1 font-sans text-sm text-text">
              {data?.periodLabel ?? "—"}
              {data?.weekKey ? (
                <span className="font-mono text-text-dim"> · {data.weekKey}</span>
              ) : null}
            </p>
            <p className="mt-1 font-mono text-xs text-text-muted">
              {data?.sendAtLabel
                ? `Send window: ${data.sendAtLabel}`
                : "Send window: Friday 12:00 PT"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => draft.mutate()}
            disabled={
              draft.isPending ||
              current?.status === "approved" ||
              current?.status === "draft"
            }
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={13}
              className={draft.isPending ? "animate-spin" : undefined}
            />
            {draft.isPending ? "Drafting…" : "Draft now"}
          </button>
        </div>
        {page.error && (
          <p className="text-accent-red text-sm">
            {(page.error as Error).message}
          </p>
        )}
        {draft.error && (
          <p className="text-accent-red text-sm">
            {(draft.error as Error).message}
          </p>
        )}
      </section>

      {current ? (
        <Editor
          key={`${current.id}-${current.updatedAt}`}
          insight={current}
          sendAtLabel={data?.sendAtLabel ?? "Friday 12:00 PT"}
          onSent={setSent}
        />
      ) : (
        !page.isPending && (
          <div className="data-panel px-4 py-6">
            <p className="text-sm text-text-muted">
              Nothing drafted this week yet. The Friday 10am PT job will write
              one, or press Draft now.
            </p>
          </div>
        )
      )}

      {sent && (
        <section className="space-y-2">
          <h2 className="panel-label">Last send</h2>
          <div className="data-panel px-4 py-3 space-y-1">
            <p className="text-sm text-text-muted">
              {sent.published === false ? (
                "Confirmed. It will send at noon PT."
              ) : (
                <>
                  Emailed{" "}
                  <span className="font-mono text-text">{sent.sent ?? 0}</span> of{" "}
                  <span className="font-mono text-text">{sent.total ?? 0}</span>{" "}
                  subscribers
                  {(sent.failed ?? 0) > 0 && (
                    <>
                      {" · "}
                      <span className="font-mono text-accent-red">
                        {sent.failed} failed
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
            {(sent.errors ?? []).map((e) => (
              <p key={e.email} className="font-mono text-xs text-accent-red">
                {e.email} — {e.error}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="panel-label">
          Earlier weeks ({data?.history.length ?? 0})
        </h2>
        <div className="divide-y divide-border data-panel">
          {(data?.history ?? []).map((meta) => (
            <div
              key={meta.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-text-dim">{meta.status}</p>
                <p className="truncate text-sm text-text mt-0.5">{meta.title}</p>
              </div>
              <Link
                href={`/dashboard/insights/${meta.slug}`}
                className="shrink-0 flex items-center gap-1 font-mono text-[10px] text-text-dim hover:text-text"
              >
                VIEW <ExternalLink size={10} />
              </Link>
            </div>
          ))}
          {(data?.history.length ?? 0) === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">
              No earlier reviews.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Editor({
  insight,
  sendAtLabel,
  onSent,
}: {
  insight: Insight;
  sendAtLabel: string;
  onSent: (r: SendResult) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Insight>(insight);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ops-weekly-review"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title ?? "",
          description: form.description ?? "",
          lede: form.lede ?? "",
          tldr: form.tldr ?? [],
          bodyMd: form.bodyMd ?? "",
          keyTakeaway: form.keyTakeaway ?? "",
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ insight: Insight }>;
    },
    onSuccess: (body) => {
      setForm(body.insight);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/weekly-review/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: insight.id }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = (await res.json()) as { insight?: Insight };
      if (body.insight) setForm(body.insight);
      return body;
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/insights/${insight.id}/reject`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      return body as { insight: Insight };
    },
    onSuccess: (body) => {
      setForm(body.insight);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/weekly-review/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: insight.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      return body as SendResult & { insight?: Insight };
    },
    onSuccess: (body) => {
      if (body.insight) setForm(body.insight);
      onSent(body);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const unconfirm = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/weekly-review/unconfirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: insight.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      return body as { insight: Insight };
    },
    onSuccess: (body) => {
      setForm(body.insight);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (patch: Partial<Insight>) =>
    setForm((f) => ({ ...f, ...patch }));

  const due = countdown(form.autoPublishAt);
  const published = form.status === "approved";
  const confirmed = Boolean(form.confirmedAt) && !published;
  const canConfirm = form.status === "draft" && Boolean(form.bodyMd);

  return (
    <div className="data-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm text-text">
          {form.status}
          {confirmed ? " · confirmed" : ""}
          {form.generationError ? " · failed" : ""}
        </span>
        {due && form.status === "draft" && (
          <span
            className={`font-mono text-xs ${
              due === "noon has passed" ? "text-accent-red" : "text-text-muted"
            }`}
          >
            {due}
          </span>
        )}
      </div>

      {form.status === "draft" && !confirmed && (
        <p className="text-xs text-accent-yellow">
          Not confirmed. It will not send at {sendAtLabel} unless you confirm.
        </p>
      )}
      {confirmed && (
        <p className="text-xs text-accent-green">
          Confirmed. It will publish and email paid subscribers at {sendAtLabel}
          {due === "noon has passed" ? " — confirm again to send now." : "."}
        </p>
      )}
      {published && (
        <p className="text-xs text-text-muted">
          Published. Editing it would change what subscribers were already sent.
        </p>
      )}
      {form.status === "rejected" && (
        <p className="text-xs text-text-muted">
          Rejected — this week will not send. Regenerate puts it back as a
          draft.
        </p>
      )}

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
          disabled={published}
        />
      </div>

      <div>
        <label className={labelClass}>Description (deck / meta)</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={form.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
          disabled={published}
        />
      </div>

      <div>
        <label className={labelClass}>Lede</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={form.lede ?? ""}
          onChange={(e) => set({ lede: e.target.value })}
          disabled={published}
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
          disabled={published}
        />
      </div>

      <div>
        <label className={labelClass}>Body (markdown)</label>
        <textarea
          className={`${inputClass} min-h-[420px] font-mono !text-[13px] leading-relaxed`}
          value={form.bodyMd ?? ""}
          onChange={(e) => set({ bodyMd: e.target.value })}
          disabled={published}
        />
      </div>

      <div>
        <label className={labelClass}>Key takeaway</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={form.keyTakeaway ?? ""}
          onChange={(e) => set({ keyTakeaway: e.target.value })}
          disabled={published}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || published}
          className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>

        {form.slug && (
          <Link
            href={`/dashboard/insights/${form.slug}`}
            target="_blank"
            className="btn-outline !py-2 !px-4 !text-[11px]"
          >
            <ExternalLink size={12} /> Preview
          </Link>
        )}

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Regenerate discards the current draft, including any edits, and clears confirm. Continue?",
              )
            ) {
              regenerate.mutate();
            }
          }}
          disabled={regenerate.isPending || published}
          className="btn-outline !py-2 !px-4 !text-[11px] !border-accent-purple !text-accent-purple hover:!bg-accent-purple hover:!text-on-accent disabled:opacity-50"
        >
          <Sparkles size={12} />
          {regenerate.isPending ? "Drafting…" : "Regenerate"}
        </button>

        {form.status === "draft" && (
          <button
            type="button"
            onClick={() => reject.mutate()}
            disabled={reject.isPending}
            className="btn-outline !py-2 !px-4 !text-[11px] !border-accent-red !text-accent-red hover:!bg-accent-red hover:!text-on-accent disabled:opacity-50"
          >
            <Ban size={12} />
            {reject.isPending ? "Stopping…" : "Reject"}
          </button>
        )}

        {confirmed && (
          <button
            type="button"
            onClick={() => unconfirm.mutate()}
            disabled={unconfirm.isPending}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
          >
            <Undo2 size={12} />
            {unconfirm.isPending ? "Clearing…" : "Unconfirm"}
          </button>
        )}

        {canConfirm && (
          <button
            type="button"
            onClick={() => {
              const past = due === "noon has passed";
              if (
                window.confirm(
                  past
                    ? "Noon PT has passed. Confirm now and this review will publish and email paid subscribers immediately. This cannot be undone."
                    : `Confirm this review for send at ${sendAtLabel}? It will not go out before then. Save first — confirm publishes what is stored, not what is on screen.`,
                )
              ) {
                confirm.mutate();
              }
            }}
            disabled={confirm.isPending || save.isPending}
            className="btn-primary !py-2.5 !px-5 !text-[11px] disabled:opacity-50 ml-auto"
          >
            <Check size={12} />
            {confirm.isPending
              ? due === "noon has passed"
                ? "Sending…"
                : "Confirming…"
              : due === "noon has passed"
                ? "Confirm and send now"
                : confirmed
                  ? "Confirmed"
                  : "Confirm for noon send"}
          </button>
        )}
      </div>
    </div>
  );
}
