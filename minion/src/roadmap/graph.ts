/**
 * Deterministic dependency graph + priority (FR21). No LLM decides execution
 * order at runtime: order comes from a topological sort, priority from a pure
 * formula. An edge A→B means "A must precede B" (i.e. B dependsOn A).
 */
import type { BacklogItem, ItemWeight } from "../types/index.js";

const WEIGHT: Record<ItemWeight, number> = {
  mvp: 2,
  "nice-to-have": 1,
};

/** Map each item id to the items that directly depend on it (its dependents). */
function dependents(items: BacklogItem[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const i of items) adj.set(i.id, []);
  for (const i of items) {
    for (const dep of i.dependsOn) {
      const list = adj.get(dep);
      if (list) list.push(i.id);
    }
  }
  return adj;
}

/**
 * Priority = (transitive dependents) × weight (FR21). An item many others wait
 * on, and MVP work, sort first.
 */
export function computePriorities(items: BacklogItem[]): Map<string, number> {
  const adj = dependents(items);

  const transitiveCount = (id: string): number => {
    const seen = new Set<string>();
    const stack = [...(adj.get(id) ?? [])];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of adj.get(n) ?? []) stack.push(m);
    }
    return seen.size;
  };

  const priorities = new Map<string, number>();
  for (const i of items) priorities.set(i.id, transitiveCount(i.id) * WEIGHT[i.weight]);
  return priorities;
}

/**
 * Kahn's topological sort, tie-broken by id for determinism. Throws on an
 * unknown dependency or a cycle (used by backlog validation, FR20).
 */
export function topologicalOrder(items: BacklogItem[]): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const indegree = new Map<string, number>();
  const adj = dependents(items);
  for (const i of items) indegree.set(i.id, 0);
  for (const i of items) {
    for (const dep of i.dependsOn) {
      if (!byId.has(dep)) {
        throw new Error(`item "${i.id}" depends on unknown item "${dep}"`);
      }
      indegree.set(i.id, (indegree.get(i.id) ?? 0) + 1);
    }
  }

  const ready = items
    .filter((i) => (indegree.get(i.id) ?? 0) === 0)
    .map((i) => i.id)
    .sort();

  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const dependent of adj.get(id) ?? []) {
      const d = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, d);
      if (d === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  if (order.length !== items.length) {
    const inCycle = items.filter((i) => !order.includes(i.id)).map((i) => i.id);
    throw new Error(`dependency cycle among: ${inCycle.join(", ")}`);
  }
  return order;
}
