/**
 * Runs lint, tests, static evals and (conditionally) E2E, and interprets the
 * results deterministically (SPEC §5.2 `harness_runner`). Judgment-free: a
 * non-zero exit code is a fail, an eval returns pass/fail, and E2E fires only
 * when the plan touches a frontend file (FR11).
 */
import { runShell, type CommandResult } from "../util/exec.js";
import { matchesAny } from "../util/glob.js";
import type { MinionConfig } from "../types/config.js";
import type { EvalContext, EvalRegistry, EvalResult } from "./evals.js";

export interface CommandCheck {
  passed: boolean;
  output: string;
}

export interface EvalsCheck {
  passed: boolean;
  results: EvalResult[];
}

/** Injectable shell runner so lint/test can be tested without real tools. */
export type ShellRunner = (command: string, cwd: string) => Promise<CommandResult>;

const defaultShell: ShellRunner = (command, cwd) => runShell(command, { cwd });

export class HarnessRunner {
  constructor(
    private readonly config: MinionConfig,
    private readonly registry: EvalRegistry,
    private readonly shell: ShellRunner = defaultShell,
  ) {}

  /** FR11: E2E runs only if the approved plan lists a frontend file. */
  shouldRunE2e(planFiles: string[]): boolean {
    return planFiles.some((f) => matchesAny(this.config.frontendGlobs, f));
  }

  lint(cwd: string): Promise<CommandCheck> {
    return this.command(this.config.commands.lint, cwd);
  }

  test(cwd: string): Promise<CommandCheck> {
    return this.command(this.config.commands.test, cwd);
  }

  /** Returns undefined when the project declares no E2E command. */
  async e2e(cwd: string): Promise<CommandCheck | undefined> {
    const cmd = this.config.commands.e2e;
    if (cmd === undefined) return undefined;
    return this.command(cmd, cwd);
  }

  async staticEvals(ctx: EvalContext): Promise<EvalsCheck> {
    const results: EvalResult[] = [];
    for (const ec of this.config.evals) {
      const evaluator = this.registry.get(ec.name);
      if (evaluator === undefined) {
        results.push({ name: ec.name, passed: false, detail: "unknown eval (not registered)" });
        continue;
      }
      results.push(await evaluator.run(ctx, ec.options));
    }
    return { passed: results.every((r) => r.passed), results };
  }

  private async command(command: string, cwd: string): Promise<CommandCheck> {
    const r = await this.shell(command, cwd);
    return { passed: r.code === 0, output: `${r.stdout}${r.stderr}`.trim() };
  }
}
