"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CAMPAIGN_SINGLES,
  CAMPAIGN_THREADS,
  type CampaignDraft,
} from "@/lib/campaign-drafts";

/**
 * Read-only review of the X campaign mocks.
 *
 * Separate from the X Threads queue on purpose: those drafts can be confirmed
 * and posted. These cannot. There is no send action on this panel.
 */
export function CampaignDraftsPanel() {
  return (
    <div className="space-y-8">
      <header>
        <p className="panel-label mb-2">Campaign drafts</p>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Copies for review. Nothing here is scheduled or sent.
        </p>
      </header>

      <AiDraft />

      <DraftIndex />

      <DraftSection title="Singles" drafts={CAMPAIGN_SINGLES} />
      <DraftSection title="Threads" drafts={CAMPAIGN_THREADS} />
    </div>
  );
}

function AiDraft() {
  const [topic, setTopic] = useState("");
  const [thread, setThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/campaign-drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, thread }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; posts?: string[] };
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      return body.posts ?? [];
    },
    onSuccess: () => setError(null),
    onError: (e: Error) => setError(e.message),
  });
  const posts = generate.data;
  return (
    <section className="data-card space-y-3">
      <p className="field-label">Draft with AI</p>
      <input
        className="w-full rounded border border-border bg-transparent px-3 py-2 font-sans text-sm text-text"
        placeholder="Topic, e.g. cooling suppliers for data centers"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />
      <label className="flex items-center gap-2 font-sans text-sm text-text-muted">
        <input type="checkbox" checked={thread} onChange={(e) => setThread(e.target.checked)} />
        Thread
      </label>
      <button
        type="button"
        onClick={() => generate.mutate()}
        disabled={generate.isPending || !topic.trim()}
        className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50"
      >
        {generate.isPending ? "Researching and writing…" : "Draft"}
      </button>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      {posts && (
        <ol className="space-y-3 border-t border-border pt-3">
          {posts.map((post, index) => (
            <li key={index} className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text">
              {post}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DraftIndex() {
  return (
    <nav aria-label="Campaign drafts" className="data-card space-y-4">
      <IndexRow label="Singles" drafts={CAMPAIGN_SINGLES} />
      <IndexRow label="Threads" drafts={CAMPAIGN_THREADS} />
    </nav>
  );
}

function IndexRow({
  label,
  drafts,
}: {
  label: string;
  drafts: readonly CampaignDraft[];
}) {
  return (
    <div>
      <p className="field-label mb-2">{label}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <a
              href={`#${draft.id}`}
              className="font-sans text-[13px] text-text-muted hover:text-text"
            >
              {draft.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DraftSection({
  title,
  drafts,
}: {
  title: string;
  drafts: readonly CampaignDraft[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="panel-label">
        {title} ({drafts.length})
      </h2>
      <div className="space-y-3">
        {drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
      </div>
    </section>
  );
}

function DraftCard({ draft }: { draft: CampaignDraft }) {
  const threaded = draft.posts.length > 1;
  return (
    <article id={draft.id} className="data-card scroll-mt-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-sans text-sm font-semibold text-text">
          {draft.label}
        </h3>
        <span className="shrink-0 font-mono text-[11px] text-text-dim">
          Draft
        </span>
      </div>
      <ol className="space-y-4">
        {draft.posts.map((post, index) => (
          <li key={index} className="space-y-1.5">
            {threaded && <p className="field-label">Post {index + 1}</p>}
            <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text">
              {post}
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}
