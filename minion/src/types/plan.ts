/**
 * The plan produced before any edit (FR4) and reused three times (SPEC §7):
 * as the implementation Judge's answer key, as the scheduler's lock key, and as
 * the deterministic predicate for whether E2E fires.
 */

export interface Plan {
  /** One-line summary of the approach. */
  summary: string;
  /** Ordered implementation steps. */
  steps: string[];
  /** Files the plan intends to touch — the single source of truth for locking + E2E. */
  files: string[];
  /** New dependencies the plan introduces, if any. */
  newDependencies: string[];
}
