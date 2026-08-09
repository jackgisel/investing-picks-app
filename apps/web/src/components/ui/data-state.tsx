"use client";

import Link from "next/link";
import { AlertCircle, Inbox, Lock, LogIn, RefreshCw } from "lucide-react";
import { toApiError, type ApiErrorKind } from "@/lib/hooks/api-error";

/**
 * Terminal states for a data-backed panel.
 *
 * "loading" is the only non-terminal one. Everything else is a place the user
 * can actually stop and act, which is the whole point — a paywalled screen must
 * say "subscribe", not spin forever.
 */
export type DataStateKind =
  | "loading"
  | "unauthenticated"
  | "subscription"
  | "error"
  | "empty";

/**
 * Map a React Query result onto a display state.
 *
 * Order matters: error beats empty, because a failed query has no rows and
 * would otherwise be indistinguishable from a genuinely empty one.
 */
export function resolveDataState(args: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
}): DataStateKind | null {
  if (args.isError) {
    const kind: ApiErrorKind = toApiError(args.error).kind;
    if (kind === "unauthenticated") return "unauthenticated";
    if (kind === "subscription_required") return "subscription";
    return "error";
  }
  if (args.isPending) return "loading";
  if (args.isEmpty) return "empty";
  return null;
}

/** True when the panel should render `<DataState>` instead of its rows. */
export function hasDataState(state: DataStateKind | null): state is DataStateKind {
  return state !== null;
}

interface DataStateProps {
  state: DataStateKind;
  /** The query error, used only to show a detail line for "error". */
  error?: unknown;
  /** Refetch. Wired to the retry button. */
  onRetry?: () => void;
  /** Copy for the successful-but-zero-rows case. */
  emptyTitle?: string;
  emptyMessage?: string;
  /** Tightens the vertical padding for use inside dense table bodies. */
  compact?: boolean;
}

export function DataState({
  state,
  error,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  compact = false,
}: DataStateProps) {
  const pad = compact ? "py-8" : "py-12";

  if (state === "loading") {
    return (
      <div className={`px-5 ${pad} text-center`}>
        <span className="font-mono text-[11px] text-text-dim animate-pulse">
          LOADING...
        </span>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <Shell icon={Inbox} title={emptyTitle} pad={pad}>
        {emptyMessage && <Body>{emptyMessage}</Body>}
      </Shell>
    );
  }

  if (state === "unauthenticated") {
    return (
      <Shell icon={LogIn} title="Sign in to continue" pad={pad}>
        <Body>
          Your session has expired or you are not signed in. Sign in again to see
          your picks and portfolio.
        </Body>
        <Link href="/login" className="btn-outline mt-1">
          Sign in
        </Link>
      </Shell>
    );
  }

  if (state === "subscription") {
    return (
      <Shell icon={Lock} title="Members only" pad={pad}>
        <Body>
          Picks, holdings and trade history are part of the Outpick membership.
          Your account is signed in but does not have an active subscription.
        </Body>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
          <Link href="/subscribe" className="btn-primary !text-xs !px-6 !py-3">
            Start membership
          </Link>
          <Link
            href="/dashboard/settings"
            className="font-sans text-[12px] text-text font-semibold underline underline-offset-2 hover:opacity-70"
          >
            Check subscription status
          </Link>
        </div>
      </Shell>
    );
  }

  // state === "error"
  const apiError = toApiError(error);
  const isServer = apiError.kind === "server";
  return (
    <Shell icon={AlertCircle} title="Could not load this" pad={pad} tone="red">
      <Body>
        {isServer
          ? "The data service returned an error. This is on our side — try again in a moment."
          : "Something went wrong fetching this data."}
        {apiError.status > 0 && (
          <span className="font-mono text-text-dim"> ({apiError.status})</span>
        )}
      </Body>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline mt-1">
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </Shell>
  );
}

function Shell({
  icon: Icon,
  title,
  pad,
  tone = "dim",
  children,
}: {
  icon: React.ElementType;
  title: string;
  pad: string;
  tone?: "dim" | "red";
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`px-5 ${pad} flex flex-col items-center justify-center text-center gap-3`}
    >
      <Icon
        size={20}
        className={tone === "red" ? "text-accent-red" : "text-text-dim"}
      />
      <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
        {title}
      </span>
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[13px] text-text-muted max-w-[420px] leading-relaxed">
      {children}
    </p>
  );
}

/**
 * Same states, wrapped in a `data-card` — for pages that render a standalone
 * panel rather than a table body.
 */
export function DataStateCard(props: DataStateProps & { className?: string }) {
  const { className, ...rest } = props;
  return (
    <div className={`data-panel ${className ?? ""}`}>
      <DataState {...rest} />
    </div>
  );
}

/**
 * Same states, as a full-width table row. Tables need the `<tr><td colSpan>`
 * wrapper or the message renders squeezed into the first column.
 */
export function DataStateRow({
  colSpan,
  ...rest
}: DataStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <DataState {...rest} compact />
      </td>
    </tr>
  );
}
