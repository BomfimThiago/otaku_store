/**
 * The per-file lock table and FIFO queue (FR14, SPEC §9.1). Held in memory and
 * owned solely by the orchestrator; mirrored to `locks.json` for the dashboard.
 */
import type { Timestamp } from "./common.js";

export interface FileLock {
  file: string;
  /** Run id currently holding the lock. */
  heldBy: string;
  since: Timestamp;
}

export interface LockQueueEntry {
  file: string;
  /** Run ids waiting for this file, in FIFO order. */
  waiting: string[];
}

export interface LockTable {
  locks: FileLock[];
  queue: LockQueueEntry[];
  updatedAt: Timestamp;
}
