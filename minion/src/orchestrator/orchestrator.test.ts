import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { StateStore } from "../persistence/index.js";
import { Scheduler } from "../scheduler/index.js";
import { Orchestrator } from "./orchestrator.js";
import type { NodeHandlers } from "./nodes.js";
import type { MinionConfig } from "../types/config.js";
import type { JudgeVerdict } from "../types/judge.js";
import type { Run } from "../types/run.js";

function makeConfig(): MinionConfig {
  return {
    repo: { source: "/tmp/sample", defaultBranch: "main", integrationBranch: "develop" },
    commands: { lint: "true", test: "true" },
    evals: [],
    frontendGlobs: [],
    parallelism: 2,
    attemptCeiling: 2,
  };
}

function makeRun(id: string, files: string[] = ["src/a.ts"]): Run {
  const ts = "t0";
  return {
    id,
    workItem: "do the thing",
    repo: { name: "sample", source: "/tmp/sample" },
    cloneDir: `/tmp/clones/${id}`,
    branch: `minion/${id}`,
    status: "queued",
    dependsOn: [],
    lockedFiles: files,
    steps: [],
    verdicts: [],
    stats: { elapsedMs: 0, modelCalls: 0, strongCalls: 0, tokens: 0 },
    createdAt: ts,
    updatedAt: ts,
  };
}

function rejectVerdict(): JudgeVerdict {
  return {
    judge: "implementation",
    attempt: 1,
    verdict: "rejected",
    score: 40,
    checklist: [],
    critique: "not aligned with the plan",
    modelTier: "strong",
    at: "t",
  };
}

async function withStore(fn: (store: StateStore) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "minion-orch-"));
  try {
    await fn(new StateStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** E2E skips by default in these tests (no frontend files). */
const skipE2e: NodeHandlers = { e2e: () => ({ kind: "skip", reason: "no frontend files" }) };

test("happy path runs the full blueprint to done", async () => {
  await withStore(async (store) => {
    const orch = new Orchestrator(store, new Scheduler(), skipE2e, makeConfig());
    const res = await orch.runWorker(makeRun("happy"));

    assert.equal(res.status, "done");
    assert.equal(res.run.status, "done");
    // e2e skipped, everything else done.
    const e2e = res.run.steps.find((s) => s.node === "e2e")!;
    assert.equal(e2e.status, "skipped");
    assert.ok(res.run.steps.filter((s) => s.node !== "e2e").every((s) => s.status === "done"));
    // synthesized approvals from both Judges.
    assert.equal(res.run.verdicts.length, 2);
  });
});

test("plan Judge rejecting twice escalates", async () => {
  await withStore(async (store) => {
    const handlers: NodeHandlers = {
      ...skipE2e,
      judge_plan: () => ({ kind: "reject", verdict: { ...rejectVerdict(), judge: "plan" } }),
    };
    const orch = new Orchestrator(store, new Scheduler(), handlers, makeConfig());
    const res = await orch.runWorker(makeRun("badplan"));

    assert.equal(res.status, "escalated");
    assert.equal(res.run.escalation?.trigger, "plan_judge_rejected_twice");
    assert.equal(res.run.verdicts.length, 2); // two rejections recorded
  });
});

test("impl Judge rejects once then approves — loops back and finishes", async () => {
  await withStore(async (store) => {
    let implCalls = 0;
    let judgeCalls = 0;
    const handlers: NodeHandlers = {
      ...skipE2e,
      implement: () => {
        implCalls++;
        return { kind: "ok" };
      },
      judge_impl: () => {
        judgeCalls++;
        return judgeCalls === 1
          ? { kind: "reject", verdict: rejectVerdict() }
          : { kind: "ok" };
      },
    };
    const orch = new Orchestrator(store, new Scheduler(), handlers, makeConfig());
    const res = await orch.runWorker(makeRun("recover"));

    assert.equal(res.status, "done");
    assert.equal(implCalls, 2, "implement re-ran after rejection");
    assert.equal(judgeCalls, 2);
  });
});

test("harness failing twice escalates (shared ceiling)", async () => {
  await withStore(async (store) => {
    const handlers: NodeHandlers = {
      ...skipE2e,
      lint_tests: () => ({ kind: "fail", reason: "tests red" }),
    };
    const orch = new Orchestrator(store, new Scheduler(), handlers, makeConfig());
    const res = await orch.runWorker(makeRun("redtests"));

    assert.equal(res.status, "escalated");
    assert.equal(res.run.escalation?.trigger, "harness_failed_twice");
  });
});

test("a run is blocked when its files are already locked", async () => {
  await withStore(async (store) => {
    const scheduler = new Scheduler();
    scheduler.acquire("other", ["src/shared.ts"]);
    const orch = new Orchestrator(store, scheduler, skipE2e, makeConfig());
    const res = await orch.runWorker(makeRun("waiter", ["src/shared.ts"]));

    assert.equal(res.status, "blocked");
    assert.equal(res.run.status, "blocked");
  });
});

test("state is persisted and reconstructable from disk", async () => {
  await withStore(async (store) => {
    const orch = new Orchestrator(store, new Scheduler(), skipE2e, makeConfig());
    await orch.runWorker(makeRun("persisted"));

    const fromDisk = await store.readRun("persisted");
    assert.equal(fromDisk?.status, "done");
    const log = await store.readLog("persisted");
    assert.ok(log.length > 0, "log has events");
  });
});
