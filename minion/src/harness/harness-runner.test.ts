import { test } from "node:test";
import assert from "node:assert/strict";
import { HarnessRunner, type ShellRunner } from "./harness-runner.js";
import { defaultRegistry } from "./evals.js";
import type { MinionConfig } from "../types/config.js";
import type { CommandResult } from "../util/exec.js";

function makeConfig(over: Partial<MinionConfig> = {}): MinionConfig {
  return {
    repo: { source: "/tmp/x", defaultBranch: "main", integrationBranch: "develop" },
    commands: { lint: "lint-cmd", test: "test-cmd" },
    evals: [],
    frontendGlobs: ["**/*.tsx", "**/*.css"],
    parallelism: 2,
    attemptCeiling: 2,
    ...over,
  };
}

/** Shell stub: map a command string to a fixed exit code. */
function fakeShell(codes: Record<string, number>): ShellRunner {
  return (command) =>
    Promise.resolve<CommandResult>({ code: codes[command] ?? 0, stdout: "", stderr: "" });
}

test("shouldRunE2e fires only for frontend files (FR11)", () => {
  const h = new HarnessRunner(makeConfig(), defaultRegistry());
  assert.equal(h.shouldRunE2e(["src/App.tsx"]), true);
  assert.equal(h.shouldRunE2e(["src/styles.css"]), true);
  assert.equal(h.shouldRunE2e(["src/pricing.ts"]), false);
  assert.equal(h.shouldRunE2e([]), false);
});

test("lint/test map exit codes to pass/fail", async () => {
  const h = new HarnessRunner(makeConfig(), defaultRegistry(), fakeShell({ "lint-cmd": 0, "test-cmd": 1 }));
  assert.equal((await h.lint("/w")).passed, true);
  assert.equal((await h.test("/w")).passed, false);
});

test("e2e is undefined when no command is configured", async () => {
  const h = new HarnessRunner(makeConfig(), defaultRegistry(), fakeShell({}));
  assert.equal(await h.e2e("/w"), undefined);
});

test("e2e runs when configured", async () => {
  const h = new HarnessRunner(
    makeConfig({ commands: { lint: "l", test: "t", e2e: "e2e-cmd" } }),
    defaultRegistry(),
    fakeShell({ "e2e-cmd": 0 }),
  );
  assert.equal((await h.e2e("/w"))?.passed, true);
});

test("static evals run the configured, registered evals", async () => {
  const config = makeConfig({ evals: [{ name: "diff-size", options: { maxFiles: 2 } }] });
  const h = new HarnessRunner(config, defaultRegistry(), fakeShell({}));

  const ok = await h.staticEvals({ cwd: "/w", changedFiles: ["a.ts"] });
  assert.equal(ok.passed, true);

  const tooBig = await h.staticEvals({ cwd: "/w", changedFiles: ["a.ts", "b.ts", "c.ts"] });
  assert.equal(tooBig.passed, false);
});

test("an unknown eval fails closed", async () => {
  const config = makeConfig({ evals: [{ name: "ghost-eval" }] });
  const h = new HarnessRunner(config, defaultRegistry(), fakeShell({}));
  const res = await h.staticEvals({ cwd: "/w", changedFiles: [] });
  assert.equal(res.passed, false);
  assert.match(res.results[0]!.detail, /unknown eval/);
});
