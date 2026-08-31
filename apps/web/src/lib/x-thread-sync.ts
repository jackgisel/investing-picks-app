import {
  claimThreadForPosting,
  createThreadDraft,
  listThreadsReadyToPost,
  recordThreadResult,
  releaseThreadClaim,
  type XThread,
  type XThreadKind,
} from "@/lib/x-threads-db";
import {
  fetchThreadFacts,
  generateThreadDraft,
  threadDedupeKey,
  type ThreadKind,
} from "@/lib/x-thread-draft";
import {
  estimateCostUsd,
  postThread,
  threadUrl,
  xCredentialsFromEnv,
} from "@/lib/x-client";

/**
 * Orchestration for X threads: draft on a schedule, post only what an admin
 * confirmed.
 *
 * The worker POSTs into these two functions. Neither ever throws for an
 * expected condition — a missing API key, an unconfirmed draft, an empty queue
 * are all `skipped` results, because they are scheduled sweeps and a thrown
 * exception would turn "nothing to do" into a paged failure.
 */

export type DraftThreadResult = {
  kind: ThreadKind;
  dedupeKey: string;
  generated: boolean;
  skipped?: "already_drafted";
  threadId?: string;
  posts?: string[];
  estimatedCostUsd?: number;
  error?: string;
};

export type PostThreadsResult = {
  attempted: number;
  posted: number;
  failed: number;
  skipped?: "no_credentials" | "nothing_confirmed";
  results: {
    threadId: string;
    kind: XThreadKind;
    url?: string;
    postedCount: number;
    error?: string;
  }[];
};

/**
 * Draft a thread for this week, or leave the existing one alone.
 *
 * The draft is written to the database BEFORE anything is returned, so a
 * caller that times out still finds the work when it comes back. An existing
 * row is never overwritten — an admin may already have edited it by hand.
 */
export async function draftThread(
  kind: ThreadKind,
  now: Date = new Date(),
): Promise<DraftThreadResult> {
  const dedupeKey = threadDedupeKey(kind, now);

  try {
    const facts = await fetchThreadFacts(kind, now);

    // A week-ahead thread with no week-ahead facts is not a thin thread, it is
    // a different thread wearing the wrong header. The first production draft
    // ran with an empty `macro_readings` table and produced a backward-looking
    // review of the book labelled WEEK AHEAD, because the book facts were the
    // only thing in the payload it could write about. Refusing is the correct
    // outcome: the macro pull runs 90 minutes earlier for exactly this reason,
    // and if it did not land, the fix is to run it, not to publish around it.
    if (kind === "sunday_review" && !facts.macro) {
      return {
        kind,
        dedupeKey,
        generated: false,
        error:
          "No macro facts available — run the macro_refresh job first. " +
          "Drafting this without them produces a book review, not a week-ahead thread.",
      };
    }

    const draft = await generateThreadDraft(facts);
    const { thread, created } = await createThreadDraft({
      kind,
      dedupeKey,
      posts: draft.posts,
      facts: { ...facts, summary: draft.summary },
    });

    return {
      kind,
      dedupeKey,
      generated: created,
      skipped: created ? undefined : "already_drafted",
      threadId: thread.id,
      posts: thread.posts,
      estimatedCostUsd: estimateCostUsd(thread.posts),
    };
  } catch (e) {
    return {
      kind,
      dedupeKey,
      generated: false,
      error: e instanceof Error ? e.message : "Thread draft failed",
    };
  }
}

/**
 * Post one already-claimed thread and record what landed.
 *
 * Split out from the sweep so the ops "post now" button runs the identical
 * path. The claim has to happen before this is called.
 */
async function postClaimed(thread: XThread, handle: string) {
  const credentials = xCredentialsFromEnv();
  if (!credentials) {
    await releaseThreadClaim(thread.id);
    return {
      threadId: thread.id,
      kind: thread.kind,
      postedCount: 0,
      error: "X credentials are not configured",
    };
  }

  const result = await postThread(credentials, thread.posts);
  const postedIds = result.posted.map((p) => p.id);

  // Nothing left the building — pre-flight rejection, or the very first
  // request threw. Release so a fixed draft can be retried; anything partial
  // stays claimed and is recorded as failed.
  if (postedIds.length === 0) {
    await releaseThreadClaim(thread.id);
    return {
      threadId: thread.id,
      kind: thread.kind,
      postedCount: 0,
      error: result.error ?? "Nothing was posted",
    };
  }

  await recordThreadResult(thread.id, {
    postedIds,
    failedAtIndex: result.failedAt,
    error: result.error,
  });

  return {
    threadId: thread.id,
    kind: thread.kind,
    url: threadUrl(handle, postedIds[0]),
    postedCount: postedIds.length,
    error: result.error ?? undefined,
  };
}

/**
 * Post every confirmed thread waiting in the queue.
 *
 * Sequential, not parallel: the posts within a thread are already a chain, and
 * two threads racing on the same account is how the account trips automated
 * behaviour limits.
 */
export async function postConfirmedThreads(
  limit = 3,
): Promise<PostThreadsResult> {
  const handle = process.env.X_HANDLE ?? "outpick";
  if (!xCredentialsFromEnv()) {
    return {
      attempted: 0,
      posted: 0,
      failed: 0,
      skipped: "no_credentials",
      results: [],
    };
  }

  const ready = await listThreadsReadyToPost(limit);
  if (ready.length === 0) {
    return {
      attempted: 0,
      posted: 0,
      failed: 0,
      skipped: "nothing_confirmed",
      results: [],
    };
  }

  const results: PostThreadsResult["results"] = [];
  for (const candidate of ready) {
    // Re-claim rather than trusting the list: another tick may have taken it
    // between the SELECT and here, and losing that race must mean skipping.
    const claimed = await claimThreadForPosting(candidate.id);
    if (!claimed) continue;
    results.push(await postClaimed(claimed, handle));
  }

  return {
    attempted: results.length,
    posted: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    results,
  };
}

/** The ops "post now" button: claim one specific thread and send it. */
export async function postThreadNow(
  id: string,
): Promise<PostThreadsResult["results"][number] | { error: string }> {
  const claimed = await claimThreadForPosting(id);
  if (!claimed) {
    return {
      error:
        "Thread is not postable — it must be a confirmed draft that has not been posted",
    };
  }
  return postClaimed(claimed, process.env.X_HANDLE ?? "outpick");
}
