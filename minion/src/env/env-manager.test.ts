import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../util/exec.js";
import { EnvManager } from "./env-manager.js";

/** Create a throwaway git repo with one commit on `main`. */
async function makeSourceRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "minion-src-"));
  await run("git", ["init", "-q", dir]);
  await run("git", ["-C", dir, "checkout", "-q", "-b", "main"]);
  await run("git", ["-C", dir, "config", "user.email", "minion@test"]);
  await run("git", ["-C", dir, "config", "user.name", "Minion"]);
  await writeFile(path.join(dir, "README.md"), "hello\n");
  await run("git", ["-C", dir, "add", "."]);
  await run("git", ["-C", dir, "commit", "-q", "-m", "init"]);
  return dir;
}

test("create clones the repo and checks out a per-run branch", async () => {
  const source = await makeSourceRepo();
  const clonesRoot = await mkdtemp(path.join(tmpdir(), "minion-clones-"));
  const env = new EnvManager(clonesRoot);
  try {
    const iso = await env.create("abc123", source, "main");

    // The clone exists and carries the source file.
    await stat(path.join(iso.cloneDir, "README.md"));

    // It is on the dedicated branch.
    const head = await run("git", ["-C", iso.cloneDir, "rev-parse", "--abbrev-ref", "HEAD"]);
    assert.equal(head.stdout.trim(), "minion/abc123");
    assert.equal(iso.branch, "minion/abc123");

    // destroy removes the clone.
    await env.destroy(iso.cloneDir);
    await assert.rejects(stat(iso.cloneDir));
  } finally {
    await rm(source, { recursive: true, force: true });
    await rm(clonesRoot, { recursive: true, force: true });
  }
});

test("create throws a clear error on a bad source", async () => {
  const clonesRoot = await mkdtemp(path.join(tmpdir(), "minion-clones-"));
  const env = new EnvManager(clonesRoot);
  try {
    await assert.rejects(env.create("x", "/no/such/repo", "main"), /git clone failed/);
  } finally {
    await rm(clonesRoot, { recursive: true, force: true });
  }
});
