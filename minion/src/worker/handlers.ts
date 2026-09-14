/**
 * The real node handlers for the worker blueprint (SPEC §5.2). Each handler
 * wires one node to its collaborator — the AgentRunner (agentic nodes), the
 * HarnessRunner (evals/lint/tests/E2E) and RepoOps (isolate/sync/PR) — and
 * returns a NodeOutcome the deterministic orchestrator routes on.
 *
 * `schedule` has no handler: the orchestrator itself acquires the lock there.
 * All collaborators are injected, so the whole pipeline runs end to end against
 * FakeAgentRunner + a fake RepoOps, with no key or network.
 */
import {
  parsePlan,
  parseVerdict,
  runStructured,
  type AgentRunner,
  type VerdictOutput,
} from "../agent/index.js";
import type { HarnessRunner, EvalsCheck } from "../harness/index.js";
import type { RepoOps } from "../repo/index.js";
import type { NodeHandlers } from "../orchestrator/index.js";
import type { MinionConfig } from "../types/config.js";
import type { JudgeKind, ModelTier } from "../types/common.js";
import type { JudgeVerdict } from "../types/judge.js";
import type { Run } from "../types/run.js";

export interface WorkerDeps {
  agent: AgentRunner;
  harness: HarnessRunner;
  repo: RepoOps;
  config: MinionConfig;
  now?: () => string;
}

function requirePlan(run: Run): void {
  if (run.plan === undefined) throw new Error(`run ${run.id} reached a node before a plan existed`);
}

function trunc(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function summarizeEvals(res: EvalsCheck): string {
  return res.results.map((r) => `${r.name}: ${r.passed ? "ok" : "FAIL"}`).join(", ");
}

function toVerdict(
  kind: JudgeKind,
  out: VerdictOutput,
  attempt: number,
  tier: ModelTier,
  now: () => string,
): JudgeVerdict {
  return { judge: kind, attempt, verdict: out.verdict, score: out.score, checklist: out.checklist, critique: out.critique, modelTier: tier, at: now() };
}

// --- prompt builders (kept minimal; the agents carry the detailed instructions) ---

const workItemBlock = (run: Run): string => `# Work item\n${run.workItem}`;

const planBlock = (run: Run): string =>
  run.plan === undefined ? "" : `# Approved plan\n${JSON.stringify(run.plan, null, 2)}`;

function lastImplCritique(run: Run): string | undefined {
  const rejections = run.verdicts.filter((v) => v.judge === "implementation" && v.verdict === "rejected");
  return rejections.at(-1)?.critique;
}

export function createWorkerHandlers(deps: WorkerDeps): NodeHandlers {
  const now = deps.now ?? (() => new Date().toISOString());
  const contextByRun = new WeakMap<Run, string>();

  return {
    isolate: async ({ run }) => {
      const iso = await deps.repo.isolate(run.id, deps.config.repo.source, deps.config.repo.defaultBranch);
      run.cloneDir = iso.cloneDir;
      run.branch = iso.branch;
      return { kind: "ok", summary: `cloned → ${iso.branch}` };
    },

    context: async ({ run }) => {
      const prompt = workItemBlock(run);
      const [internal, official] = await Promise.all([
        deps.agent.run({ agent: "gather-internal-context", prompt, cwd: run.cloneDir }),
        deps.agent.run({ agent: "gather-official-sources", prompt, cwd: run.cloneDir }),
      ]);
      contextByRun.set(run, `## Internal\n${internal.text}\n\n## Official\n${official.text}`);
      return { kind: "ok", summary: "context gathered (internal + official)" };
    },

    plan: async ({ run }) => {
      const context = contextByRun.get(run) ?? "";
      const prompt = `${workItemBlock(run)}\n\n# Context\n${context}`;
      const plan = await runStructured(deps.agent, { agent: "planner", prompt, cwd: run.cloneDir }, parsePlan);
      run.plan = plan;
      run.lockedFiles = plan.files; // plan's file list is the single source of truth (§7)
      return { kind: "ok", summary: plan.summary };
    },

    judge_plan: async ({ run, attempt }) => {
      const prompt = `${workItemBlock(run)}\n\n${planBlock(run)}`;
      const out = await runStructured(deps.agent, { agent: "plan-judge", prompt, cwd: run.cloneDir }, parseVerdict);
      const v = toVerdict("plan", out, attempt, "strong", now);
      return out.verdict === "approved" ? { kind: "ok", verdict: v } : { kind: "reject", verdict: v };
    },

    implement: async ({ run, attempt }) => {
      requirePlan(run);
      const critique = attempt > 1 ? lastImplCritique(run) : undefined;
      const prompt = `${planBlock(run)}${critique ? `\n\n# Judge critique to address\n${critique}` : ""}`;
      await deps.agent.run({ agent: "implementer", prompt, cwd: run.cloneDir });
      return { kind: "ok", summary: attempt > 1 ? `reworked (attempt ${attempt})` : "implemented" };
    },

    judge_impl: async ({ run, attempt }) => {
      const changed = await deps.repo.changedFiles(run.cloneDir);
      const prompt = `${planBlock(run)}\n\n# Changed files\n${changed.join("\n")}`;
      const out = await runStructured(deps.agent, { agent: "impl-judge", prompt, cwd: run.cloneDir }, parseVerdict);
      const v = toVerdict("implementation", out, attempt, "strong", now);
      return out.verdict === "approved" ? { kind: "ok", verdict: v } : { kind: "reject", verdict: v };
    },

    static_evals: async ({ run }) => {
      const changedFiles = await deps.repo.changedFiles(run.cloneDir);
      const res = await deps.harness.staticEvals({ cwd: run.cloneDir, changedFiles });
      return res.passed
        ? { kind: "ok", summary: summarizeEvals(res) }
        : { kind: "fail", reason: summarizeEvals(res) };
    },

    lint_tests: async ({ run }) => {
      const lint = await deps.harness.lint(run.cloneDir);
      if (!lint.passed) return { kind: "fail", reason: `lint failed: ${trunc(lint.output)}` };
      const test = await deps.harness.test(run.cloneDir);
      return test.passed
        ? { kind: "ok", summary: "lint + tests green" }
        : { kind: "fail", reason: `tests failed: ${trunc(test.output)}` };
    },

    e2e: async ({ run }) => {
      requirePlan(run);
      if (!deps.harness.shouldRunE2e(run.plan!.files)) {
        return { kind: "skip", reason: "plan touches no frontend files" };
      }
      const res = await deps.harness.e2e(run.cloneDir);
      if (res === undefined) return { kind: "skip", reason: "no E2E command configured" };
      return res.passed ? { kind: "ok", summary: "E2E green" } : { kind: "fail", reason: `E2E failed: ${trunc(res.output)}` };
    },

    sync: async ({ run }) => {
      const base = deps.config.repo.defaultBranch;
      // Commit the accepted implementation first, so the branch carries a real
      // diff for the PR and the rebase can detect genuine conflicts (FR13).
      const message = run.plan?.summary ?? run.workItem;
      await deps.repo.commitAll(run.cloneDir, `${message}\n\nMinion run ${run.id}`);
      const first = await deps.repo.rebaseOntoBase(run.cloneDir, base);
      if (first.ok) return { kind: "ok", summary: `rebased onto ${base}` };
      if (!first.conflict) return { kind: "fail", reason: `rebase failed: ${trunc(first.output)}` };

      // One agent-assisted resolution attempt (FR13).
      const prompt = `${planBlock(run)}\n\n# Rebase conflict\n${first.output}`;
      await deps.agent.run({ agent: "conflict-resolver", prompt, cwd: run.cloneDir });
      const retry = await deps.repo.rebaseOntoBase(run.cloneDir, base);
      return retry.ok
        ? { kind: "ok", summary: "conflict resolved + rebased" }
        : { kind: "fail", reason: "conflict persists after resolution attempt" };
    },

    open_pr: async ({ run }) => {
      const pr = await deps.repo.openPr(
        run.cloneDir,
        run.branch,
        deps.config.repo.integrationBranch,
        run.workItem,
        planBlock(run),
      );
      return { kind: "ok", summary: pr.url };
    },
  };
}
