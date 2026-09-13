/**
 * Per-file lock scheduler (FR14, SPEC §9.1).
 *
 * In-memory, single-owner (the orchestrator). A run requests locks on the file
 * set from its approved plan. Acquisition is **all-or-nothing**: a run either
 * holds every file it needs or none — so it never waits while holding a partial
 * set, which rules out deadlock. Waiting runs sit in a FIFO queue and are
 * re-evaluated (greedy, in arrival order) whenever a holder releases.
 */
import type { FileLock, LockQueueEntry, LockTable } from "../types/index.js";

export interface AcquireResult {
  granted: boolean;
  /** When not granted, the held files this run is blocked on. */
  waitingOn: string[];
}

interface HeldLock {
  runId: string;
  since: string;
}

interface QueueEntry {
  runId: string;
  files: string[];
}

export class Scheduler {
  private readonly locks = new Map<string, HeldLock>();
  private readonly queue: QueueEntry[] = [];
  private readonly now: () => string;

  constructor(now: () => string = () => new Date().toISOString()) {
    this.now = now;
  }

  /**
   * Try to reserve `files` for `runId`. Grants only if every file is free
   * (or already held by this run); otherwise queues the run in FIFO order.
   */
  acquire(runId: string, files: string[]): AcquireResult {
    const conflicts = files.filter((f) => {
      const held = this.locks.get(f);
      return held !== undefined && held.runId !== runId;
    });

    if (conflicts.length === 0) {
      const since = this.now();
      for (const f of files) this.locks.set(f, { runId, since });
      this.dequeue(runId);
      return { granted: true, waitingOn: [] };
    }

    if (!this.queue.some((e) => e.runId === runId)) {
      this.queue.push({ runId, files: [...files] });
    }
    return { granted: false, waitingOn: conflicts };
  }

  /**
   * Release every lock held by `runId` (and drop it from the queue if present),
   * then grant any now-unblocked waiting runs. Returns the run ids newly granted,
   * so the orchestrator can wake them.
   */
  release(runId: string): string[] {
    for (const [file, held] of [...this.locks]) {
      if (held.runId === runId) this.locks.delete(file);
    }
    this.dequeue(runId);

    const grantedNow: string[] = [];
    for (let i = 0; i < this.queue.length; ) {
      const entry = this.queue[i]!;
      const free = entry.files.every((f) => {
        const held = this.locks.get(f);
        return held === undefined || held.runId === entry.runId;
      });
      if (free) {
        const since = this.now();
        for (const f of entry.files) this.locks.set(f, { runId: entry.runId, since });
        this.queue.splice(i, 1);
        grantedNow.push(entry.runId);
      } else {
        i++;
      }
    }
    return grantedNow;
  }

  /** Serializable view for `locks.json` and the dashboard (SPEC §9.2). */
  snapshot(): LockTable {
    const locks: FileLock[] = [...this.locks].map(([file, h]) => ({
      file,
      heldBy: h.runId,
      since: h.since,
    }));

    const waitingByFile = new Map<string, string[]>();
    for (const entry of this.queue) {
      for (const f of entry.files) {
        const held = this.locks.get(f);
        if (held !== undefined && held.runId !== entry.runId) {
          const list = waitingByFile.get(f) ?? [];
          list.push(entry.runId);
          waitingByFile.set(f, list);
        }
      }
    }
    const queue: LockQueueEntry[] = [...waitingByFile].map(([file, waiting]) => ({
      file,
      waiting,
    }));

    return { locks, queue, updatedAt: this.now() };
  }

  private dequeue(runId: string): void {
    const i = this.queue.findIndex((e) => e.runId === runId);
    if (i >= 0) this.queue.splice(i, 1);
  }
}
