/**
 * Append-only event log (SPEC §9.2), persisted as `runs/run-<id>.log` in JSONL
 * (one JSON object per line). A single writer appends; a truncated last line on
 * crash is simply skipped by the reader.
 */
import type { BlueprintNode, Timestamp } from "./common.js";

export type LogActor = "orchestrator" | "agent" | "judge" | "system";

export type LogLevel = "info" | "ok" | "warn" | "error";

export interface LogEvent {
  ts: Timestamp;
  actor: LogActor;
  level: LogLevel;
  /** Blueprint node this event belongs to, when applicable. */
  node?: BlueprintNode;
  message: string;
  /** Optional structured payload. */
  data?: unknown;
}
