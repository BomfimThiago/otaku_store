import { test } from "node:test";
import assert from "node:assert/strict";
import { runStructured } from "./agent-runner.js";
import { FakeAgentRunner, jsonReply } from "./fake.js";
import { parsePlan } from "./parse.js";

test("FakeAgentRunner returns the mapped reply", async () => {
  const runner = new FakeAgentRunner({ planner: () => "hello" });
  const res = await runner.run({ agent: "planner", prompt: "x" });
  assert.equal(res.text, "hello");
});

test("FakeAgentRunner throws for an unmapped agent", async () => {
  const runner = new FakeAgentRunner({});
  await assert.rejects(runner.run({ agent: "ghost", prompt: "x" }), /no handler for agent "ghost"/);
});

test("runStructured runs an agent and parses its output", async () => {
  const runner = new FakeAgentRunner({
    planner: () => jsonReply({ summary: "s", steps: ["a"], files: ["a.ts"], newDependencies: [] }),
  });
  const plan = await runStructured(runner, { agent: "planner", prompt: "x" }, parsePlan);
  assert.deepEqual(plan.files, ["a.ts"]);
});

test("the fake receives the request (agent, prompt, cwd)", async () => {
  let seen = "";
  const runner = new FakeAgentRunner({ implementer: (req) => ((seen = `${req.agent}:${req.cwd}`), "ok") });
  await runner.run({ agent: "implementer", prompt: "do", cwd: "/clone" });
  assert.equal(seen, "implementer:/clone");
});
