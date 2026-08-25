"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Lightbulb } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { DataStateCard } from "@/components/ui/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  type FeatureRequest,
} from "@/lib/feature-requests";

export default function FeatureRequestsPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="page-measure space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="page-measure">
        <DataStateCard state="unauthenticated" />
      </div>
    );
  }

  return (
    <div className="page-measure space-y-8">
      <div>
        <h1 className="page-title">Feature requests</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          Tell us what would make Outpick more useful. We read every one.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={14} className="text-accent-green" />
          <p className="panel-label">SUBMIT AN IDEA</p>
        </div>
        <h2 className="font-sans text-[18px] font-semibold mb-1">
          What would you like to see?
        </h2>
        <p className="font-sans text-[13px] text-text-muted mb-5 leading-relaxed max-w-[560px]">
          One idea per request — separate ones are easier to plan, ship, and
          tell you about. A title on its own is fine.
        </p>
        <div className="data-card">
          <RequestForm />
        </div>
      </section>

      <YourRequests />
    </div>
  );
}

/* -------------------------- Submission form -------------------------- */

function RequestForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Could not send that. Try again.");
      }
      return payload as { request: FeatureRequest };
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setStatus({ kind: "success", message: "Sent — thank you." });
      qc.invalidateQueries({ queryKey: ["feature-requests"] });
    },
    onError: (e: Error) => setStatus({ kind: "error", message: e.message }),
  });

  // The server is the real check (see validateFeatureRequest); this only
  // stops the obviously-empty submit from making a round trip.
  const canSubmit = title.trim().length > 0 && !submit.isPending;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setStatus({ kind: "saving" });
        submit.mutate();
      }}
    >
      <div>
        <label htmlFor="fr-title" className="field-label block mb-2">
          Title
        </label>
        <input
          id="fr-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Export closed positions to CSV"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="fr-body" className="field-label block mb-2">
          Details <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          id="fr-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY_LENGTH}
          rows={5}
          placeholder="What are you trying to do, and where does the current dashboard get in the way?"
          className="field-input !rounded-xl resize-y leading-relaxed"
        />
        <p className="font-mono text-[11px] text-text-dim mt-1.5 text-right">
          {body.length}/{MAX_BODY_LENGTH}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-outline !py-2.5 !px-6 !text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submit.isPending ? "Sending…" : "Send request"}
        </button>
        <StatusMessage status={status} />
      </div>
    </form>
  );
}

/* -------------------------- Your requests -------------------------- */

function YourRequests() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feature-requests"],
    queryFn: async () => {
      const res = await fetch("/api/feature-requests", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load requests");
      return (await res.json()) as { requests: FeatureRequest[] };
    },
  });

  const requests = data?.requests ?? [];

  return (
    <section className="space-y-3">
      <p className="panel-label">YOUR REQUESTS</p>
      {isLoading && <Skeleton className="h-24 w-full" />}
      {error && (
        <p className="text-accent-red text-sm">Could not load your requests.</p>
      )}
      {data && (
        <div className="data-panel divide-y divide-border">
          {requests.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
          {requests.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">
              Nothing yet. Your requests and their status will show up here.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RequestRow({ request }: { request: FeatureRequest }) {
  return (
    <div className="px-4 py-3.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="font-sans text-[14px] font-semibold text-text">
          {request.title}
        </p>
        <span className={`badge shrink-0 ${STATUS_BADGE_CLASS[request.status]}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </div>
      {request.body && (
        <p className="font-sans text-[13px] text-text-muted leading-relaxed whitespace-pre-wrap">
          {request.body}
        </p>
      )}
      <p className="font-mono text-[11px] text-text-dim">
        {new Date(request.createdAt).toLocaleDateString()}
      </p>
      {/* The reply from triage. Worth more visual weight than the request
          itself — it is the part the member came back to read. */}
      {request.adminNote && (
        <div className="rounded-soft border border-border bg-bg-secondary px-3 py-2 mt-2">
          <p className="field-label mb-1">Response</p>
          <p className="font-sans text-[13px] text-text-muted leading-relaxed whitespace-pre-wrap">
            {request.adminNote}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Shared form bits -------------------------- */

type FormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function StatusMessage({ status }: { status: FormStatus }) {
  if (status.kind === "idle" || status.kind === "saving") return null;
  if (status.kind === "success") {
    return (
      <span className="font-mono text-[11px] text-accent-green flex items-center gap-1.5">
        <Check size={12} />
        {status.message}
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-accent-red flex items-center gap-1.5">
      <AlertCircle size={12} />
      {status.message}
    </span>
  );
}
