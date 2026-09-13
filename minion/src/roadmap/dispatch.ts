/**
 * Continuous, deterministic dispatch loop (FR22, SPEC §5.1).
 *
 * Fires every "ready" backlog item — no pending dependency and no conflicting
 * file lock — respecting a parallelism limit, until the backlog empties. It owns
 * no judgment: readiness is graph-derived, ordering is priority-derived, and the
 * per-item work is delegated to the injected `runItem` (the §5.2 worker).
 */
import type { Scheduler } from "../scheduler/index.js";
import type { Backlog, BacklogItem } from "../types/index.js";
import { computePriorities } from "./graph.js";

/** Terminal outcome of running one item through the worker. */
export type ItemOutcome = "done" | "failed" | "escalated";

export type RunItem = (item: BacklogItem) => Promise<ItemOutcome>;

export interface DispatchResult {
  done: string[];
  failed: string[];
  escalated: string[];
  /** Pending items whose dependencies never completed (blocked by a failure). */
  unreached: string[];
}

export interface DispatchOptions {
  parallelism: number;
}

/** Sort ready items: higher priority first, then id for a stable order. */
function orderReady(items: BacklogItem[], priorities: Map<string, number>): BacklogItem[] {
  return [...items].sort((a, b) => {
    const pa = priorities.get(a.id) ?? 0;
    const pb = priorities.get(b.id) ?? 0;
    if (pa !== pb) return pb - pa;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export async function dispatch(
  backlog: Backlog,
  scheduler: Scheduler,
  runItem: RunItem,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const items = backlog.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const priorities = computePriorities(items);
  for (const i of items) i.priority = priorities.get(i.id) ?? 0;

  const isDone = (id: string): boolean => byId.get(id)?.status === "done";
  const readyItems = (): BacklogItem[] =>
    orderReady(
      items.filter((i) => i.status === "pending" && i.dependsOn.every(isDone)),
      priorities,
    );

  const running = new Map<string, Promise<{ id: string; outcome: ItemOutcome }>>();
  const result: DispatchResult = { done: [], failed: [], escalated: [], unreached: [] };

  for (;;) {
    // Start phase: fill free slots with ready, lock-free items.
    for (const item of readyItems()) {
      if (running.size >= opts.parallelism) break;
      if (!scheduler.canAcquire(item.id, item.likelyFiles)) continue;
      scheduler.acquire(item.id, item.likelyFiles);
      item.status = "running";
      item.runId = item.id;
      running.set(
        item.id,
        runItem(item).then((outcome) => ({ id: item.id, outcome })),
      );
    }

    if (running.size === 0) break;

    // Wait for the next worker to settle, release its locks, record the outcome.
    const settled = await Promise.race(running.values());
    running.delete(settled.id);
    scheduler.release(settled.id);

    const item = byId.get(settled.id)!;
    if (settled.outcome === "done") {
      item.status = "done";
      result.done.push(item.id);
    } else {
      item.status = "failed";
      (settled.outcome === "escalated" ? result.escalated : result.failed).push(item.id);
    }
  }

  // Anything still pending is blocked behind a dependency that never completed.
  result.unreached = items.filter((i) => i.status === "pending").map((i) => i.id);
  return result;
}
