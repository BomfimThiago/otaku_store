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

const SOURCE_RE = /\.(ts|tsx|js|jsx)$/;
const TEST_RE = /\.test\.(ts|tsx|js|jsx)$/;
const DEBUG_RE = [/console\s*\.\s*log\s*\(/, /\bdebugger\b/, /\.only\s*\(/];

/**
 * No debug leftovers in changed source (deterministic back pressure): no
 * `console.log`, `debugger`, or focused `.only(` tests slip into a PR.
 */
export const noDebugArtifactsEval: Eval = {
  name: "no-debug-artifacts",
  async run(ctx) {
    const { readFile } = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const sources = ctx.changedFiles.filter((f) => SOURCE_RE.test(f) && !TEST_RE.test(f));
    const offenders: string[] = [];
    for (const f of sources) {
      let text: string;
      try {
        text = await readFile(pathMod.join(ctx.cwd, f), "utf8");
      } catch {
        continue; // deleted/renamed file — nothing to read
      }
      text.split("\n").forEach((line, i) => {
        if (DEBUG_RE.some((re) => re.test(line))) offenders.push(`${f}:${i + 1}`);
      });
    }
    return {
      name: "no-debug-artifacts",
      passed: offenders.length === 0,
      detail: offenders.length
        ? `debug leftovers: ${offenders.slice(0, 6).join(", ")}${offenders.length > 6 ? " …" : ""}`
        : "no console.log / debugger / .only in changed source",
    };
  },
};

const FRONTEND_SRC_RE = /^store\/web\/src\/.+\.(ts|tsx)$/;

/**
 * TDD guard: if the diff touches frontend source, it must also ship at least one
 * test file — turns the spec's "tests-first" policy into a machine-checked gate.
 */
export const testsWithFrontendEval: Eval = {
  name: "tests-with-frontend",
  run(ctx) {
    const touchesFrontendSrc = ctx.changedFiles.some(
      (f) => FRONTEND_SRC_RE.test(f) && !TEST_RE.test(f),
    );
    const shipsTest = ctx.changedFiles.some((f) => TEST_RE.test(f));
    const passed = !touchesFrontendSrc || shipsTest;
    return {
      name: "tests-with-frontend",
      passed,
      detail: !touchesFrontendSrc
        ? "no frontend source changed — n/a"
        : shipsTest
          ? "frontend change ships with tests (TDD)"
          : "frontend source changed but no *.test.* file in the diff",
    };
  },
};

/** Registry preloaded with the generic + store evals. */
export function defaultRegistry(): EvalRegistry {
  return new Map<string, Eval>([
    [diffSizeEval.name, diffSizeEval],
    [noDebugArtifactsEval.name, noDebugArtifactsEval],
    [testsWithFrontendEval.name, testsWithFrontendEval],
  ]);
}
