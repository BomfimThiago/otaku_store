/**
 * Node contracts and loop rules for the worker state machine (SPEC §5.2, §4).
 *
 * A node handler is where the *work* happens (agent call, git, lint, …). The
 * state machine stays deterministic: it only interprets a handler's outcome to
 * decide the next node, the attempt ceiling and escalation. Handlers are
 * injectable so the engine can be tested without real agents, and so the real
 * implementations plug in later without touching the routing.
 */
import type { BlueprintNode, EscalationTrigger } from "../types/common.js";
import type { JudgeVerdict } from "../types/judge.js";
import type { MinionConfig } from "../types/config.js";
import type { Run } from "../types/run.js";

export interface NodeContext {
  run: Run;
  /** 1-based attempt for looping nodes (judge/harness); 1 otherwise. */
  attempt: number;
  config: MinionConfig;
}

export type NodeOutcome =
  /** Node succeeded; `verdict` present for approving Judge nodes. */
  | { kind: "ok"; summary?: string; verdict?: JudgeVerdict }
  /** Conditional/deterministic node did not apply (e.g. E2E with no frontend). */
  | { kind: "skip"; reason: string }
  /** A Judge rejected — loops back per LOOPS, bounded by the attempt ceiling. */
  | { kind: "reject"; verdict: JudgeVerdict }
  /** A deterministic/agent node failed. */
  | { kind: "fail"; reason: string };

export type NodeHandler = (ctx: NodeContext) => Promise<NodeOutcome> | NodeOutcome;
export type NodeHandlers = Partial<Record<BlueprintNode, NodeHandler>>;

/**
 * Loop-back rules (SPEC §4). A rejection/failure at `trigger` re-runs from
 * `retryTo`; after `attemptCeiling` occurrences the run escalates via
 * `escalation`. The three harness nodes share one ceiling ("harness fails
 * twice"), while each Judge has its own.
 */
export interface LoopSpec {
  trigger: BlueprintNode;
  retryTo: BlueprintNode;
  escalation: EscalationTrigger;
}

export const LOOPS: readonly LoopSpec[] = [
  { trigger: "judge_plan", retryTo: "plan", escalation: "plan_judge_rejected_twice" },
  { trigger: "judge_impl", retryTo: "implement", escalation: "impl_judge_rejected_twice" },
  { trigger: "static_evals", retryTo: "implement", escalation: "harness_failed_twice" },
  { trigger: "lint_tests", retryTo: "implement", escalation: "harness_failed_twice" },
  { trigger: "e2e", retryTo: "implement", escalation: "harness_failed_twice" },
] as const;

export function loopFor(node: BlueprintNode): LoopSpec | undefined {
  return LOOPS.find((l) => l.trigger === node);
}
