/**
 * The single interface both the orchestrator (writer) and the dashboard (reader)
 * use to reach the `runs/` state (SPEC §9.2). The store is thin: it maps domain
 * objects to files and enforces atomic writes; all coordination lives in the
 * orchestrator (SPEC §9.1).
 */
import { readdir } from "node:fs/promises";
import type { Backlog, LockTable, LogEvent, Run } from "../types/index.js";
import { appendJsonl, readJson, readJsonl, writeJsonAtomic } from "./atomic.js";
import { createPaths, type StorePaths } from "./paths.js";

export class StateStore {
  private readonly paths: StorePaths;

  constructor(runsDir: string) {
    this.paths = createPaths(runsDir);
  }

  get runsDir(): string {
    return this.paths.runsDir;
  }

  // ---- per-run state (one writer: that run's task) ----

  async writeRun(run: Run): Promise<void> {
    await writeJsonAtomic(this.paths.runJson(run.id), run);
  }

  async readRun(id: string): Promise<Run | undefined> {
    return readJson<Run>(this.paths.runJson(id));
  }

  /** All runs on disk, for the dashboard sidebar. Missing/partial files are skipped. */
  async listRuns(): Promise<Run[]> {
    let entries: string[];
    try {
      entries = await readdir(this.paths.runsDir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const ids = entries
      .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
      .map((f) => f.slice("run-".length, -".json".length));
    const runs = await Promise.all(ids.map((id) => this.readRun(id)));
    return runs.filter((r): r is Run => r !== undefined);
  }

  // ---- per-run append-only log ----

  async appendLog(runId: string, event: LogEvent): Promise<void> {
    await appendJsonl(this.paths.runLog(runId), event);
  }

  async readLog(runId: string): Promise<LogEvent[]> {
    return readJsonl<LogEvent>(this.paths.runLog(runId));
  }

  // ---- shared state (orchestrator only) ----

  async writeBacklog(backlog: Backlog): Promise<void> {
    await writeJsonAtomic(this.paths.backlogJson, backlog);
  }

  async readBacklog(): Promise<Backlog | undefined> {
    return readJson<Backlog>(this.paths.backlogJson);
  }

  async writeLocks(locks: LockTable): Promise<void> {
    await writeJsonAtomic(this.paths.locksJson, locks);
  }

  async readLocks(): Promise<LockTable | undefined> {
    return readJson<LockTable>(this.paths.locksJson);
  }
}
