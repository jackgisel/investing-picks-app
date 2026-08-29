"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Send, Undo2 } from "lucide-react";

import type { MarketNoteIssue } from "@/lib/market-note-issue";

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

type Payload = {
  issues: MarketNoteIssue[];
  subscribers: number;
  weekKey: string;
};

type SendResult = {
  sent: number;
  failed: number;
  total: number;
  errors: { email: string; error: string }[];
};

/**
 * Compose and send the free weekly Market Note.
 *
 * The landing page promotes this list directly under the hero. Before this page
 * existed the site collected addresses, mailed a welcome, and then never sent
 * anything — the subscribe endpoint, the unsubscribe flow and the token were
 * all built, but nothing ever composed an issue.
 */
export default function MarketNoteOpsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const list = useQuery({
    queryKey: ["ops", "market-note"],
    queryFn: async () => {
      const res = await fetch("/api/ops/market-note");
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as Payload;
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["ops", "market-note"] });
  };

  const startIssue = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/market-note", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as { issue: MarketNoteIssue };
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const issues = list.data?.issues ?? [];
  const current = issues.find((i) => !i.sentAt) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Market Note</h1>
        <p className="mt-2 font-sans text-sm text-text-muted">
          The free weekly email. Market commentary and a model watchlist, never
          the current portfolio picks.
          {list.data ? (
            <>
              {" "}
              <span className="font-mono text-text">
                {list.data.subscribers}
              </span>{" "}
              active {list.data.subscribers === 1 ? "address" : "addresses"}.
            </>
          ) : null}
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-soft border border-accent-red/40 bg-accent-red/5 px-4 py-3 text-sm text-accent-red"
        >
          {error}
        </div>
      )}

      {result && (
        <div
          role="status"
          className="rounded-soft border border-accent-green/40 bg-accent-green-soft/30 px-4 py-3 text-sm"
        >
          Sent to {result.sent} of {result.total}.
          {result.failed > 0 ? ` ${result.failed} failed.` : ""}
        </div>
      )}

      {list.isPending ? (
        <div className="data-card text-sm text-text-muted">Loading…</div>
      ) : current ? (
        <IssueEditor
          issue={current}
          subscribers={list.data?.subscribers ?? 0}
          onSent={setResult}
          onError={setError}
          onChanged={invalidate}
        />
      ) : (
        <div className="data-card">
          <p className="font-sans text-sm text-text-muted">
            No issue in progress for {list.data?.weekKey}.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              startIssue.mutate();
            }}
            disabled={startIssue.isPending}
            className="btn-primary mt-4 !py-2 !px-4 !text-[11px] disabled:opacity-50"
          >
            {startIssue.isPending ? "Starting…" : "Start this week's issue"}
          </button>
        </div>
      )}

      <section>
        <h2 className="field-label mb-3">Sent</h2>
        <ul className="divide-y divide-border border-y border-border">
          {issues
            .filter((i) => i.sentAt)
            .map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <span className="font-sans text-sm text-text">{i.subject}</span>
                <span className="font-mono text-[11px] text-text-dim">
                  {i.weekKey} · {i.recipients} recipients
                </span>
              </li>
            ))}
          {issues.every((i) => !i.sentAt) && (
            <li className="py-3 font-sans text-sm text-text-dim">
              Nothing sent yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function IssueEditor({
  issue,
  subscribers,
  onSent,
  onError,
  onChanged,
}: {
  issue: MarketNoteIssue;
  subscribers: number;
  onSent: (r: SendResult) => void;
  onError: (m: string | null) => void;
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState(issue.subject);
  const [lede, setLede] = useState(issue.lede ?? "");
  const [bodyMd, setBodyMd] = useState(issue.bodyMd ?? "");
  const [saved, setSaved] = useState(false);

  // A different issue in the same slot (a new week started) must not keep the
  // previous one's text in the boxes.
  useEffect(() => {
    setSubject(issue.subject);
    setLede(issue.lede ?? "");
    setBodyMd(issue.bodyMd ?? "");
  }, [issue.id, issue.subject, issue.lede, issue.bodyMd]);

  const save = useMutation({
    mutationFn: async (confirmed?: boolean) => {
      const res = await fetch(`/api/ops/market-note/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, lede, bodyMd, confirmed }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as { issue: MarketNoteIssue };
    },
    onSuccess: () => {
      setSaved(true);
      onError(null);
      onChanged();
    },
    onError: (e: Error) => onError(e.message),
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/market-note/${issue.id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as SendResult;
    },
    onSuccess: (r) => {
      onSent(r);
      onError(null);
      onChanged();
    },
    onError: (e: Error) => onError(e.message),
  });

  const insertBrief = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/market-note/brief", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as { lede: string; bodyMd: string };
    },
    onSuccess: (brief) => {
      setLede(brief.lede);
      setBodyMd(brief.bodyMd);
      setSaved(false);
      onError(null);
    },
    onError: (e: Error) => onError(e.message),
  });

  const ready = Boolean(issue.confirmedAt);

  return (
    <div className="data-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-text-dim">
          {issue.weekKey}
        </span>
        <span
          className={`font-sans text-[11px] font-bold uppercase tracking-[0.12em] ${
            ready ? "text-accent-green" : "text-text-dim"
          }`}
        >
          {ready ? "Ready to send" : "Draft"}
        </span>
      </div>

      <div>
        <label className={labelClass} htmlFor="mn-subject">
          Subject
        </label>
        <input
          id="mn-subject"
          className={inputClass}
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="mn-lede">
          Lede
        </label>
        <textarea
          id="mn-lede"
          rows={2}
          className={inputClass}
          value={lede}
          onChange={(e) => {
            setLede(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="mn-body">
          Body — markdown (## headings, - bullets, **bold**, [links](https://))
        </label>
        <textarea
          id="mn-body"
          rows={18}
          className={`${inputClass} font-mono text-[13px]`}
          value={bodyMd}
          onChange={(e) => {
            setBodyMd(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => insertBrief.mutate()}
          disabled={insertBrief.isPending || save.isPending}
          className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
        >
          {insertBrief.isPending ? "Loading screen…" : "Insert model brief"}
        </button>
        <button
          type="button"
          onClick={() => save.mutate(undefined)}
          disabled={save.isPending}
          className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => save.mutate(!ready)}
          disabled={save.isPending}
          className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
        >
          {ready ? <Undo2 size={12} /> : <Check size={12} />}
          {ready ? "Un-mark ready" : "Mark ready"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `Mail this to all ${subscribers} subscribers?\n\nThis cannot be undone — there is no un-send.`,
              )
            ) {
              send.mutate();
            }
          }}
          disabled={!ready || send.isPending || save.isPending}
          className="btn-primary ml-auto !py-2.5 !px-5 !text-[11px] disabled:opacity-50"
        >
          <Send size={12} />
          {send.isPending ? "Sending…" : "Send to the list"}
        </button>
      </div>

      <p className="text-xs text-text-dim">
        Save before sending — the send mails what is stored, not what is on
        screen.
      </p>
    </div>
  );
}
