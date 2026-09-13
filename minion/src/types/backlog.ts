/**
 * The roadmap layer's state (SPEC §5.1). Persisted as `backlog.json`; sole
 * writer is the orchestrator (SPEC §9.1/§9.2).
 */
import type { ItemStatus, ItemWeight, Timestamp } from "./common.js";

export interface BacklogItem {
  id: string;
  description: string;
  /** Testable acceptance criteria (FR19). */
  acceptanceCriteria: string[];
  /** Files the item is expected to touch (FR19); informs scheduling. */
  likelyFiles: string[];
  /** Ids of items that must complete first (FR15). */
  dependsOn: string[];
  weight: ItemWeight;
  status: ItemStatus;
  /** Deterministic priority: unblocked-count × weight (FR21); set by the planner. */
  priority?: number;
  /** The run currently (or last) implementing this item. */
  runId?: string;
}

/** A directed edge in the dependency graph (FR21): `from` must precede `to`. */
export interface DependencyEdge {
  from: string;
  to: string;
}

export interface Backlog {
  /** Path/identifier of the source specification (FR18). */
  source: string;
  items: BacklogItem[];
  edges: DependencyEdge[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
