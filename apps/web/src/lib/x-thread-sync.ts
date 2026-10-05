import { autoConfirmDueIncomeVisuals, autoConfirmDueScheduledPosts, claimThreadForPosting, listThreadsReadyToPost, recordThreadResult, rejectThread, releaseThreadClaim, type XThread, type XThreadKind } from "@/lib/x-threads-db";
import { incomeVisualConfig, incomeVisualMedia } from "@/lib/income-visual/x";
import {
  postThread,
  postingAccount,
  threadUrl,
  xCredentialsFromEnv,
  type XCredentials,
} from "@/lib/x-client";

/**
 * Posting the X queue. Income visuals are the only thing drafted into it now;
 * the written thread formats are gone.
 *
 * The worker POSTs into these functions. Neither ever throws for an
 * expected condition — a missing API key, an unconfirmed draft, an empty queue
 * are all `skipped` results, because they are scheduled sweeps and a thrown
 * exception would turn "nothing to do" into a paged failure.
 */

export type PostThreadsResult = {
  attempted: number;
  posted: number;
  failed: number;
  skipped?: "no_credentials" | "nothing_confirmed" | "wrong_account";
  error?: string;
  results: {
    threadId: string;
    kind: XThreadKind;
    url?: string;
    postedCount: number;
    error?: string;
  }[];
};

/**
 * Post one already-claimed thread and record what landed.
 *
 * Split out from the sweep so the ops "post now" button runs the identical
 * path. The claim has to happen before this is called.
 */
async function postClaimed(
  thread: XThread,
  handle: string,
  credentials: XCredentials,
) {
  let firstPostMediaIds: string[] | undefined;
  if (
    thread.kind === "income_visual" ||
    thread.kind === "week_roundup" ||
    thread.kind === "workforce_visual" ||
    thread.kind === "jobs_visual" ||
    thread.kind === "headcount_visual" ||
    thread.kind === "revenue_visual" ||
    thread.kind === "pick_result"
  ) {
    const media = await incomeVisualMedia(thread, credentials);
    if (!media.ok) {
      await releaseThreadClaim(thread.id);
      if (media.reject) await rejectThread(thread.id);
      return {
        threadId: thread.id,
        kind: thread.kind,
        postedCount: 0,
        error: media.error,
      };
    }
    firstPostMediaIds = media.mediaIds;
  }

  const result = await postThread(credentials, thread.posts, { firstPostMediaIds });
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
  const credentials = xCredentialsFromEnv();
  if (!credentials) {
    return {
      attempted: 0,
      posted: 0,
      failed: 0,
      skipped: "no_credentials",
      results: [],
    };
  }
  const account = await postingAccount(credentials);
  if (!account.ok) {
    return {
      attempted: 0,
      posted: 0,
      failed: 0,
      skipped: "wrong_account",
      error: account.error,
      results: [],
    };
  }
  const handle = account.username;

  const visuals = incomeVisualConfig();
  if (visuals.autoPost) {
    await autoConfirmDueScheduledPosts();
    await autoConfirmDueIncomeVisuals(visuals.reviewHours);
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
    results.push(await postClaimed(claimed, handle, credentials));
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
  const credentials = xCredentialsFromEnv();
  if (!credentials) return { error: "X credentials are not configured" };
  const account = await postingAccount(credentials);
  if (!account.ok) return { error: account.error };

  const claimed = await claimThreadForPosting(id);
  if (!claimed) {
    return {
      error:
        "Thread is not postable — it must be a confirmed draft that has not been posted",
    };
  }
  return postClaimed(claimed, account.username, credentials);
}
