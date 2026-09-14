"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Send, Undo2, X } from "lucide-react";

import type { MarketNoteIssue } from "@/lib/market-note-issue";
import type { MarketNotePreviewDraft } from "@/lib/market-note-brief";
import {
  emptyWatchlist,
  hasMarketNotePreviewContent,
  type MarketNoteUpcomingDate,
  type MarketNoteWatchItem,
} from "@/lib/market-note-preview";

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
 * Compose and send the Sunday Market Preview (the free weekly Market Note).
 *
 * Four first-class sections, not one markdown blob: the names we are looking
 * at, where sectors are moving, the fear/excitement, and dates ahead.
 */
export function SundayMarketPreviewPanel() {
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
        <p className="panel-label mb-2">Sunday Market Preview</p>
        <p className="font-sans text-sm text-text-muted max-w-xl">
          The free weekly email, written as four sections: three names we are
          looking at, where sectors are moving, the fear or excitement, and
          dates ahead. Never the current portfolio picks.
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
            {startIssue.isPending ? "Starting…" : "Start this week's preview"}
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
  const [watchlist, setWatchlist] = useState<MarketNoteWatchItem[]>(
    issue.watchlist.length ? issue.watchlist : emptyWatchlist(),
  );
  const [sectorsMd, setSectorsMd] = useState(issue.sectorsMd ?? "");
  const [sentimentMd, setSentimentMd] = useState(issue.sentimentMd ?? "");
  const [dates, setDates] = useState<MarketNoteUpcomingDate[]>(issue.dates);
  const [legacyBody, setLegacyBody] = useState(issue.bodyMd ?? "");
  const [saved, setSaved] = useState(false);

  const structuredEmpty =
    !hasMarketNotePreviewContent({
      watchlist,
      sectorsMd,
      sentimentMd,
      dates,
    });
  const showLegacyBody = Boolean(issue.bodyMd?.trim()) && structuredEmpty;

  useEffect(() => {
    setSubject(issue.subject);
    setLede(issue.lede ?? "");
    setWatchlist(issue.watchlist.length ? issue.watchlist : emptyWatchlist());
    setSectorsMd(issue.sectorsMd ?? "");
    setSentimentMd(issue.sentimentMd ?? "");
    setDates(issue.dates);
    setLegacyBody(issue.bodyMd ?? "");
  }, [issue.id, issue.updatedAt]);

  const save = useMutation({
    mutationFn: async (confirmed?: boolean) => {
      const res = await fetch(`/api/ops/market-note/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          lede,
          bodyMd: legacyBody,
          watchlist,
          sectorsMd,
          sentimentMd,
          dates,
          confirmed,
        }),
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
      return (await res.json()) as MarketNotePreviewDraft;
    },
    onSuccess: (brief) => {
      setLede(brief.lede);
      setWatchlist(brief.watchlist);
      setSectorsMd(brief.sectorsMd);
      setSentimentMd(brief.sentimentMd);
      setDates(brief.dates);
      setSaved(false);
      onError(null);
    },
    onError: (e: Error) => onError(e.message),
  });

  const ready = Boolean(issue.confirmedAt);
  const dirty = (updater: () => void) => {
    updater();
    setSaved(false);
  };

  return (
    <div className="data-card space-y-5">
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
        <label className={labelClass} htmlFor="smp-subject">
          Subject
        </label>
        <input
          id="smp-subject"
          className={inputClass}
          value={subject}
          onChange={(e) => dirty(() => setSubject(e.target.value))}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="smp-lede">
          Lede
        </label>
        <textarea
          id="smp-lede"
          rows={2}
          className={inputClass}
          value={lede}
          onChange={(e) => dirty(() => setLede(e.target.value))}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Top 3 stocks we are looking at</legend>
        <p className="text-xs text-text-dim -mt-1">
          Names outside the current book. Not recommendations — the screen, not
          the portfolio.
        </p>
        {watchlist.map((item, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-xl border border-border bg-bg-secondary/40 p-3 sm:grid-cols-[7rem_1fr]"
          >
            <div>
              <label className={labelClass} htmlFor={`smp-ticker-${i}`}>
                Ticker
              </label>
              <input
                id={`smp-ticker-${i}`}
                className={`${inputClass} font-mono uppercase`}
                value={item.ticker}
                onChange={(e) =>
                  dirty(() => {
                    const next = [...watchlist];
                    next[i] = { ...item, ticker: e.target.value };
                    setWatchlist(next);
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`smp-name-${i}`}>
                Name
              </label>
              <input
                id={`smp-name-${i}`}
                className={inputClass}
                value={item.name ?? ""}
                onChange={(e) =>
                  dirty(() => {
                    const next = [...watchlist];
                    next[i] = { ...item, name: e.target.value };
                    setWatchlist(next);
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor={`smp-note-${i}`}>
                Why we are looking
              </label>
              <textarea
                id={`smp-note-${i}`}
                rows={2}
                className={inputClass}
                value={item.note}
                onChange={(e) =>
                  dirty(() => {
                    const next = [...watchlist];
                    next[i] = { ...item, note: e.target.value };
                    setWatchlist(next);
                  })
                }
              />
            </div>
          </div>
        ))}
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="smp-sectors">
          Where sectors are moving
        </label>
        <textarea
          id="smp-sectors"
          rows={8}
          className={`${inputClass} font-mono text-[13px]`}
          value={sectorsMd}
          onChange={(e) => dirty(() => setSectorsMd(e.target.value))}
          placeholder="- **Industrials**: …"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="smp-sentiment">
          Fears and excitements
        </label>
        <textarea
          id="smp-sentiment"
          rows={6}
          className={inputClass}
          value={sentimentMd}
          onChange={(e) => dirty(() => setSentimentMd(e.target.value))}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Important dates coming up</legend>
        {dates.length === 0 && (
          <p className="text-xs text-text-dim">Nothing on the calendar yet.</p>
        )}
        {dates.map((row, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="w-40 min-w-[8rem]">
              <label className={labelClass} htmlFor={`smp-date-${i}`}>
                Date
              </label>
              <input
                id={`smp-date-${i}`}
                className={`${inputClass} font-mono`}
                value={row.date}
                placeholder="2026-09-18"
                onChange={(e) =>
                  dirty(() => {
                    const next = [...dates];
                    next[i] = { ...row, date: e.target.value };
                    setDates(next);
                  })
                }
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className={labelClass} htmlFor={`smp-date-label-${i}`}>
                What
              </label>
              <input
                id={`smp-date-label-${i}`}
                className={inputClass}
                value={row.label}
                placeholder="CPI, earnings, FOMC…"
                onChange={(e) =>
                  dirty(() => {
                    const next = [...dates];
                    next[i] = { ...row, label: e.target.value };
                    setDates(next);
                  })
                }
              />
            </div>
            <button
              type="button"
              aria-label="Remove date"
              onClick={() =>
                dirty(() => setDates(dates.filter((_, j) => j !== i)))
              }
              className="btn-outline !py-2 !px-3 !text-[11px]"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => dirty(() => setDates([...dates, { date: "", label: "" }]))}
          className="btn-outline !py-2 !px-4 !text-[11px]"
        >
          <Plus size={12} />
          Add a date
        </button>
      </fieldset>

      {showLegacyBody && (
        <div>
          <label className={labelClass} htmlFor="smp-legacy">
            Previous body — kept until the sections above are filled
          </label>
          <textarea
            id="smp-legacy"
            rows={12}
            className={`${inputClass} font-mono text-[13px]`}
            value={legacyBody}
            onChange={(e) => dirty(() => setLegacyBody(e.target.value))}
          />
        </div>
      )}

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
