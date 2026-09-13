/**
 * A single worker run (SPEC §5.2). Persisted as `runs/run-<id>.json`; sole
 * writer is that run's async task (SPEC §9.2). This object is both the live
 * dashboard source and the reproducibility record (SPEC §4).
 */
import type {
  BlueprintNode,
  EscalationTrigger,
  ModelTier,
  NodeType,
  RunStatus,
  StepStatus,
  Timestamp,
} from "./common.js";
import type { Plan } from "./plan.js";
import type { JudgeVerdict } from "./judge.js";

/** One node of the blueprint as executed within a run. */
export interface BlueprintStep {
  node: BlueprintNode;
  type: NodeType;
  status: StepStatus;
  modelTier?: ModelTier;
  /** Current attempt / ceiling for looping nodes (SPEC §4). */
  attempt?: number;
  maxAttempts?: number;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;
  durationMs?: number;
  /** Card sub-text shown on the dashboard. */
  summary?: string;
  /** Why a conditional/deterministic node was skipped (e.g. E2E, no frontend files). */
  skippedReason?: string;
}

/** Aggregate counters surfaced on the run header (matches the mockup stats row). */
export interface RunStats {
  elapsedMs: number;
  modelCalls: number;
  strongCalls: number;
  tokens: number;
}

/** The target repository for a run. */
export interface RunRepo {
  name: string;
  /** Local path or git URL the clone is made from. */
  source: string;
}

export interface RunEscalation {
  trigger: EscalationTrigger;
  message: string;
  at: Timestamp;
}

export interface Run {
  id: string;
  /** Backlog item this run implements, when driven by the roadmap layer (SPEC §5.1). */
  itemId?: string;
  /** The free-text work item — task, spec, or issue (FR1). */
  workItem: string;
  repo: RunRepo;
  /** Isolated clone directory + dedicated branch (SPEC §2, §9.1). */
  cloneDir: string;
  branch: string;
  status: RunStatus;
  /** Item ids this run depends on (FR15). */
  dependsOn: string[];
  /** Files reserved by the scheduler, derived from the approved plan (FR14, §7). */
  lockedFiles: string[];
  plan?: Plan;
  steps: BlueprintStep[];
  verdicts: JudgeVerdict[];
  /** Path to the generated unified diff (kept out of the JSON to stay small). */
  diffPath?: string;
  stats: RunStats;
  escalation?: RunEscalation;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;
}
