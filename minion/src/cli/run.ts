/**
 * `minion run <work item>` — the entry point (SPEC §5, FR1).
 *
 * The work item is polymorphic: a spec file routes to the roadmap layer (§5.1),
 * a task or issue routes to a single worker blueprint (§5.2). Both share this
 * front door. The target repo is the one the Minion is installed in — auto-
 * detected, never passed as an argument.
 *
 * Type detection is deterministic (no LLM): an existing `.md` path is a spec;
 * `--issue N` is an issue; anything else is a free-text task.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { SdkAgentRunner, loadMcpServers } from "../agent/index.js";
import { loadConfig } from "../config/index.js";
import { EnvManager } from "../env/index.js";
import { HarnessRunner, defaultRegistry } from "../harness/index.js";
import { Orchestrator, type WorkerResult } from "../orchestrator/index.js";
import { StateStore } from "../persistence/index.js";
import { GitRepoOps, type PrResult, type RepoOps } from "../repo/index.js";
import { Scheduler } from "../scheduler/index.js";
import type { Run } from "../types/run.js";
import { createWorkerHandlers } from "../worker/handlers.js";

interface ParsedArgs {
  workItem: string;
  openPr: boolean;
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

  if (kind === "spec") {
    console.error(
      "\nSpec → roadmap layer (decompose → dispatch) is not wired yet.\n" +
        'Run a single task for now, e.g.  minion run "add a health-check endpoint"',
    );
    process.exitCode = 2;
    return;
  }

  const projectDir = path.join(repoRoot, "minion");
  const store = new StateStore(path.join(projectDir, "runs"));
  const scheduler = new Scheduler();
  const env = new EnvManager(path.join(projectDir, "clones"));
  const gitRepo = new GitRepoOps(env);
  const repo: RepoOps = args.openPr ? gitRepo : withDryRunPr(gitRepo);
  const harness = new HarnessRunner(config, defaultRegistry());
  const mcpServers = loadMcpServers(path.join(repoRoot, ".mcp.json"));
  const agent = new SdkAgentRunner({ projectDir, mcpServers });
  const handlers = createWorkerHandlers({ agent, harness, repo, config });
  const orchestrator = new Orchestrator(store, scheduler, handlers, config);

  const run = newRun(args.workItem, path.basename(repoRoot), config.repo.source);
  console.log(
    `\n▶ run ${run.id}${args.openPr ? "" : "  (dry-run: no push/PR)"}\n`,
  );

  const result = await orchestrator.runWorker(run);
  printResult(result);
  process.exitCode = result.status === "done" ? 0 : 1;
}

// ---- input handling ----

function parseArgs(argv: string[]): ParsedArgs {
  let openPr = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--pr") openPr = true;
    else if (a === "--issue") {
      const n = argv[++i];
      if (n !== undefined) rest.push(`Resolve GitHub issue #${n} in this repository.`);
    } else rest.push(a);
  }
  return { workItem: rest.join(" ").trim(), openPr };
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
  const id = Date.now().toString(36);
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
      console.log(
        `\n[dry-run] would push "${branch}" and open a PR — skipped.\n` +
          `          inspect the diff in the isolated clone:\n            ${cloneDir}`,
      );
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
    for (const v of run.verdicts) {
      console.log(`    ${v.judge}: ${v.verdict} (${v.score}/100)`);
    }
  }
  if (run.escalation) console.log(`\n  escalated: ${run.escalation.trigger} — ${run.escalation.message}`);
  if (run.cloneDir) console.log(`\n  clone: ${run.cloneDir}  (branch ${run.branch})`);
}

function printUsage(): void {
  console.error(
    [
      "usage:",
      '  minion run "<task>"        run a task through the worker blueprint',
      "  minion run <spec>.md        decompose a spec via the roadmap layer (coming soon)",
      "  minion run --issue <n>      resolve a GitHub issue (coming soon)",
      "",
      "flags:",
      "  --pr    push the branch and open a real PR (default: dry-run, no push)",
    ].join("\n"),
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
