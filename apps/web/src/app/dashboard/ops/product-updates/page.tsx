"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import type { ProductUpdate } from "@/lib/product-updates";

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

type SendResult = {
  sent: number;
  failed: number;
  total: number;
  errors: { email: string; error: string }[];
};

export default function OpsProductUpdatesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [sent, setSent] = useState<SendResult | null>(null);

  const list = useQuery({
    queryKey: ["ops-product-updates"],
    queryFn: async () => {
      const res = await fetch("/api/ops/product-updates", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ updates: ProductUpdate[] }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/product-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as { update: ProductUpdate };
    },
    onSuccess: (body) => {
      setSubject("");
      setEditingId(body.update.id);
      qc.invalidateQueries({ queryKey: ["ops-product-updates"] });
    },
  });

  const updates = list.data?.updates ?? [];
  const drafts = updates.filter((u) => u.status === "draft");
  const history = updates.filter((u) => u.status === "sent");

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label panel-label-lilac mb-2">OPS</p>
        <h1 className="page-title">Product updates</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Feature news, written here and mailed to everyone opted in. Unlike pick
          alerts this goes to free accounts too — it carries no paid research, so
          there is nothing to gate. Sending is one-way and cannot be undone.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="panel-label panel-label-lilac">NEW UPDATE</h2>
        <div className="data-panel px-4 py-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className={labelClass}>Subject</label>
            <input
              className={inputClass}
              value={subject}
              placeholder="What shipped?"
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={!subject.trim() || create.isPending}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            {create.isPending ? "Creating…" : "Start draft"}
          </button>
        </div>
        {create.error && (
          <p className="text-accent-red text-sm">
            {(create.error as Error).message}
          </p>
        )}
        {list.error && (
          <p className="text-accent-red text-sm">
            {(list.error as Error).message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="panel-label panel-label-lilac">DRAFTS ({drafts.length})</h2>
        {drafts.length === 0 && !list.isPending && (
          <div className="data-panel px-4 py-6">
            <p className="text-sm text-text-muted">No drafts.</p>
          </div>
        )}
        <div className="space-y-3">
          {drafts.map((u) =>
            editingId === u.id ? (
              <Editor
                key={u.id}
                id={u.id}
                onClose={() => setEditingId(null)}
                onSent={setSent}
              />
            ) : (
              <div
                key={u.id}
                className="data-card flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text">{u.subject}</p>
                  <p className="text-xs text-text-dim mt-1">
                    {u.bodyMd.trim() ? "Draft" : "Empty — no body yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(u.id)}
                  className="btn-outline !py-2 !px-4 !text-[11px] shrink-0"
                >
                  Open
                </button>
              </div>
            ),
          )}
        </div>
      </section>

      {sent && (
        <section className="space-y-2">
          <h2 className="panel-label panel-label-mint">LAST SEND</h2>
          <div className="data-panel px-4 py-3 space-y-1">
            <p className="text-sm text-text-muted">
              Emailed <span className="font-mono text-text">{sent.sent}</span> of{" "}
              <span className="font-mono text-text">{sent.total}</span>
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
        <h2 className="panel-label panel-label-coral">SENT ({history.length})</h2>
        <div className="divide-y divide-border data-panel">
          {history.map((u) => (
            <div key={u.id} className="px-4 py-3">
              <p className="text-sm text-text">{u.subject}</p>
              <p className="font-mono text-[10px] text-text-dim mt-1">
                {u.sentAt ? new Date(u.sentAt).toLocaleString() : "—"}
                {u.recipients !== null && ` · ${u.recipients} recipients`}
              </p>
            </div>
          ))}
          {history.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">
              Nothing sent yet.
            </p>
          )}
        </div>
      </section>
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
  onSent: (r: SendResult) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const detail = useQuery({
    queryKey: ["ops-product-update", id],
    queryFn: async () => {
      const res = await fetch(`/api/ops/product-updates/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = (await res.json()) as { update: ProductUpdate };
      setForm(body.update);
      return body;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ops-product-updates"] });
    qc.invalidateQueries({ queryKey: ["ops-product-update", id] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/product-updates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form?.subject ?? "",
          bodyMd: form?.bodyMd ?? "",
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

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/product-updates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const sendNow = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/product-updates/${id}/send`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      return body as SendResult;
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

  return (
    <div className="data-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm text-text">Draft</span>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] text-text-dim hover:text-text"
        >
          CLOSE
        </button>
      </div>

      {error && <p className="text-accent-red text-sm">{error}</p>}

      <div>
        <label className={labelClass}>Subject</label>
        <input
          className={inputClass}
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass}>
          Body — markdown: ## headings, - bullets, **bold**, [links](url)
        </label>
        <textarea
          className={`${inputClass} min-h-[300px] font-mono !text-[13px] leading-relaxed`}
          value={form.bodyMd}
          onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
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

        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this draft?")) remove.mutate();
          }}
          disabled={remove.isPending}
          className="btn-outline !py-2 !px-4 !text-[11px] !border-accent-red !text-accent-red hover:!bg-accent-red hover:!text-on-accent disabled:opacity-50"
        >
          <Trash2 size={12} />
          Delete
        </button>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `Send "${form.subject}" to everyone opted in to product updates?\n\nThis cannot be undone — there is no un-send.`,
              )
            ) {
              sendNow.mutate();
            }
          }}
          disabled={sendNow.isPending || save.isPending}
          className="btn-primary !py-2.5 !px-5 !text-[11px] disabled:opacity-50 ml-auto"
        >
          <Send size={12} />
          {sendNow.isPending ? "Sending…" : "Send now"}
        </button>
      </div>

      <p className="text-xs text-text-dim">
        Save before sending — send mails what is stored, not what is on screen.
      </p>
    </div>
  );
}
