"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/comments/avatar";
import {
  ANONYMOUS_NAME,
  MAX_COMMENT_LENGTH,
  type SubjectType,
} from "@/lib/comments";

type Comment = {
  id: string;
  parentId: string | null;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: { id: string; displayName: string | null };
  canDelete: boolean;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Comments on a blog post or research note.
 *
 * Replies are one level deep — `createComment` flattens anything deeper — so
 * this renders exactly two tiers rather than recursing.
 */
export function CommentThread({
  subjectType,
  subjectSlug,
}: {
  subjectType: SubjectType;
  subjectSlug: string;
}) {
  const qc = useQueryClient();
  const key = ["comments", subjectType, subjectSlug];
  const params = `type=${subjectType}&slug=${encodeURIComponent(subjectSlug)}`;

  const thread = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/comments?${params}`, { cache: "no-store" });
      if (res.status === 403) return { comments: [] as Comment[], gated: true };
      if (!res.ok) throw new Error("Could not load comments");
      const body = (await res.json()) as { comments: Comment[] };
      return { comments: body.comments, gated: false };
    },
  });

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);

  const post = useMutation({
    mutationFn: async (vars: { body: string; parentId: string | null }) => {
      const res = await fetch(`/api/comments?${params}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: vars.body, parent_id: vars.parentId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(payload.error || "Could not post"), {
          code: payload.code,
        });
      }
      return payload;
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      setError(null);
      setNeedsName(false);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error & { code?: string }) => {
      setNeedsName(e.code === "no_display_name");
      setError(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove that comment");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  if (thread.data?.gated) return null;

  const comments = thread.data?.comments ?? [];
  const roots = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);
  const liveCount = comments.filter((c) => !c.deleted).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    post.mutate({ body: trimmed, parentId: replyTo });
  };

  return (
    <section className="mt-16 border-t border-border pt-10" id="comments">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h2 className="font-sans text-[19px] font-bold tracking-tight">
          Discussion
        </h2>
        <span className="font-mono text-[11px] text-text-dim">
          {thread.isPending ? "—" : `${liveCount} COMMENT${liveCount === 1 ? "" : "S"}`}
        </span>
      </div>

      {thread.isError && (
        <p className="font-sans text-[13px] text-accent-red">
          Could not load the discussion.
        </p>
      )}

      <form onSubmit={submit} className="mb-10">
        {replyTo && (
          <div className="mb-2 flex items-center gap-3">
            <span className="font-mono text-[11px] text-text-dim">
              Replying to a comment
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="font-mono text-[11px] text-text-muted underline underline-offset-2 hover:text-text"
            >
              cancel
            </button>
          </div>
        )}
        <label htmlFor="comment-body" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={4}
          placeholder="Add your read on this…"
          className="w-full resize-y rounded-soft border border-border bg-bg-secondary px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-[18px]">
            {error && (
              <p className="font-sans text-[12px] text-accent-red">
                {error}{" "}
                {needsName && (
                  <Link
                    href="/dashboard/settings#profile"
                    className="underline underline-offset-2"
                  >
                    Set one
                  </Link>
                )}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={post.isPending || !body.trim()}
            className="btn-primary !py-2 !px-5 !text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {post.isPending ? "Posting…" : replyTo ? "Reply" : "Comment"}
          </button>
        </div>
      </form>

      {!thread.isPending && roots.length === 0 && (
        <p className="font-sans text-[14px] text-text-muted">
          No comments yet. Start the discussion.
        </p>
      )}

      <ul className="space-y-8">
        {roots.map((c) => (
          <li key={c.id}>
            <CommentBody
              comment={c}
              onReply={() => setReplyTo(c.id)}
              onDelete={() => remove.mutate(c.id)}
            />
            {repliesOf(c.id).length > 0 && (
              <ul className="mt-6 space-y-6 border-l border-border pl-5 sm:pl-6">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentBody
                      comment={r}
                      onReply={() => setReplyTo(c.id)}
                      onDelete={() => remove.mutate(r.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentBody({
  comment,
  onReply,
  onDelete,
}: {
  comment: Comment;
  onReply: () => void;
  onDelete: () => void;
}) {
  // A removed comment keeps its slot rather than vanishing: replies hang off
  // it, and a thread that silently reshuffles reads as if someone's words were
  // rewritten rather than withdrawn.
  if (comment.deleted) {
    return (
      <p className="font-sans text-[13px] italic text-text-dim">
        This comment was removed.
      </p>
    );
  }

  const name = comment.author.displayName?.trim() || ANONYMOUS_NAME;

  return (
    <article className="flex gap-3.5">
      <Avatar userId={comment.author.id} displayName={name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-sans text-[13px] font-semibold text-text">
            {name}
          </span>
          <time
            dateTime={comment.createdAt}
            className="font-mono text-[11px] text-text-dim"
          >
            {timeAgo(comment.createdAt)}
          </time>
          {comment.editedAt && (
            <span className="font-mono text-[11px] text-text-dim">edited</span>
          )}
        </div>
        {/* Rendered as text, never as markup: this is user input on a page we
            also serve research from. */}
        <p className="mt-1.5 whitespace-pre-wrap break-words font-sans text-[14px] leading-relaxed text-text-muted">
          {comment.body}
        </p>
        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            onClick={onReply}
            className="font-mono text-[11px] text-text-dim transition-colors hover:text-text"
          >
            Reply
          </button>
          {comment.canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-text-dim transition-colors hover:text-accent-red"
            >
              <Trash2 size={11} aria-hidden />
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
