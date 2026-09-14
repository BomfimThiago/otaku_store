/**
 * Loads the project config (SPEC §9.4). The Minion works on the repository it is
 * installed in — the target repo is auto-detected (`git rev-parse --show-toplevel`),
 * not passed as an argument. A `minion.config.json` at the repo root overrides the
 * defaults; without one, sensible defaults keep the engine runnable.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { run } from "../util/exec.js";
import type { MinionConfig } from "../types/config.js";

export interface LoadedConfig {
  config: MinionConfig;
  repoRoot: string;
  source: "file" | "default";
}

/** The git repository the current directory belongs to. */
export async function detectRepoRoot(cwd: string = process.cwd()): Promise<string> {
  const r = await run("git", ["-C", cwd, "rev-parse", "--show-toplevel"]);
  if (r.code !== 0) throw new Error(`not inside a git repository (cwd: ${cwd})`);
  return r.stdout.trim();
}

/** Defaults for a repo with no `minion.config.json`. Evals stay empty — they are
 *  project-specific and declared per repo, never hardcoded in the engine. */
export function defaultConfig(repoRoot: string): MinionConfig {
  return {
    repo: { source: repoRoot, defaultBranch: "main", integrationBranch: "develop" },
    commands: {
      lint: "echo '(no lint configured — set commands.lint in minion.config.json)'",
      test: "echo '(no tests configured — set commands.test in minion.config.json)'",
    },
    evals: [],
    frontendGlobs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css", "**/*.html"],
    parallelism: 2,
    attemptCeiling: 2,
  };
}

export async function loadConfig(cwd: string = process.cwd()): Promise<LoadedConfig> {
  const repoRoot = await detectRepoRoot(cwd);
  const base = defaultConfig(repoRoot);
  const file = path.join(repoRoot, "minion.config.json");

  // MINION_REPO_SOURCE overrides where runs clone from (e.g. an HTTPS-with-token
  // URL on a server that has no SSH key). Applied to both file and default config.
  const applyEnv = (c: MinionConfig): MinionConfig => {
    const src = process.env.MINION_REPO_SOURCE;
    return src ? { ...c, repo: { ...c.repo, source: src } } : c;
  };

  if (!existsSync(file)) return { config: applyEnv(base), repoRoot, source: "default" };

  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<MinionConfig>;
  const config: MinionConfig = {
    ...base,
    ...parsed,
    repo: { ...base.repo, ...(parsed.repo ?? {}) },
    commands: { ...base.commands, ...(parsed.commands ?? {}) },
  };
  return { config: applyEnv(config), repoRoot, source: "file" };
}
