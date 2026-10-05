"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Send, Undo2 } from "lucide-react";
import type { EditorialIssue, EditorialKind } from "@/lib/editorial-issue";

const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 font-sans text-sm text-text " +
  "placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";
const labelClass = "block field-label mb-1.5";

const COPY: Record<EditorialKind, { title: string; blurb: string }> = {
  market_analysis: {
    title: "Market analysis",
    blurb: "Free letter on the 1st and the 15th. Confirm it or that half of the month does not go out.",
  },
  pick_spotlight: {
    title: "Pick spotlight",
    blurb: "Free Wednesday letter about one holding that has been working. The same name does not lead two weeks in a row when there is another.",
  },
};

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

export function EditorialPanel({ kind }: { kind: EditorialKind }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];

  const page = useQuery({
    queryKey: ["ops-editorial", kind],
    queryFn: async () => {
      const res = await fetch(`/api/ops/editorial?kind=${kind}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ issue: EditorialIssue; subscribers: number }>;
    },
  });

  const prepare = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["ops-editorial", kind] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const issue = page.data?.issue;

  return (
    <div className="space-y-4">
      <p className="max-w-xl font-sans text-sm text-text-muted">{copy.blurb}</p>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      {page.isPending ? (
        <div className="data-card text-sm text-text-muted">Loading…</div>
      ) : issue ? (
        <Editor
          issue={issue}
          subscribers={page.data?.subscribers ?? 0}
          onError={setError}
          onChanged={() => void qc.invalidateQueries({ queryKey: ["ops-editorial", kind] })}
        />
      ) : (
        <button
          type="button"
          className="btn-outline !px-4 !py-2 !text-[11px]"
          onClick={() => prepare.mutate()}
          disabled={prepare.isPending}
        >
          {prepare.isPending ? "Opening…" : `Open ${copy.title}`}
        </button>
      )}
    </div>
  );
}

function Editor({
  issue,
  subscribers,
  onError,
  onChanged,
}: {
  issue: EditorialIssue;
  subscribers: number;
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState(issue.subject);
  const [bodyMd, setBodyMd] = useState(issue.bodyMd);
  const ready = Boolean(issue.confirmedAt);

  useEffect(() => {
    setSubject(issue.subject);
    setBodyMd(issue.bodyMd);
  }, [issue.id, issue.updatedAt, issue.subject, issue.bodyMd]);

  const save = useMutation({
    mutationFn: async (confirmed?: boolean) => {
      const res = await fetch(`/api/ops/editorial/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyMd, confirmed }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
    },
    onSuccess: () => {
      onError(null);
      onChanged();
    },
    onError: (e: Error) => onError(e.message),
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/editorial/${issue.id}/send`, { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res));
    },
    onSuccess: () => {
      onError(null);
      onChanged();
    },
    onError: (e: Error) => onError(e.message),
  });

  return (
    <div className="data-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-text-dim">
          {issue.periodKey}
          {issue.ticker ? ` · ${issue.ticker}` : ""}
        </span>
        <span className={`font-sans text-[11px] font-bold uppercase tracking-[0.12em] ${ready ? "text-accent-green" : "text-text-dim"}`}>
          {issue.sentAt ? "Sent" : ready ? "Ready to send" : "Draft"}
        </span>
      </div>
      <div>
        <label className={labelClass} htmlFor="ed-subject">Subject</label>
        <input id="ed-subject" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="ed-body">Body</label>
        <textarea id="ed-body" rows={12} className={`${inputClass} font-mono text-[13px]`} value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button type="button" className="btn-outline !px-4 !py-2 !text-[11px]" onClick={() => save.mutate(undefined)} disabled={save.isPending || Boolean(issue.sentAt)}>
          Save
        </button>
        <button type="button" className="btn-outline !px-4 !py-2 !text-[11px]" onClick={() => save.mutate(!ready)} disabled={save.isPending || Boolean(issue.sentAt)}>
          {ready ? <Undo2 size={12} /> : <Check size={12} />}
          {ready ? "Un-mark ready" : "Mark ready"}
        </button>
        <button
          type="button"
          className="btn-primary ml-auto !px-5 !py-2.5 !text-[11px] disabled:opacity-50"
          disabled={!ready || Boolean(issue.sentAt) || send.isPending}
          onClick={() => {
            if (window.confirm(`Mail this to ${subscribers} addresses? There is no un-send.`)) {
              send.mutate();
            }
          }}
        >
          <Send size={12} />
          {issue.sentAt ? "Sent" : "Send to the list"}
        </button>
      </div>
    </div>
  );
}
