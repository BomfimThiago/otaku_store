/**
 * Git/GitHub operations the worker nodes need (SPEC §5.2: isolate, sync, PR).
 * Behind an interface so handlers are testable with a fake and the real git/gh
 * calls stay in one place. Deterministic side of the pipeline — no LLM here.
 */
import { EnvManager } from "../env/index.js";
import { run as execRun } from "../util/exec.js";

export interface Isolation {
  cloneDir: string;
  branch: string;
}

export interface RebaseResult {
  ok: boolean;
  conflict: boolean;
  output: string;
}

export interface PrResult {
  url: string;
}

export interface RepoOps {
  isolate(runId: string, source: string, baseBranch: string): Promise<Isolation>;
  changedFiles(cloneDir: string): Promise<string[]>;
  /** Stage everything and commit; returns false if there was nothing to commit. */
  commitAll(cloneDir: string, message: string): Promise<boolean>;
  rebaseOntoBase(cloneDir: string, baseBranch: string): Promise<RebaseResult>;
  openPr(cloneDir: string, branch: string, base: string, title: string, body: string): Promise<PrResult>;
  teardown(cloneDir: string): Promise<void>;
}

export class GitRepoOps implements RepoOps {
  constructor(private readonly env: EnvManager) {}

  isolate(runId: string, source: string, baseBranch: string): Promise<Isolation> {
    return this.env.create(runId, source, baseBranch);
  }

  teardown(cloneDir: string): Promise<void> {
    return this.env.destroy(cloneDir);
  }

  async changedFiles(cloneDir: string): Promise<string[]> {
    const r = await execRun("git", ["-C", cloneDir, "status", "--porcelain"]);
    // Porcelain lines are "XY <path>"; the path starts at column 3.
    return r.stdout
      .split("\n")
      .filter((l) => l.length > 3)
      .map((l) => l.slice(3).trim());
  }

  async commitAll(cloneDir: string, message: string): Promise<boolean> {
    await execRun("git", ["-C", cloneDir, "add", "-A"]);
    const staged = await execRun("git", ["-C", cloneDir, "diff", "--cached", "--quiet"]);
    if (staged.code === 0) return false; // exit 0 => no staged changes
    const r = await execRun("git", ["-C", cloneDir, "commit", "-m", message]);
    if (r.code !== 0) throw new Error(`git commit failed: ${r.stderr.trim()}`);
    return true;
  }

  async rebaseOntoBase(cloneDir: string, baseBranch: string): Promise<RebaseResult> {
    await execRun("git", ["-C", cloneDir, "fetch", "origin", baseBranch]);
    const r = await execRun("git", ["-C", cloneDir, "rebase", `origin/${baseBranch}`]);
    const output = `${r.stdout}${r.stderr}`;
    if (r.code === 0) return { ok: true, conflict: false, output };
    // NOTE: after an agent resolves markers, resuming needs `git rebase --continue`;
    // wiring that is a follow-up. The handler routing (retry after resolve) is here.
    return { ok: false, conflict: /conflict/i.test(output), output };
  }

  async openPr(
    cloneDir: string,
    branch: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PrResult> {
    await execRun("git", ["-C", cloneDir, "push", "-u", "origin", branch]);
    const r = await execRun(
      "gh",
      ["pr", "create", "--base", base, "--head", branch, "--title", title, "--body", body],
      { cwd: cloneDir },
    );
    return { url: r.stdout.trim() };
  }
}
