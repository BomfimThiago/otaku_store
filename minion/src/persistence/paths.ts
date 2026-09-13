/**
 * Resolves the on-disk layout under `runs/` (SPEC §9.2).
 *
 *   runs/
 *     run-<id>.json   ← one run's state (sole writer: that run's task)
 *     run-<id>.log    ← append-only JSONL event log
 *     backlog.json    ← orchestrator only
 *     locks.json      ← orchestrator only
 */
import path from "node:path";

export interface StorePaths {
  runsDir: string;
  runJson(id: string): string;
  runLog(id: string): string;
  backlogJson: string;
  locksJson: string;
}

export function createPaths(runsDir: string): StorePaths {
  const abs = path.resolve(runsDir);
  return {
    runsDir: abs,
    runJson: (id) => path.join(abs, `run-${id}.json`),
    runLog: (id) => path.join(abs, `run-${id}.log`),
    backlogJson: path.join(abs, "backlog.json"),
    locksJson: path.join(abs, "locks.json"),
  };
}
