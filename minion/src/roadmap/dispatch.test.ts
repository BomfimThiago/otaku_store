import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "../scheduler/index.js";
import { dispatch, type ItemOutcome } from "./dispatch.js";
import type { Backlog, BacklogItem } from "../types/index.js";

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function item(
  id: string,
  opts: { dependsOn?: string[]; files?: string[]; weight?: BacklogItem["weight"] } = {},
): BacklogItem {
  return {
    id,
    description: id,
    acceptanceCriteria: [],
    likelyFiles: opts.files ?? [],
    dependsOn: opts.dependsOn ?? [],
    weight: opts.weight ?? "mvp",
    status: "pending",
  };
}

function backlog(items: BacklogItem[]): Backlog {
  return { source: "test", items, edges: [], createdAt: "t0", updatedAt: "t0" };
}

/** Tracks concurrency and start order while simulating work. */
function tracker(outcomes: Record<string, ItemOutcome> = {}) {
  let concurrent = 0;
  let maxConcurrent = 0;
  const startOrder: string[] = [];
  const runItem = async (i: BacklogItem): Promise<ItemOutcome> => {
    startOrder.push(i.id);
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await delay(5);
    concurrent--;
    return outcomes[i.id] ?? "done";
  };
  return { runItem, get maxConcurrent() { return maxConcurrent; }, startOrder };
}

test("independent items run in parallel up to the limit", async () => {
  const t = tracker();
  const res = await dispatch(backlog([item("a"), item("b")]), new Scheduler(), t.runItem, {
    parallelism: 2,
  });
  assert.deepEqual(res.done.sort(), ["a", "b"]);
  assert.equal(t.maxConcurrent, 2);
});

test("parallelism limit is respected", async () => {
  const t = tracker();
  await dispatch(backlog([item("a"), item("b"), item("c")]), new Scheduler(), t.runItem, {
    parallelism: 1,
  });
  assert.equal(t.maxConcurrent, 1);
});

test("dependencies gate execution order", async () => {
  const t = tracker();
  // b depends on a → a must finish before b starts.
  await dispatch(backlog([item("b", { dependsOn: ["a"] }), item("a")]), new Scheduler(), t.runItem, {
    parallelism: 2,
  });
  assert.deepEqual(t.startOrder, ["a", "b"]);
});

test("file-lock collision serializes overlapping items", async () => {
  const t = tracker();
  const res = await dispatch(
    backlog([item("a", { files: ["shared.ts"] }), item("b", { files: ["shared.ts"] })]),
    new Scheduler(),
    t.runItem,
    { parallelism: 2 },
  );
  assert.deepEqual(res.done.sort(), ["a", "b"]);
  assert.equal(t.maxConcurrent, 1, "same file → never concurrent");
});

test("a failed dependency leaves dependents unreached", async () => {
  const t = tracker({ a: "failed" });
  const res = await dispatch(
    backlog([item("a"), item("b", { dependsOn: ["a"] })]),
    new Scheduler(),
    t.runItem,
    { parallelism: 2 },
  );
  assert.deepEqual(res.failed, ["a"]);
  assert.deepEqual(res.unreached, ["b"]);
});

test("higher priority starts first under a tight limit", async () => {
  const t = tracker();
  // root is depended on by two items → highest priority; run with limit 1.
  const items = [
    item("z-leaf"),
    item("root"),
    item("dep1", { dependsOn: ["root"] }),
    item("dep2", { dependsOn: ["root"] }),
  ];
  await dispatch(backlog(items), new Scheduler(), t.runItem, { parallelism: 1 });
  // root (priority 4) must be picked before the independent z-leaf (priority 0).
  assert.equal(t.startOrder[0], "root");
});
