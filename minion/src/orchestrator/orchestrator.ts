/**
 * The worker state machine (SPEC §5.2). Walks the declarative BLUEPRINT_NODES,
 * applies the loop-back + attempt-ceiling policy (§4), integrates the scheduler
 * (lock at `schedule`, release on terminal) and persists after every transition
 * so the dashboard sees live state (§9.2).
 *
 * All routing here is deterministic — the *judgment* lives in the injected node
 * handlers, never in the engine.
 */
import { BLUEPRINT_NODES } from "../blueprint.js";
import type { StateStore } from "../persistence/index.js";
import type { Scheduler } from "../scheduler/index.js";
import type {
  BlueprintNode,
  EscalationTrigger,
  LogActor,
  LogEvent,
  LogLevel,
  ModelTier,
  NodeType,
  StepStatus,
} from "../types/index.js";
import type { JudgeVerdict } from "../types/judge.js";
import type { MinionConfig } from "../types/config.js";
import type { BlueprintStep, Run } from "../types/run.js";
import { loopFor, type NodeHandlers, type NodeOutcome } from "./nodes.js";

export type WorkerStatus = "done" | "escalated" | "failed" | "blocked";

export interface WorkerResult {
  status: WorkerStatus;
  run: Run;
}

const nodeIndex = (node: BlueprintNode): number =>
  BLUEPRINT_NODES.findIndex((n) => n.node === node);

function actorFor(type: NodeType): LogActor {
  if (type === "judge") return "judge";
  if (type === "agent") return "agent";
  return "system";
}

export class Orchestrator {
  constructor(
    private readonly store: StateStore,
    private readonly scheduler: Scheduler,
    private readonly handlers: NodeHandlers,
    private readonly config: MinionConfig,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** Run one work item through the full blueprint. */
  async runWorker(run: Run): Promise<WorkerResult> {
    this.initSteps(run);
    run.status = "running";
    run.startedAt ??= this.now();
    await this.persist(run, "orchestrator", "info", "worker started");

    /** Occurrences per escalation ceiling (judge_plan / judge_impl / harness). */
    const loopCounts = new Map<EscalationTrigger, number>();
    let index = 0;

    while (index < BLUEPRINT_NODES.length) {
      const spec = BLUEPRINT_NODES[index]!;
      const loop = loopFor(spec.node);
      const attempt = loop ? (loopCounts.get(loop.escalation) ?? 0) + 1 : 1;

      const step = this.step(run, spec.node);
      step.status = "active";
      step.startedAt = this.now();
      if (spec.tier) step.modelTier = spec.tier as ModelTier;
      if (loop) {
        step.attempt = attempt;
        step.maxAttempts = this.config.attemptCeiling;
      }
      await this.persist(run, actorFor(spec.type), "info", `→ ${spec.label}`, spec.node);

      // Scheduler integration: reserve the plan's files at the first node.
      if (spec.node === "schedule") {
        const res = this.scheduler.acquire(run.id, run.lockedFiles);
        if (!res.granted) {
          step.status = "pending";
          step.summary = `waiting on ${res.waitingOn.join(", ")}`;
          run.status = "blocked";
          await this.persist(
            run,
            "orchestrator",
            "warn",
            `blocked on ${res.waitingOn.join(", ")}`,
            spec.node,
          );
          return { status: "blocked", run };
        }
      }

      const outcome = await this.dispatch(spec.node, run, attempt);

      if (outcome.kind === "reject" || outcome.kind === "fail") {
        step.status = "failed";
        if (outcome.kind === "reject") {
          run.verdicts.push(outcome.verdict);
          step.summary = outcome.verdict.critique;
        } else {
          step.summary = outcome.reason;
        }

        if (!loop) {
          run.status = "failed";
          run.finishedAt = this.now();
          this.scheduler.release(run.id);
          await this.persist(run, "orchestrator", "error", `failed at ${spec.node}`, spec.node);
          return { status: "failed", run };
        }

        const count = (loopCounts.get(loop.escalation) ?? 0) + 1;
        loopCounts.set(loop.escalation, count);
        await this.persist(
          run,
          "orchestrator",
          "warn",
          `attempt ${count}/${this.config.attemptCeiling} at ${spec.node} not accepted`,
          spec.node,
        );

        if (count >= this.config.attemptCeiling) {
          return this.escalate(run, loop.escalation, spec.node);
        }

        this.resetRange(run, loop.retryTo, spec.node);
        index = nodeIndex(loop.retryTo);
        continue;
      }

      if (outcome.kind === "skip") {
        step.status = "skipped";
        step.finishedAt = this.now();
        step.skippedReason = outcome.reason;
        await this.persist(run, actorFor(spec.type), "info", `skipped ${spec.node}: ${outcome.reason}`, spec.node);
        index++;
        continue;
      }

      // ok
      step.status = "done";
      step.finishedAt = this.now();
      if (outcome.summary) step.summary = outcome.summary;
      if (spec.type === "judge") {
        run.verdicts.push(outcome.verdict ?? this.approvedVerdict(spec.node, spec.tier as ModelTier | undefined));
      }
      await this.persist(run, actorFor(spec.type), "ok", `✓ ${spec.label}`, spec.node);
      index++;
    }

    run.status = "done";
    run.finishedAt = this.now();
    this.scheduler.release(run.id);
    await this.persist(run, "orchestrator", "ok", "worker done — PR ready");
    return { status: "done", run };
  }

  // ---- internals ----

  private async dispatch(node: BlueprintNode, run: Run, attempt: number): Promise<NodeOutcome> {
    const handler = this.handlers[node];
    if (!handler) return { kind: "ok" };
    return handler({ run, attempt, config: this.config });
  }

  private async escalate(
    run: Run,
    trigger: EscalationTrigger,
    node: BlueprintNode,
  ): Promise<WorkerResult> {
    run.status = "escalated";
    run.finishedAt = this.now();
    run.escalation = {
      trigger,
      message: `escalated at ${node} after ${this.config.attemptCeiling} attempts`,
      at: this.now(),
    };
    this.scheduler.release(run.id);
    await this.persist(run, "orchestrator", "error", `escalated: ${trigger}`, node);
    return { status: "escalated", run };
  }

  private initSteps(run: Run): void {
    run.steps = BLUEPRINT_NODES.map((n) => ({
      node: n.node,
      type: n.type,
      status: "pending" as StepStatus,
    }));
  }

  private step(run: Run, node: BlueprintNode): BlueprintStep {
    const s = run.steps.find((x) => x.node === node);
    if (!s) throw new Error(`step ${node} not initialized`);
    return s;
  }

  /** Mark the retry range back to pending so the rail reflects re-execution. */
  private resetRange(run: Run, fromNode: BlueprintNode, toNode: BlueprintNode): void {
    const from = nodeIndex(fromNode);
    const to = nodeIndex(toNode);
    for (let i = from; i <= to; i++) {
      const step = run.steps.find((x) => x.node === BLUEPRINT_NODES[i]!.node);
      if (step) step.status = "pending";
    }
  }

  private approvedVerdict(node: BlueprintNode, tier: ModelTier | undefined): JudgeVerdict {
    return {
      judge: node === "judge_plan" ? "plan" : "implementation",
      attempt: 1,
      verdict: "approved",
      score: 100,
      checklist: [],
      critique: "",
      modelTier: tier ?? "strong",
      at: this.now(),
    };
  }

  private async persist(
    run: Run,
    actor: LogActor,
    level: LogLevel,
    message: string,
    node?: BlueprintNode,
  ): Promise<void> {
    run.updatedAt = this.now();
    await this.store.writeRun(run);
    const ev: LogEvent = { ts: this.now(), actor, level, message };
    if (node) ev.node = node;
    await this.store.appendLog(run.id, ev);
  }
}
