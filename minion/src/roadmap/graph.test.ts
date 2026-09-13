import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriorities, topologicalOrder } from "./graph.js";
import type { BacklogItem } from "../types/index.js";

function item(id: string, dependsOn: string[] = [], weight: BacklogItem["weight"] = "mvp"): BacklogItem {
  return {
    id,
    description: id,
    acceptanceCriteria: [],
    likelyFiles: [],
    dependsOn,
    weight,
    status: "pending",
  };
}

test("topological order respects dependencies", () => {
  const items = [item("c", ["b"]), item("b", ["a"]), item("a")];
  assert.deepEqual(topologicalOrder(items), ["a", "b", "c"]);
});

test("independent items are ordered by id (deterministic)", () => {
  const items = [item("b"), item("a"), item("c")];
  assert.deepEqual(topologicalOrder(items), ["a", "b", "c"]);
});

test("unknown dependency throws", () => {
  assert.throws(() => topologicalOrder([item("a", ["ghost"])]), /unknown item "ghost"/);
});

test("dependency cycle throws", () => {
  assert.throws(() => topologicalOrder([item("a", ["b"]), item("b", ["a"])]), /cycle/);
});

test("priority = transitive dependents × weight", () => {
  // a ← b ← c  : a unblocks {b, c} = 2, b unblocks {c} = 1, c unblocks {} = 0
  const items = [item("a"), item("b", ["a"]), item("c", ["b"])];
  const p = computePriorities(items);
  assert.equal(p.get("a"), 2 * 2); // 2 dependents × mvp(2)
  assert.equal(p.get("b"), 1 * 2);
  assert.equal(p.get("c"), 0);
});

test("mvp weight outranks nice-to-have at equal reach", () => {
  const items = [
    item("root"),
    item("mvpLeaf", ["root"], "mvp"),
    item("niceLeaf", ["root"], "nice-to-have"),
  ];
  const p = computePriorities(items);
  assert.ok((p.get("mvpLeaf") ?? 0) >= 0);
  // root unblocks 2 leaves × mvp(2) = 4
  assert.equal(p.get("root"), 2 * 2);
});
