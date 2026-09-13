/**
 * The ordered per-item worker blueprint (SPEC §5.2), as data.
 *
 * The orchestrator's state machine walks this list; the dashboard renders it as
 * the vertical rail. Keeping it as a single declarative source avoids the node
 * order drifting between the engine and the UI.
 */
import type { BlueprintNode, NodeType } from "./types/common.js";

export interface BlueprintNodeSpec {
  node: BlueprintNode;
  type: NodeType;
  /** Human label shown on the dashboard card. */
  label: string;
  /** Model tier for agent/judge nodes; undefined for deterministic nodes. */
  tier?: "strong" | "fast";
  /** Conditional nodes only run when a predicate holds (e.g. E2E on frontend). */
  conditional?: boolean;
  /** Nodes that can loop back on rejection/failure, bounded by the attempt ceiling. */
  loops?: boolean;
}

export const BLUEPRINT_NODES: readonly BlueprintNodeSpec[] = [
  { node: "schedule", type: "det", label: "Schedule / lock files" },
  { node: "isolate", type: "det", label: "Isolate environment" },
  { node: "context", type: "agent", label: "Gather context", tier: "fast" },
  { node: "plan", type: "agent", label: "Present plan", tier: "strong" },
  { node: "judge_plan", type: "judge", label: "Judge · plan", tier: "strong", loops: true },
  { node: "implement", type: "agent", label: "Implement", tier: "fast", loops: true },
  { node: "judge_impl", type: "judge", label: "Judge · implementation", tier: "strong", loops: true },
  { node: "static_evals", type: "det", label: "Static evals" },
  { node: "lint_tests", type: "det", label: "Lint + tests", loops: true },
  { node: "e2e", type: "det", label: "E2E (Playwright)", conditional: true },
  { node: "sync", type: "det", label: "Sync with main" },
  { node: "open_pr", type: "det", label: "Open PR" },
] as const;

/** Convenience lookup by node id. */
export const BLUEPRINT_BY_NODE: Readonly<Record<BlueprintNode, BlueprintNodeSpec>> =
  Object.fromEntries(BLUEPRINT_NODES.map((n) => [n.node, n])) as Record<
    BlueprintNode,
    BlueprintNodeSpec
  >;
