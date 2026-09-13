/**
 * Structured Judge output (FR5, FR7, FR20, FR25). Every Judge — plan,
 * implementation, backlog, product — returns this same shape via the shared
 * judging skill (SPEC §5.2 components).
 */
import type { JudgeKind, ModelTier, Timestamp } from "./common.js";

export type Verdict = "approved" | "rejected";

export interface ChecklistItem {
  label: string;
  passed: boolean;
}

export interface JudgeVerdict {
  judge: JudgeKind;
  /** 1-based attempt this verdict evaluated. */
  attempt: number;
  verdict: Verdict;
  /** 0–100. */
  score: number;
  checklist: ChecklistItem[];
  /** Free-text critique fed back to the agent on rejection. */
  critique: string;
  modelTier: ModelTier;
  at: Timestamp;
}
