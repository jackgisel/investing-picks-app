"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  STATUSES,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  type FeatureRequestStatus,
  type FeatureRequestWithAuthor,
} from "@/lib/feature-requests";

const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 font-sans text-sm text-text " +
  "placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";

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

type Filter = FeatureRequestStatus | "all";
const FILTERS: readonly Filter[] = ["all", ...STATUSES];

export default function OpsFeatureRequestsPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery({
    queryKey: ["ops-feature-requests"],
    queryFn: async () => {
      const res = await fetch("/api/ops/feature-requests", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ requests: FeatureRequestWithAuthor[] }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const requests = useMemo(
    () =>
      (list.data?.requests ?? []).filter(
        (r) => filter === "all" || r.status === filter,
      ),
    [list.data, filter],
  );

  const openCount = (list.data?.requests ?? []).filter(
    (r) => r.status === "open",
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label mb-2">OPS</p>
        <h1 className="page-title">Feature requests</h1>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          What members have asked for. Status and note are both shown back to
          the person who submitted it — write the note as a reply to them.
        </p>
      </header>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`pill ${
                filter === f
                  ? "bg-inverse text-inverse-fg"
                  : "bg-bg-secondary text-text-muted hover:text-text"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-text-dim">
          {openCount} open
        </span>
      </div>

      {list.isLoading && <p className="text-text-muted text-sm">Loading…</p>}
      {list.error && (
        <p className="text-accent-red text-sm">
          {(list.error as Error).message}
        </p>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} />
        ))}
        {list.data && requests.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-muted data-panel">
            {filter === "all"
              ? "No feature requests yet."
              : `Nothing ${STATUS_LABEL[filter as FeatureRequestStatus].toLowerCase()}.`}
          </p>
        )}
      </div>
    </div>
  );
}

function RequestCard({ request }: { request: FeatureRequestWithAuthor }) {
  const qc = useQueryClient();
  // Uncontrolled until touched, so a refetch while triaging another row does
  // not wipe a note half-written here.
  const [note, setNote] = useState<string | null>(null);
  const noteValue = note ?? request.adminNote ?? "";
  const dirty = note !== null && note !== (request.adminNote ?? "");

  const save = useMutation({
    mutationFn: async (patch: {
      status?: FeatureRequestStatus;
      adminNote?: string;
    }) => {
      const res = await fetch(`/api/ops/feature-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      setNote(null);
      qc.invalidateQueries({ queryKey: ["ops-feature-requests"] });
    },
  });

  return (
    <div className="data-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans text-[15px] font-semibold text-text">
            {request.title}
          </p>
          <p className="font-mono text-[11px] text-text-dim mt-1 break-all">
            {request.author.displayName || "no display name"} ·{" "}
            {request.author.email} ·{" "}
            {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`badge shrink-0 ${STATUS_BADGE_CLASS[request.status]}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </div>

      {request.body && (
        <p className="font-sans text-[13px] text-text-muted leading-relaxed whitespace-pre-wrap">
          {request.body}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <label className="field-label" htmlFor={`status-${request.id}`}>
          Status
        </label>
        <select
          id={`status-${request.id}`}
          value={request.status}
          disabled={save.isPending}
          onChange={(e) =>
            save.mutate({ status: e.target.value as FeatureRequestStatus })
          }
          className="bg-bg-secondary border border-border rounded-soft px-3 py-2 font-mono text-[11px] text-text disabled:opacity-50"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {save.error && (
          <span className="font-mono text-[11px] text-accent-red">
            {(save.error as Error).message}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <label className="field-label block" htmlFor={`note-${request.id}`}>
          Response to the member
        </label>
        <textarea
          id={`note-${request.id}`}
          value={noteValue}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Shown on their requests page. Empty clears it."
          className={`${inputClass} resize-y`}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ adminNote: noteValue })}
            className="btn-outline !py-2 !px-4 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {save.isPending ? "Saving…" : "Save note"}
          </button>
          {dirty && !save.isPending && (
            <button
              type="button"
              onClick={() => setNote(null)}
              className="font-mono text-[11px] text-text-dim hover:text-text transition-colors"
            >
              discard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
