"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Send,
  Undo2,
} from "lucide-react";

/**
 * Review queue for X threads.
 *
 * Every thread reaches the timeline through this page. The scheduled job posts
 * only what carries a confirm, so the Confirm button is the publish decision
 * and the hourly tick is just how long you wait for it.
 */

const MAX_CHARS = 280;

type Thread = {
  id: string;
  kind: "pick" | "weekly_review" | "market" | "spotlight" | "sunday_review";
  dedupeKey: string;
  posts: string[];
  facts: { summary?: string };
  status: "draft" | "posted" | "failed" | "rejected";
  confirmedAt: string | null;
  postedAt: string | null;
  postedIds: string[];
  failedAtIndex: number | null;
  error: string | null;
  createdAt: string;
  lengths: number[];
  estimatedCostUsd: number;
};

type Payload = {
  configured: boolean;
  handle: string | null;
  threads: Thread[];
};

const KIND_LABEL: Record<Thread["kind"], string> = {
  weekly_review: "Weekly review",
  market: "Market & sectors",
  pick: "Pick",
  spotlight: "Spotlight",
  sunday_review: "Week ahead",
};

async function errorMessage(res: Response): Promise<string> {
  // Read as text first. A proxy timeout or a crashed container answers with
  // HTML, and `res.json()` throwing there is what turned a perfectly clear
  // "run the macro job" into a bare "Request failed (502)" on screen.
  const raw = await res.text().catch(() => "");
  try {
    const body = JSON.parse(raw);
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* not JSON — fall through to the raw text below */
  }
  const snippet = raw.trim().slice(0, 200);
  if (snippet && !snippet.startsWith("<")) return `${snippet} (${res.status})`;
  return res.status === 504 || res.status === 502
    ? `Request failed (${res.status}) — the draft likely ran past the gateway timeout. Check the queue in a minute before retrying.`
    : `Request failed (${res.status})`;
}

export default function OpsXThreadsPage() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ops-x-threads"] });

  const page = useQuery({
    queryKey: ["ops-x-threads"],
    queryFn: async () => {
      const res = await fetch("/api/ops/x-threads", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<Payload>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const draft = useMutation({
    mutationFn: async (kind: Thread["kind"]) => {
      const res = await fetch("/api/ops/x-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: invalidate,
  });

  const data = page.data;
  const threads = data?.threads ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label mb-2">OPS</p>
        <h1 className="page-title">X threads</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Drafted on a schedule, posted only once you confirm. Nothing here
          reaches the timeline without a confirm, and a posted thread cannot be
          un-posted — read it first.
        </p>
      </header>

      <section className="data-card space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="panel-label">Account</p>
            <p className="mt-1 font-mono text-sm text-text">
              {data?.handle ? `@${data.handle}` : "—"}
            </p>
            <p className="mt-1 font-mono text-xs text-text-muted">
              {data === undefined
                ? " "
                : data.configured
                  ? "Credentials configured"
                  : "No X credentials on this deployment — posting is disabled"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["weekly_review", "market", "spotlight", "sunday_review"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => draft.mutate(kind)}
                disabled={draft.isPending}
                className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  size={13}
                  className={draft.isPending ? "animate-spin" : undefined}
                />
                Draft {KIND_LABEL[kind].toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        {page.error && (
          <p className="text-accent-red text-sm">{(page.error as Error).message}</p>
        )}
        {draft.error && (
          <p className="text-accent-red text-sm">{(draft.error as Error).message}</p>
        )}
      </section>

      {threads.length === 0 && !page.isPending && (
        <div className="data-panel px-4 py-6">
          <p className="text-sm text-text-muted">
            No threads yet. The Friday and Tuesday jobs write them, or press a
            Draft button above.
          </p>
        </div>
      )}

      {threads.map((thread) => (
        <ThreadCard
          key={`${thread.id}-${thread.posts.length}-${thread.status}`}
          thread={thread}
          handle={data?.handle ?? "outpick"}
          onChanged={invalidate}
        />
      ))}
    </div>
  );
}

function ThreadCard({
  thread,
  handle,
  onChanged,
}: {
  thread: Thread;
  handle: string;
  onChanged: () => void;
}) {
  const [posts, setPosts] = useState<string[]>(thread.posts);
  const [saveError, setSaveError] = useState<string | null>(null);

  const editable = thread.status === "draft" && !thread.postedAt;
  // Wider than `editable`: a rejected thread has no posted content either,
  // and "discard and let the slot draft again" is exactly what you want
  // right after rejecting one, not just before.
  const redraftable = !thread.postedAt;
  const dirty = JSON.stringify(posts) !== JSON.stringify(thread.posts);
  const lengths = posts.map((p) => charCount(p));
  const overLimit = lengths.some((n) => n > MAX_CHARS);

  const call = useMutation({
    mutationFn: async (args: { path: string; method?: string; body?: unknown }) => {
      const res = await fetch(`/api/ops/x-threads/${thread.id}${args.path}`, {
        method: args.method ?? "POST",
        headers: args.body ? { "Content-Type": "application/json" } : undefined,
        body: args.body ? JSON.stringify(args.body) : undefined,
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      setSaveError(null);
      onChanged();
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const redraft = () => {
    if (
      window.confirm(
        "Discard this thread and free its slot for a fresh draft? This cannot be undone.",
      )
    ) {
      call.mutate({ path: "", method: "DELETE" });
    }
  };

  return (
    <section className="data-card space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="panel-label">{KIND_LABEL[thread.kind]}</p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            {thread.dedupeKey} · {posts.length} posts · ~$
            {estimate(posts).toFixed(2)}
          </p>
          {thread.facts?.summary && (
            <p className="mt-2 text-sm text-text-muted max-w-2xl">
              {thread.facts.summary}
            </p>
          )}
        </div>
        <StatusBadge thread={thread} handle={handle} />
      </div>

      <div className="space-y-3">
        {posts.map((post, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="field-label">Post {i + 1}</span>
              <span
                className={`font-mono text-[11px] ${
                  lengths[i] > MAX_CHARS ? "text-accent-red" : "text-text-dim"
                }`}
              >
                {lengths[i]}/{MAX_CHARS}
              </span>
            </div>
            <textarea
              value={post}
              readOnly={!editable}
              rows={3}
              onChange={(e) => {
                const next = [...posts];
                next[i] = e.target.value;
                setPosts(next);
              }}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 font-sans text-sm text-text focus:outline-none focus:border-border-strong transition-colors read-only:text-text-muted"
            />
          </div>
        ))}
      </div>

      {(saveError || thread.error) && (
        <p className="text-accent-red text-sm">{saveError ?? thread.error}</p>
      )}

      {editable && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={!dirty || overLimit || call.isPending}
            onClick={() =>
              call.mutate({ path: "", method: "PATCH", body: { posts } })
            }
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save edits
          </button>

          {thread.confirmedAt ? (
            <button
              type="button"
              disabled={call.isPending}
              onClick={() => call.mutate({ path: "/unconfirm" })}
              className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
            >
              <Undo2 size={13} /> Unconfirm
            </button>
          ) : (
            <button
              type="button"
              disabled={dirty || overLimit || call.isPending}
              onClick={() => call.mutate({ path: "/confirm" })}
              className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
              title={dirty ? "Save your edits first" : undefined}
            >
              <Check size={13} /> Confirm
            </button>
          )}

          {thread.confirmedAt && (
            <button
              type="button"
              disabled={call.isPending}
              onClick={() => call.mutate({ path: "/post" })}
              className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
            >
              <Send size={13} /> Post now
            </button>
          )}

          <button
            type="button"
            disabled={call.isPending}
            onClick={() => call.mutate({ path: "/reject" })}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 ml-auto"
          >
            <Ban size={13} /> Reject
          </button>

          <button
            type="button"
            disabled={call.isPending}
            onClick={redraft}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
          >
            <RotateCcw size={13} /> Redraft
          </button>
        </div>
      )}

      {!editable && redraftable && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={call.isPending}
            onClick={redraft}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 ml-auto"
          >
            <RotateCcw size={13} /> Redraft
          </button>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ thread, handle }: { thread: Thread; handle: string }) {
  if (thread.status === "posted" && thread.postedIds[0]) {
    return (
      <a
        href={`https://x.com/${handle}/status/${thread.postedIds[0]}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-[11px] text-text-muted hover:text-text inline-flex items-center gap-1"
      >
        Posted <ExternalLink size={12} />
      </a>
    );
  }
  if (thread.status === "failed") {
    return (
      <span className="font-mono text-[11px] text-accent-red">
        {thread.postedIds.length > 0
          ? `Partial — ${thread.postedIds.length} of ${thread.posts.length} posted`
          : "Failed"}
      </span>
    );
  }
  if (thread.status === "rejected") {
    return <span className="font-mono text-[11px] text-text-dim">Rejected</span>;
  }
  return (
    <span className="font-mono text-[11px] text-text-muted">
      {thread.confirmedAt ? "Confirmed — posts on the next tick" : "Draft"}
    </span>
  );
}

/**
 * Mirror of `countChars` in x-client, duplicated because this is a client
 * component and that module imports node:crypto. Keep the two in step.
 */
function charCount(text: string): number {
  const urls = text.match(/https?:\/\/[^\s]+/gi)?.length ?? 0;
  return [...text.replace(/https?:\/\/[^\s]+/gi, "")].length + urls * 23;
}

function estimate(posts: string[]): number {
  return posts.reduce(
    (sum, p) => sum + (/https?:\/\//i.test(p) ? 0.2 : 0.015),
    0,
  );
}
