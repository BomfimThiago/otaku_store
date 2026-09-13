/**
 * Pluggable static evals (FR9, SPEC §9.4). The engine ships the *framework* —
 * an interface + registry — and one generic built-in (diff size, SPEC §7). The
 * project-specific evals for the store are registered here later; they are never
 * baked into the generic engine.
 */

export interface EvalContext {
  cwd: string;
  /** Files changed by the run's diff, relative to the repo root. */
  changedFiles: string[];
}

export interface EvalResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Eval {
  name: string;
  run(ctx: EvalContext, options?: Record<string, unknown>): Promise<EvalResult> | EvalResult;
}

export type EvalRegistry = Map<string, Eval>;

/** Generic guard against sprawling diffs (SPEC §7). */
export const diffSizeEval: Eval = {
  name: "diff-size",
  run(ctx, options) {
    const maxFiles = Number(options?.["maxFiles"] ?? 20);
    const passed = ctx.changedFiles.length <= maxFiles;
    return {
      name: "diff-size",
      passed,
      detail: `${ctx.changedFiles.length} file(s) changed (max ${maxFiles})`,
    };
  },
};

/** Registry preloaded with the generic built-ins. */
export function defaultRegistry(): EvalRegistry {
  return new Map<string, Eval>([[diffSizeEval.name, diffSizeEval]]);
}
