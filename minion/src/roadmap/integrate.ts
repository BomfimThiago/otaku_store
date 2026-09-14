/**
 * Auto-merge to the integration branch (FR23, SPEC §5.1).
 *
 * As each backlog item's worker finishes, its branch is merged into `develop`,
 * so the next item builds on top of everything shipped so far. `develop`
 * accumulates the product; `main` only receives it on the final human-approved
 * promotion (the one merge that always needs a click, SPEC §4).
 *
 * The merge happens in a dedicated **git worktree** linked to the target repo, so
 * the engineer's own working tree (on `main`) is never touched. Item work reaches
 * the target repo by pushing the item's branch from its isolated clone (whose
 * `origin` is the target repo) — then the worktree merges it.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { run, type CommandResult } from "../util/exec.js";

export interface MergeResult {
  ok: boolean;
  conflict: boolean;
  output: string;
}

type GitRunner = (args: string[], cwd?: string) => Promise<CommandResult>;

const defaultGit: GitRunner = (args, cwd) =>
  run("git", cwd !== undefined ? ["-C", cwd, ...args] : args);

export class Integrator {
  private readonly worktreeDir: string;

  constructor(
    private readonly repoRoot: string,
    private readonly integrationBranch: string,
    worktreeDir: string,
    private readonly git: GitRunner = defaultGit,
  ) {
    this.worktreeDir = path.resolve(worktreeDir);
  }

  /** Ensure `integrationBranch` exists (branched from `baseBranch` if new) and a
   *  clean worktree is checked out on it. Idempotent across runs. */
  async prepare(baseBranch: string): Promise<void> {
    const exists = await this.git(["rev-parse", "--verify", "--quiet", this.integrationBranch], this.repoRoot);
    if (exists.code !== 0) {
      await this.expect(
        this.git(["branch", this.integrationBranch, baseBranch], this.repoRoot),
        `create ${this.integrationBranch}`,
      );
    }
    // Recreate the worktree fresh (remove a stale one first; ignore if absent).
    await this.git(["worktree", "remove", "--force", this.worktreeDir], this.repoRoot);
    await rm(this.worktreeDir, { recursive: true, force: true });
    await this.expect(
      this.git(["worktree", "add", "--force", this.worktreeDir, this.integrationBranch], this.repoRoot),
      "add worktree",
    );
  }

  /** Merge one item's branch into the integration branch. The item's clone pushes
   *  its branch to the target repo, then the worktree merges it (no-ff). */
  async merge(itemCloneDir: string, itemBranch: string): Promise<MergeResult> {
    const push = await this.git(["push", "origin", itemBranch], itemCloneDir);
    if (push.code !== 0) {
      return { ok: false, conflict: false, output: `push failed: ${push.stderr.trim()}` };
    }
    const merge = await this.git(
      ["merge", "--no-ff", "-m", `Integrate ${itemBranch}`, itemBranch],
      this.worktreeDir,
    );
    if (merge.code === 0) return { ok: true, conflict: false, output: merge.stdout };
    const conflict = /conflict/i.test(merge.stdout + merge.stderr);
    if (conflict) await this.git(["merge", "--abort"], this.worktreeDir);
    return { ok: false, conflict, output: `${merge.stdout}${merge.stderr}` };
  }

  /** The commit the integration branch now points at (for reporting). */
  async head(): Promise<string> {
    const r = await this.git(["rev-parse", "--short", this.integrationBranch], this.repoRoot);
    return r.code === 0 ? r.stdout.trim() : "?";
  }

  private async expect(p: Promise<CommandResult>, what: string): Promise<CommandResult> {
    const r = await p;
    if (r.code !== 0) throw new Error(`git ${what} failed (exit ${r.code}): ${r.stderr.trim()}`);
    return r;
  }
}
