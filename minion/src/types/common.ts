/**
 * Shared enums and unions used across the Minion schemas.
 * See SPEC.md §5 (node taxonomy), §4 (attempt ceiling, escalation triggers).
 */

/** ISO-8601 timestamp string, e.g. "2026-09-13T14:02:07.000Z". */
export type Timestamp = string;

/** Model tiering (SPEC §4): strong for planning/judging, fast for implementation. */
export type ModelTier = "strong" | "fast";

/** Node taxonomy used throughout the blueprint and dashboard. */
export type NodeType = "det" | "agent" | "judge";

/** Per-node state inside a run's blueprint. */
export type StepStatus = "pending" | "active" | "done" | "failed" | "skipped";

/** High-level status of a whole run (matches the dashboard sidebar cards). */
export type RunStatus =
  | "queued"
  | "blocked"
  | "running"
  | "done"
  | "failed"
  | "escalated";

/** Status of a backlog item in the roadmap layer (SPEC §5.1). */
export type ItemStatus =
  | "pending"
  | "ready"
  | "blocked"
  | "running"
  | "done"
  | "failed";

/** MVP vs nice-to-have — feeds the deterministic priority score (FR21). */
export type ItemWeight = "mvp" | "nice-to-have";

/** The ordered nodes of the per-item worker blueprint (SPEC §5.2). */
export type BlueprintNode =
  | "schedule"
  | "isolate"
  | "context"
  | "plan"
  | "judge_plan"
  | "implement"
  | "judge_impl"
  | "static_evals"
  | "lint_tests"
  | "e2e"
  | "sync"
  | "open_pr";

/** The four Judge roles (SPEC §5.1 / §5.2). */
export type JudgeKind = "plan" | "implementation" | "backlog" | "product";

/**
 * The fixed human-escalation triggers (SPEC §4). The only points where the
 * pipeline stops and asks for a human.
 */
export type EscalationTrigger =
  | "plan_judge_rejected_twice"
  | "impl_judge_rejected_twice"
  | "harness_failed_twice"
  | "conflict_outside_plan_scope"
  | "conflict_persists_after_resolution"
  | "backlog_judge_rejected_twice"
  | "product_judge_rejected_twice"
  | "promote_develop_to_main";
