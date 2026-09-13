/**
 * Project-specific configuration (SPEC §9.4), read from a `minion.config.json`
 * in the target repo. This is what keeps the evals and commands out of the
 * generic engine — they are declared per project (the store), not hardcoded.
 */

/** A pluggable static eval (FR9). The engine looks up `name` in its eval registry. */
export interface EvalConfig {
  name: string;
  /** Eval-specific thresholds/options, validated by that eval. */
  options?: Record<string, unknown>;
}

export interface MinionConfig {
  repo: {
    /** Local path or git URL cloned per run (SPEC §2). */
    source: string;
    /** Branch runs rebase against and branch from (SPEC §5.2). */
    defaultBranch: string;
    /** Integration branch that passing PRs auto-merge into (FR23). */
    integrationBranch: string;
  };
  commands: {
    lint: string;
    test: string;
    /** Deterministic Playwright suite (FR11); omitted if the project has none. */
    e2e?: string;
  };
  /** Static evals to run, in order (FR9). */
  evals: EvalConfig[];
  /** Globs that mark a file as frontend — decides whether E2E fires (FR11). */
  frontendGlobs: string[];
  /** Max runs executing at once in the dispatch loop (FR22). */
  parallelism: number;
  /** Attempt ceiling for every automatic correction loop (SPEC §4). */
  attemptCeiling: number;
}
