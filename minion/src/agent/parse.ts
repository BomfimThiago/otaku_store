/**
 * Validators that turn an agent's parsed JSON into our typed schemas, failing
 * loudly on anything malformed. This is the "structured output plumbing" that
 * keeps a stochastic model from feeding garbage into the deterministic engine.
 */
import type { BacklogItem } from "../types/backlog.js";
import type { JudgeVerdict } from "../types/judge.js";
import type { Plan } from "../types/plan.js";

function obj(u: unknown, what = "value"): Record<string, unknown> {
  if (typeof u !== "object" || u === null || Array.isArray(u)) {
    throw new Error(`expected ${what} to be an object`);
  }
  return u as Record<string, unknown>;
}

function str(v: unknown, field: string): string {
  if (typeof v !== "string") throw new Error(`field "${field}" must be a string`);
  return v;
}

function strArray(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new Error(`field "${field}" must be an array of strings`);
  }
  return v as string[];
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new Error(`field "${field}" must be a boolean`);
  return v;
}

function num(v: unknown, field: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`field "${field}" must be a number`);
  return v;
}

/** The plan node's output (FR4). */
export function parsePlan(u: unknown): Plan {
  const o = obj(u, "plan");
  return {
    summary: str(o["summary"], "summary"),
    steps: strArray(o["steps"], "steps"),
    files: strArray(o["files"], "files"),
    newDependencies: o["newDependencies"] === undefined ? [] : strArray(o["newDependencies"], "newDependencies"),
  };
}

/** The subset of a verdict a Judge produces; the orchestrator adds the rest. */
export type VerdictOutput = Pick<JudgeVerdict, "verdict" | "score" | "checklist" | "critique">;

export function parseVerdict(u: unknown): VerdictOutput {
  const o = obj(u, "verdict");

  const verdict = str(o["verdict"], "verdict");
  if (verdict !== "approved" && verdict !== "rejected") {
    throw new Error('field "verdict" must be "approved" or "rejected"');
  }

  const score = Math.max(0, Math.min(100, Math.round(num(o["score"], "score"))));

  const rawChecklist = o["checklist"];
  if (!Array.isArray(rawChecklist)) throw new Error('field "checklist" must be an array');
  const checklist = rawChecklist.map((item, i) => {
    const c = obj(item, `checklist[${i}]`);
    return { label: str(c["label"], `checklist[${i}].label`), passed: bool(c["passed"], `checklist[${i}].passed`) };
  });

  return { verdict, score, checklist, critique: str(o["critique"], "critique") };
}

/** A decomposed backlog item, before the orchestrator assigns status/priority. */
export type DecomposedItem = Omit<BacklogItem, "status" | "priority" | "runId">;

export function parseBacklogItems(u: unknown): DecomposedItem[] {
  const o = obj(u, "backlog");
  const rawItems = o["items"];
  if (!Array.isArray(rawItems)) throw new Error('field "items" must be an array');

  return rawItems.map((raw, i) => {
    const it = obj(raw, `items[${i}]`);
    const weight = str(it["weight"], `items[${i}].weight`);
    if (weight !== "mvp" && weight !== "nice-to-have") {
      throw new Error(`items[${i}].weight must be "mvp" or "nice-to-have"`);
    }
    return {
      id: str(it["id"], `items[${i}].id`),
      description: str(it["description"], `items[${i}].description`),
      acceptanceCriteria: strArray(it["acceptanceCriteria"], `items[${i}].acceptanceCriteria`),
      likelyFiles: strArray(it["likelyFiles"], `items[${i}].likelyFiles`),
      dependsOn: strArray(it["dependsOn"], `items[${i}].dependsOn`),
      weight,
    };
  });
}
