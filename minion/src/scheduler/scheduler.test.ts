import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "./scheduler.js";

/** Deterministic clock: "t1", "t2", ... so timestamps are assertable. */
function fakeClock(): () => string {
  let n = 0;
  return () => `t${++n}`;
}

test("grants when all files are free", () => {
  const s = new Scheduler(fakeClock());
  const r = s.acquire("A", ["a.ts", "b.ts"]);
  assert.deepEqual(r, { granted: true, waitingOn: [] });
});

test("non-overlapping runs both proceed in parallel", () => {
  const s = new Scheduler(fakeClock());
  assert.equal(s.acquire("A", ["a.ts"]).granted, true);
  assert.equal(s.acquire("B", ["b.ts"]).granted, true);
});

test("overlapping run is blocked and queued", () => {
  const s = new Scheduler(fakeClock());
  s.acquire("A", ["shared.ts"]);
  const r = s.acquire("B", ["shared.ts"]);
  assert.equal(r.granted, false);
  assert.deepEqual(r.waitingOn, ["shared.ts"]);
});

test("release grants the waiting run", () => {
  const s = new Scheduler(fakeClock());
  s.acquire("A", ["shared.ts"]);
  s.acquire("B", ["shared.ts"]);
  const granted = s.release("A");
  assert.deepEqual(granted, ["B"]);
  // B now holds it; a third run must wait.
  assert.equal(s.acquire("C", ["shared.ts"]).granted, false);
});

test("FIFO order among waiters on the same file", () => {
  const s = new Scheduler(fakeClock());
  s.acquire("A", ["shared.ts"]);
  s.acquire("B", ["shared.ts"]);
  s.acquire("C", ["shared.ts"]);
  // Only B (first waiter) is granted on release; C stays queued.
  assert.deepEqual(s.release("A"), ["B"]);
  assert.deepEqual(s.release("B"), ["C"]);
});

test("all-or-nothing acquisition avoids partial holds", () => {
  const s = new Scheduler(fakeClock());
  s.acquire("A", ["a.ts"]);
  // B wants a.ts + b.ts; blocked on a.ts, must NOT hold b.ts meanwhile.
  assert.equal(s.acquire("B", ["a.ts", "b.ts"]).granted, false);
  // So C can still take b.ts.
  assert.equal(s.acquire("C", ["b.ts"]).granted, true);
});

test("snapshot reflects holds and per-file waiters", () => {
  const clock = fakeClock();
  const s = new Scheduler(clock);
  s.acquire("A", ["shared.ts"]);
  s.acquire("B", ["shared.ts"]);
  const snap = s.snapshot();
  assert.equal(snap.locks.length, 1);
  assert.equal(snap.locks[0]!.file, "shared.ts");
  assert.equal(snap.locks[0]!.heldBy, "A");
  assert.deepEqual(snap.queue, [{ file: "shared.ts", waiting: ["B"] }]);
});

test("re-acquiring already-held files by the same run is idempotent", () => {
  const s = new Scheduler(fakeClock());
  s.acquire("A", ["a.ts"]);
  assert.equal(s.acquire("A", ["a.ts"]).granted, true);
});
