/**
 * Per-run isolation (SPEC §2, §9.1): a fresh clone of the target repo plus a
 * dedicated branch, created and destroyed automatically. A `git worktree` alone
 * is not enough — two runs on the same underlying repo can still collide — so
 * each run gets its own clone.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { run, type CommandResult } from "../util/exec.js";

export interface Isolation {
  cloneDir: string;
  branch: string;
}

/** Injectable git runner (real git by default) so the manager is testable. */
export type GitRunner = (args: string[], cwd?: string) => Promise<CommandResult>;

const defaultGit: GitRunner = (args, cwd) =>
  run("git", cwd !== undefined ? ["-C", cwd, ...args] : args);

export class EnvManager {
  constructor(
    private readonly clonesRoot: string,
    private readonly git: GitRunner = defaultGit,
  ) {}

  /** Clone `source` at `baseBranch` and branch off `minion/<runId>`. */
  async create(runId: string, source: string, baseBranch: string): Promise<Isolation> {
    const cloneDir = path.join(path.resolve(this.clonesRoot), `run-${runId}`);
    const branch = `minion/${runId}`;

    await this.expect(this.git(["clone", source, cloneDir]), "clone");
    await this.expect(this.git(["checkout", baseBranch], cloneDir), `checkout ${baseBranch}`);
    await this.expect(this.git(["checkout", "-b", branch], cloneDir), `branch ${branch}`);

    return { cloneDir, branch };
  }

  /** Remove the isolated clone. Idempotent. */
  async destroy(cloneDir: string): Promise<void> {
    await rm(cloneDir, { recursive: true, force: true });
  }

  private async expect(p: Promise<CommandResult>, what: string): Promise<CommandResult> {
    const r = await p;
    if (r.code !== 0) {
      throw new Error(`git ${what} failed (exit ${r.code}): ${r.stderr.trim()}`);
    }
    return r;
  }
}
