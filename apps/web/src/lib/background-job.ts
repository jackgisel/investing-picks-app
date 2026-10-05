/**
 * In-process background jobs for the admin pages whose model calls outlast a
 * proxy timeout.
 *
 * The edge in front of the web service cuts a request off at about 100 seconds
 * (a 524), and research plus a draft takes longer. So the POST starts the work
 * and returns at once, the work keeps running on the server, and the page polls
 * `jobStatus`. State lives in this process: a restart loses a running job, and
 * the admin just starts it again. There is one web instance, so that is enough.
 */

export type JobStatus<T = unknown> =
  | { state: "idle" }
  | { state: "running"; startedAt: number }
  | { state: "done"; result: T; finishedAt: number }
  | { state: "error"; error: string; finishedAt: number };

const KEEP_MS = 30 * 60 * 1000;

type StoredJob = Exclude<JobStatus, { state: "idle" }>;

const store = ((globalThis as { __bgJobs?: Map<string, StoredJob> }).__bgJobs ??=
  new Map<string, StoredJob>());

export function jobStatus<T = unknown>(key: string): JobStatus<T> {
  const job = store.get(key);
  if (!job) return { state: "idle" };
  if (job.state !== "running" && Date.now() - job.finishedAt > KEEP_MS) {
    store.delete(key);
    return { state: "idle" };
  }
  return job as JobStatus<T>;
}

/** Start `fn` unless this key is already running. Returns false when it was already running. */
export function startJob<T>(key: string, fn: () => Promise<T>): boolean {
  if (store.get(key)?.state === "running") return false;
  store.set(key, { state: "running", startedAt: Date.now() });
  void fn().then(
    (result) => store.set(key, { state: "done", result, finishedAt: Date.now() }),
    (e: unknown) =>
      store.set(key, {
        state: "error",
        error: e instanceof Error ? e.message : "Draft failed",
        finishedAt: Date.now(),
      }),
  );
  return true;
}
