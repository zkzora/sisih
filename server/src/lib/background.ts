/**
 * Background work that must finish even after the HTTP response is sent (memory writes, recall,
 * event inserts). On Vercel the route handler drains this with `after()`, which keeps the
 * function alive; in a long-running Node server it simply runs.
 */
const inflight = new Set<Promise<unknown>>();

export function background(task: Promise<unknown> | (() => Promise<unknown>)): void {
  const p = (typeof task === "function" ? task() : task)
    .catch((err) => console.error("background task failed:", (err as Error)?.message ?? err))
    .finally(() => inflight.delete(p));
  inflight.add(p);
}

/** Resolves once every task started so far (and any they start) has settled. */
export async function drainBackground(): Promise<void> {
  while (inflight.size) await Promise.allSettled([...inflight]);
}

export function backgroundCount(): number {
  return inflight.size;
}
