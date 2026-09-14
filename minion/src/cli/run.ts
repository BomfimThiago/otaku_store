/**
 * `minion run <work item>` — the entry point (SPEC §5, FR1).
 *
 * The work item is polymorphic: a spec file routes to the roadmap layer (§5.1,
 * decompose → judge → dispatch → build), a task or issue routes to a single
 * worker blueprint (§5.2). Both share this front door and the same wired
 * collaborators. The target repo is the one the Minion is installed in — auto-
 * detected, never passed as an argument.
 *
 * Type detection is deterministic (no LLM): an existing `.md` path is a spec;
 * `--issue N` is an issue; anything else is a free-text task.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { SdkAgentRunner, loadMcpServers } from "../agent/index.js";
import { loadConfig } from "../config/index.js";
import { EnvManager } from "../env/index.js";
import { HarnessRunner, defaultRegistry } from "../harness/index.js";
import { Orchestrator, type WorkerResult, type WorkerStatus } from "../orchestrator/index.js";
import { StateStore } from "../persistence/index.js";
import { GitRepoOps, type PrResult, type RepoOps } from "../repo/index.js";
import {
  Integrator,
  runRoadmap,
  type ItemOutcome,
  type RoadmapResult,
} from "../roadmap/index.js";
import { Scheduler } from "../scheduler/index.js";
import { run } from "../util/exec.js";
import type { NodeHandlers } from "../orchestrator/index.js";
import type { MinionConfig } from "../types/config.js";
import type { BacklogItem } from "../types/backlog.js";
import type { Run } from "../types/run.js";
import { createWorkerHandlers } from "../worker/handlers.js";

interface ParsedArgs {
  workItem: string;
  openPr: boolean;
  maxItems?: number;
}

type WorkItemKind = "spec" | "issue" | "task";

export async function runCommand(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args.workItem === "") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { config, repoRoot, source } = await loadConfig();
  const kind = detectKind(args.workItem, repoRoot);
  console.log(`repo:   ${repoRoot}`);
  console.log(`config: ${source}`);
  console.log(`input:  ${kind} — "${truncate(args.workItem, 80)}"`);

  const projectDir = path.join(repoRoot, "minion");
  const store = new StateStore(path.join(projectDir, "runs"));
  const env = new EnvManager(path.join(projectDir, "clones"));
  const gitRepo = new GitRepoOps(env);
  const repo: RepoOps = args.openPr ? gitRepo : withDryRunPr(gitRepo);
  const harness = new HarnessRunner(config, defaultRegistry());
  const mcpServers = loadMcpServers(path.join(repoRoot, ".mcp.json"));
  const agent = new SdkAgentRunner({ projectDir, mcpServers });
  const handlers = createWorkerHandlers({ agent, harness, repo, config });
  const repoName = path.basename(repoRoot);

  if (kind === "spec") {
    await runSpec(args, { store, agent, handlers, config, repoName, repoRoot });
    return;
  }

  // task / issue → single worker
  const run = newRun(args.workItem, repoName, config.repo.source);
  console.log(`\n▶ run ${run.id}${args.openPr ? "" : "  (dry-run: no push/PR)"}\n`);
  const result = await runWorker(run, store, handlers, config);
  printResult(result);
  process.exitCode = result.status === "done" ? 0 : 1;
}

// ---- spec → roadmap layer ----

interface SpecDeps {
  store: StateStore;
  agent: SdkAgentRunner;
  handlers: NodeHandlers;
  config: MinionConfig;
  repoName: string;
  repoRoot: string;
}

async function runSpec(args: ParsedArgs, deps: SpecDeps): Promise<void> {
  const specContent = readFileSync(path.resolve(deps.repoRoot, args.workItem), "utf8");
  const integrationBranch = deps.config.repo.integrationBranch;
  const integrationDir = path.join(deps.repoRoot, "minion", "integration");
  const integrator = new Integrator(deps.repoRoot, integrationBranch, integrationDir);
  await integrator.prepare(deps.config.repo.defaultBranch);

  console.log(
    `\n▶ roadmap: building ${args.workItem} → auto-merge into '${integrationBranch}'` +
      `${args.maxItems !== undefined ? `  (max ${args.maxItems} items)` : ""}\n`,
  );

  // Items base off the integration branch, so each builds on prior merged work.
  const itemConfig: MinionConfig = {
    ...deps.config,
    repo: { ...deps.config.repo, defaultBranch: integrationBranch },
  };

  // Workers run in parallel, but the single integration worktree needs serial
  // merges — chain them so only one merge touches `develop` at a time.
  let mergeChain: Promise<unknown> = Promise.resolve();

  const runItem = async (item: BacklogItem): Promise<ItemOutcome> => {
    const run = newRunFromItem(item, deps.repoName, deps.config.repo.source);
    // One item's error (e.g. an agent hitting its turn ceiling) must fail only
    // that item, never crash the whole build.
    let result: WorkerResult;
    try {
      result = await runWorker(run, deps.store, deps.handlers, itemConfig);
    } catch (err) {
      console.log(`  [item] ${item.id}: worker error — ${err instanceof Error ? err.message : String(err)}`);
      run.status = "failed";
      await deps.store.writeRun(run);
      return "failed";
    }
    if (result.status !== "done") return toItemOutcome(result.status);

    const merge = mergeChain.then(() => integrator.merge(run.cloneDir, run.branch));
    mergeChain = merge.catch(() => undefined);
    const merged = await merge.catch((err: unknown) => ({
      ok: false,
      conflict: false,
      output: err instanceof Error ? err.message : String(err),
    }));
    if (!merged.ok) {
      console.log(`  [integrate] ${item.id}: merge ${merged.conflict ? "conflict" : "failed"} — ${truncate(merged.output, 80)}`);
      return merged.conflict ? "escalated" : "failed";
    }
    console.log(`  [integrate] ${item.id} → ${integrationBranch}`);
    return "done";
  };

  const result = await runRoadmap(
    args.workItem,
    specContent,
    {
      agent: deps.agent,
      store: deps.store,
      scheduler: new Scheduler(),
      config: deps.config,
      runItem,
      log: (m) => console.log(`  ${m}`),
    },
    args.maxItems !== undefined ? { maxItems: args.maxItems } : {},
  );

  printRoadmapResult(result);
  console.log(`\n  ${integrationBranch} @ ${await integrator.head()} — built product in ${integrationDir}`);

  // Complete build → finalize: push develop, open the develop → main PR (the one
  // merge that always needs a human), then remove the worktree + folder. Capped
  // batches keep the worktree for the next batch.
  const clean =
    result.dispatch !== undefined &&
    result.dispatch.failed.length === 0 &&
    result.dispatch.escalated.length === 0 &&
    result.dispatch.unreached.length === 0;
  const complete = args.maxItems === undefined && result.status === "delivered" && clean;

  if (complete) {
    await finalize(integrator, integrationBranch, deps.repoRoot, args.openPr);
  } else if (result.status === "delivered") {
    console.log(`  (incremental batch — worktree kept at ${integrationDir} for the next batch)`);
  }

  process.exitCode = result.status === "delivered" ? 0 : 1;
}

async function finalize(
  integrator: Integrator,
  integrationBranch: string,
  repoRoot: string,
  openPr: boolean,
): Promise<void> {
  if (openPr) {
    console.log(`\n  finalizing: pushing '${integrationBranch}' and opening PR → main…`);
    const push = await integrator.push();
    if (push.code !== 0) {
      console.log(`  push failed: ${push.stderr.trim()}`);
    } else {
      const pr = await run(
        "gh",
        [
          "pr", "create",
          "--base", "main",
          "--head", integrationBranch,
          "--title", "OtakuVerso: promote develop → main",
          "--body", "Built by the Minion from store/STORE_SPEC.md. Review and merge to promote.",
        ],
        { cwd: repoRoot },
      );
      console.log(pr.code === 0 ? `  PR opened: ${pr.stdout.trim()}` : `  gh pr create failed: ${pr.stderr.trim()}`);
    }
  } else {
    console.log(`\n  [dry-run] build complete — would push '${integrationBranch}' and open PR → main`);
  }
  await integrator.teardown();
  console.log(`  cleaned up integration worktree`);
}

function runWorker(
  run: Run,
  store: StateStore,
  handlers: NodeHandlers,
  config: MinionConfig,
): Promise<WorkerResult> {
  return new Orchestrator(store, new Scheduler(), handlers, config).runWorker(run);
}

function toItemOutcome(status: WorkerStatus): ItemOutcome {
  if (status === "done") return "done";
  if (status === "escalated") return "escalated";
  return "failed";
}

// ---- input handling ----

function parseArgs(argv: string[]): ParsedArgs {
  let openPr = false;
  let maxItems: number | undefined;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--pr") openPr = true;
    else if (a === "--max-items") {
      const n = Number.parseInt(argv[++i] ?? "", 10);
      if (Number.isFinite(n) && n > 0) maxItems = n;
    } else if (a === "--issue") {
      const n = argv[++i];
      if (n !== undefined) rest.push(`Resolve GitHub issue #${n} in this repository.`);
    } else rest.push(a);
  }
  const parsed: ParsedArgs = { workItem: rest.join(" ").trim(), openPr };
  if (maxItems !== undefined) parsed.maxItems = maxItems;
  return parsed;
}

function detectKind(workItem: string, repoRoot: string): WorkItemKind {
  if (workItem.startsWith("Resolve GitHub issue #")) return "issue";
  if (workItem.toLowerCase().endsWith(".md") && existsSync(path.resolve(repoRoot, workItem))) {
    return "spec";
  }
  return "task";
}

function newRun(workItem: string, repoName: string, source: string): Run {
  const now = new Date().toISOString();
  return baseRun(Date.now().toString(36), workItem, repoName, source, now);
}

function newRunFromItem(item: BacklogItem, repoName: string, source: string): Run {
  const now = new Date().toISOString();
  const criteria = item.acceptanceCriteria.map((c) => `- ${c}`).join("\n");
  const files = item.likelyFiles.length ? `\n\nSuggested files: ${item.likelyFiles.join(", ")}` : "";
  const workItem = `${item.description}\n\nAcceptance criteria:\n${criteria}${files}`;
  const run = baseRun(item.id, workItem, repoName, source, now);
  run.itemId = item.id;
  return run;
}

function baseRun(id: string, workItem: string, repoName: string, source: string, now: string): Run {
  return {
    id,
    workItem,
    repo: { name: repoName, source },
    cloneDir: "",
    branch: "",
    status: "queued",
    dependsOn: [],
    lockedFiles: [],
    steps: [],
    verdicts: [],
    stats: { elapsedMs: 0, modelCalls: 0, strongCalls: 0, tokens: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

// ---- dry-run: run the whole pipeline but never push or open a PR ----

function withDryRunPr(repo: RepoOps): RepoOps {
  return {
    isolate: repo.isolate.bind(repo),
    changedFiles: repo.changedFiles.bind(repo),
    commitAll: repo.commitAll.bind(repo),
    rebaseOntoBase: repo.rebaseOntoBase.bind(repo),
    teardown: repo.teardown.bind(repo),
    openPr: async (cloneDir, branch): Promise<PrResult> => {
      console.log(`  [dry-run] would push "${branch}" and open a PR — skipped (clone: ${cloneDir})`);
      return { url: `dry-run://no-pr/${branch}` };
    },
  };
}

// ---- output ----

function printResult(result: WorkerResult): void {
  const { run, status } = result;
  console.log(`\n── run ${run.id}: ${status.toUpperCase()} ──`);
  for (const step of run.steps) {
    const mark =
      step.status === "done" ? "✓" : step.status === "skipped" ? "–" : step.status === "failed" ? "✗" : "·";
    const extra = step.summary ? `  ${truncate(step.summary, 90)}` : "";
    console.log(`  ${mark} ${step.node}${extra}`);
  }
  if (run.verdicts.length > 0) {
    console.log("\n  verdicts:");
    for (const v of run.verdicts) console.log(`    ${v.judge}: ${v.verdict} (${v.score}/100)`);
  }
  if (run.escalation) console.log(`\n  escalated: ${run.escalation.trigger} — ${run.escalation.message}`);
  if (run.cloneDir) console.log(`\n  clone: ${run.cloneDir}  (branch ${run.branch})`);
}

function printRoadmapResult(result: RoadmapResult): void {
  console.log(`\n══ roadmap: ${result.status.toUpperCase()} ══`);
  if (result.reason) console.log(`  ${result.reason}`);
  if (result.backlog) console.log(`  backlog: ${result.backlog.items.length} items from ${result.backlog.source}`);
  if (result.dispatch) {
    const d = result.dispatch;
    console.log(`  done: ${d.done.length} · failed: ${d.failed.length} · escalated: ${d.escalated.length} · unreached: ${d.unreached.length}`);
    if (d.done.length) console.log(`    ✓ ${d.done.join(", ")}`);
    if (d.failed.length) console.log(`    ✗ ${d.failed.join(", ")}`);
    if (d.escalated.length) console.log(`    ⚠ ${d.escalated.join(", ")}`);
    if (d.unreached.length) console.log(`    · unreached: ${d.unreached.join(", ")}`);
  }
}

function printUsage(): void {
  console.error(
    [
      "usage:",
      '  minion run "<task>"           run a task through the worker blueprint',
      "  minion run <spec>.md           decompose a spec and build it (roadmap layer)",
      "  minion run --issue <n>         resolve a GitHub issue",
      "",
      "flags:",
      "  --pr             push the branch and open a real PR (default: dry-run, no push)",
      "  --max-items <n>  (spec) cap how many backlog items are dispatched",
    ].join("\n"),
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
