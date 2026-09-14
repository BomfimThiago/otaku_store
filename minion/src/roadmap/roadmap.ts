/**
 * The self-coordination layer (SPEC §5.1): turns one product spec into a built
 * product. It is the "maestro" that composes pieces already built and tested —
 * decomposition (roadmap-planner), backlog judging (backlog-judge), the
 * deterministic graph (graph.ts) and the dispatch loop (dispatch.ts) — and feeds
 * each ready item into the §5.2 worker.
 *
 * Judgment lives only in the two agent calls; ordering, readiness and locking are
 * pure code. The attempt ceiling (§4) bounds the decompose↔judge loop.
 */
import {
  parseBacklogItems,
  parseVerdict,
  runStructured,
  type AgentRunner,
} from "../agent/index.js";
import type { StateStore } from "../persistence/index.js";
import type { Scheduler } from "../scheduler/index.js";
import type { MinionConfig } from "../types/config.js";
import type { Backlog, BacklogItem, DependencyEdge } from "../types/backlog.js";
import { dispatch, type DispatchResult, type RunItem } from "./dispatch.js";
import { topologicalOrder } from "./graph.js";

export interface RoadmapDeps {
  agent: AgentRunner;
  store: StateStore;
  /** Dispatch-level lock table (across items, keyed on likelyFiles). */
  scheduler: Scheduler;
  config: MinionConfig;
  /** Runs one item through the worker blueprint (§5.2). */
  runItem: RunItem;
  log?: (message: string) => void;
  now?: () => string;
}

export interface RoadmapOptions {
  /** Cap the number of items dispatched (for cheap end-to-end tests). */
  maxItems?: number;
}

export interface RoadmapResult {
  status: "delivered" | "escalated";
  reason?: string;
  backlog?: Backlog;
  dispatch?: DispatchResult;
}

export async function runRoadmap(
  specPath: string,
  specContent: string,
  deps: RoadmapDeps,
  opts: RoadmapOptions = {},
): Promise<RoadmapResult> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => new Date().toISOString());

  // --- Decompose ↔ Judge, bounded by the attempt ceiling (FR19, FR20) ---
  let critique = "";
  let items: BacklogItem[] | undefined;

  for (let attempt = 1; attempt <= deps.config.attemptCeiling; attempt++) {
    log(`decomposing spec (attempt ${attempt}/${deps.config.attemptCeiling})…`);
    const decomposed = await runStructured(
      deps.agent,
      { agent: "roadmap-planner", prompt: decomposePrompt(specContent, critique) },
      parseBacklogItems,
    );
    const candidate: BacklogItem[] = decomposed.map((d) => ({ ...d, status: "pending" }));

    // Deterministic graph validation doubles as coverage-of-structure (FR20/FR21).
    try {
      topologicalOrder(candidate);
    } catch (err) {
      critique = `The dependency graph is invalid: ${err instanceof Error ? err.message : String(err)}. Fix the dependsOn references.`;
      log(`  graph invalid — ${critique}`);
      continue;
    }

    log(`  ${candidate.length} items — judging the backlog…`);
    const verdict = await runStructured(
      deps.agent,
      { agent: "backlog-judge", prompt: judgePrompt(specContent, decomposed) },
      parseVerdict,
    );
    if (verdict.verdict === "approved") {
      log(`  backlog approved (${verdict.score}/100)`);
      items = candidate;
      break;
    }
    critique = verdict.critique;
    log(`  backlog rejected (${verdict.score}/100) — ${critique}`);
  }

  if (items === undefined) {
    return { status: "escalated", reason: "backlog decomposition rejected up to the attempt ceiling" };
  }

  // --- Optional cap for cheap tests: keep the first N in topological order ---
  if (opts.maxItems !== undefined && opts.maxItems < items.length) {
    items = capItems(items, opts.maxItems);
    log(`capped to ${items.length} items for this run`);
  }

  // --- Persist the backlog + graph (FR21) ---
  const backlog: Backlog = {
    source: specPath,
    items,
    edges: buildEdges(items),
    createdAt: now(),
    updatedAt: now(),
  };
  await deps.store.writeBacklog(backlog);

  // --- Dispatch: fire ready items in parallel until the backlog empties (FR22) ---
  log(`dispatching ${items.length} items (parallelism ${deps.config.parallelism})…`);
  const result = await dispatch(backlog, deps.scheduler, deps.runItem, {
    parallelism: deps.config.parallelism,
  });
  backlog.updatedAt = now();
  await deps.store.writeBacklog(backlog);

  return { status: "delivered", backlog, dispatch: result };
}

// --- prompts ---

function decomposePrompt(spec: string, critique: string): string {
  return (
    `# Product specification\n\n${spec}` +
    (critique ? `\n\n# Backlog Judge critique to address\n${critique}` : "")
  );
}

function judgePrompt(spec: string, decomposed: unknown): string {
  return (
    `# Source specification\n\n${spec}\n\n` +
    `# Proposed backlog (decomposition to evaluate)\n\n` +
    "```json\n" +
    JSON.stringify({ items: decomposed }, null, 2) +
    "\n```"
  );
}

// --- pure helpers ---

function buildEdges(items: BacklogItem[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const item of items) {
    for (const dep of item.dependsOn) edges.push({ from: dep, to: item.id });
  }
  return edges;
}

/** First N items in topological order, with dangling dependsOn dropped so the
 *  capped subset stays valid and runnable. */
function capItems(items: BacklogItem[], n: number): BacklogItem[] {
  const order = topologicalOrder(items);
  const keep = new Set(order.slice(0, n));
  const byId = new Map(items.map((i) => [i.id, i]));
  return order
    .slice(0, n)
    .map((id) => byId.get(id)!)
    .map((i) => ({ ...i, dependsOn: i.dependsOn.filter((d) => keep.has(d)) }));
}
