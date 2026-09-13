import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "./agent-runner.js";
import { parseBacklogItems, parsePlan, parseVerdict } from "./parse.js";

test("extractJson reads a fenced json block", () => {
  const text = "Here is the plan:\n```json\n{ \"a\": 1 }\n```\nthanks";
  assert.deepEqual(extractJson(text), { a: 1 });
});

test("extractJson falls back to raw JSON", () => {
  assert.deepEqual(extractJson('{ "a": 1 }'), { a: 1 });
});

test("extractJson throws on non-JSON", () => {
  assert.throws(() => extractJson("no json here"), /not valid JSON/);
});

test("parsePlan validates and defaults newDependencies", () => {
  const plan = parsePlan({ summary: "s", steps: ["one"], files: ["a.ts"] });
  assert.deepEqual(plan, { summary: "s", steps: ["one"], files: ["a.ts"], newDependencies: [] });
});

test("parsePlan rejects a bad shape", () => {
  assert.throws(() => parsePlan({ summary: "s", steps: "not-array", files: [] }), /"steps"/);
});

test("parseVerdict validates and clamps score", () => {
  const v = parseVerdict({
    verdict: "approved",
    score: 142,
    checklist: [{ label: "ok", passed: true }],
    critique: "good",
  });
  assert.equal(v.score, 100);
  assert.equal(v.verdict, "approved");
  assert.equal(v.checklist[0]!.passed, true);
});

test("parseVerdict rejects an invalid verdict value", () => {
  assert.throws(
    () => parseVerdict({ verdict: "maybe", score: 50, checklist: [], critique: "" }),
    /"approved" or "rejected"/,
  );
});

test("parseBacklogItems validates items and weight", () => {
  const items = parseBacklogItems({
    items: [
      {
        id: "a",
        description: "d",
        acceptanceCriteria: ["c"],
        likelyFiles: ["f.ts"],
        dependsOn: [],
        weight: "mvp",
      },
    ],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.weight, "mvp");
});

test("parseBacklogItems rejects a bad weight", () => {
  assert.throws(
    () =>
      parseBacklogItems({
        items: [{ id: "a", description: "d", acceptanceCriteria: [], likelyFiles: [], dependsOn: [], weight: "urgent" }],
      }),
    /weight must be/,
  );
});
