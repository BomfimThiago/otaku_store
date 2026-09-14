# SPEC.md — Engineering Specification

Brief, self-contained engineering spec for **Minion Console**. The full spec
(functional requirements FR1–FR25, architecture diagrams, implementation
decisions) lives in [`minion/SPEC.md`](../minion/SPEC.md); the product it builds
is specified in [`store/MVP_SPEC.md`](../store/MVP_SPEC.md) (shipped) and
[`store/STORE_SPEC.md`](../store/STORE_SPEC.md) (original ambition).

## Objective

Build a hackathon-scale version of Stripe's "Minions" pattern: an **unsupervised
orchestrator of coding agents** that takes a work item — a free-text task, a
GitHub issue, or a whole product spec — and drives it to a reviewed pull request:
plan → judge → implement (TDD) → judge → verify with a harness → open PR, with the
minimum human intervention and the maximum *visible* verification. The engineering
**system is the deliverable**; the OtakuVerso store is what it builds to prove it.

## Requirements (summary)

Full table FR1–FR25 in [`minion/SPEC.md` §3](../minion/SPEC.md). In brief:

- **Entry & isolation** — accept task/issue/spec (FR1); every run in a fresh clone
  + branch, created and destroyed automatically (FR2).
- **Judged pipeline** — parallel context gathering (FR3); a plan before any edit
  (FR4); a **plan Judge** and an **implementation Judge** with structured verdicts
  (FR5, FR7); rejections loop back, bounded (FR6, FR8).
- **Deterministic harness** — static evals always run (FR9); lint+tests always run
  and a failure re-implements (FR10); Playwright E2E fires only if the plan touches
  frontend files (FR11); rebase before PR (FR12) with one agent conflict-resolution
  attempt + full re-verify (FR13); per-file lock scheduler (FR14).
- **Roadmap layer** — accept a product spec (FR18); an agent decomposes it into an
  atomic backlog (FR19); a **backlog Judge** gates coverage (FR20); a deterministic
  graph + priority + dispatch loop fires ready items in parallel (FR21, FR22);
  passing items auto-merge into `develop` (FR23); a final product-journey E2E and a
  **product Judge** close the build (FR24, FR25).
- **Observability** — a live dashboard of runs, blueprint, log, verdicts and diff
  (FR16); every node records its model tier (FR17).

## Constraints

- **Determinism wherever possible** — any decision not needing judgment (file
  locks, running the linter, deciding whether to fire E2E) is pure code, never an
  LLM call.
- **A single attempt ceiling of 2** on every automatic loop (plan, implementation,
  tests, conflict) — no infinite loops; the 3rd failure escalates to a human.
- **Fixed human-escalation triggers only** — 2× Judge rejection, 2× harness
  failure, an out-of-scope or unresolved merge conflict, 2× backlog/product-Judge
  rejection, and the `develop → main` promotion (always a human click).
- **Reproducibility** — any run is reconstructable from its recorded log (task,
  plan, diffs, verdicts, times).
- **Model tiering** — planning/judging use the strongest model; mechanical
  implementation uses the fastest.

## Proposed architecture

Two layers (diagrams in [`minion/SPEC.md` §5](../minion/SPEC.md)):

1. **Roadmap layer** (`minion/src/roadmap/`) — decompose → backlog-Judge → graph +
   priority → dispatch loop → auto-merge to `develop` → product-Judge → finalize PR.
   LLM only for decomposition + judging; graph, priority, dispatch and git are code.
2. **Per-item worker blueprint** (`minion/src/orchestrator/` + `worker/`) — a
   deterministic 12-node state machine: `schedule → isolate → context → plan →
   judge_plan → implement → judge_impl → static_evals → lint_tests → e2e → sync →
   open_pr`. Judgment lives only in the AGENT/JUDGE nodes; routing and the attempt
   ceiling are pure code. A **live trigger** (`--enable-trigger`) exposes
   `run --issue N --pr` over HTTP so a GitHub issue can be resolved from a URL.

Agents/skills are markdown under `minion/.claude/`, loaded at runtime through the
Claude Agent SDK `query()`. Isolation is a fresh clone + branch per run;
`settingSources: []` stops the target repo's own config from leaking into context.

## Major technical decisions

- **Judge ≠ Agent** — a Judge only evaluates and returns `{verdict, score,
  checklist, critique}`; it never edits code. Each role's model swaps independently.
- **The approved plan is one source of truth**, reused three ways: the impl Judge's
  answer key, the scheduler's lock key, and the E2E fire/skip decision.
- **A merge conflict is never accepted blindly** — an agent may resolve it, but
  acceptance requires re-running the whole harness.
- **Model tiering is explicit** (logged, shown in the dashboard), not hidden.
- **Judgment vs. guarantees** — the whole design uses agents where judgment helps
  and deterministic code where guarantees matter. This is what makes the autonomy
  reliable rather than hopeful.

## Definition of Done

Verifiable against a real run (full checklist in
[`minion/SPEC.md` §8](../minion/SPEC.md)). The headline criteria — all
demonstrated:

- A work item runs **scheduling → open PR with no human instruction in between**
  (proven: issue #10 → run `mu1im01x` → PR #11, from a public URL).
- At least **one complete recovery loop** is recorded (Judge rejects → agent fixes
  → Judge approves) — see [`AI-DEV-LOG.md` §2](./AI-DEV-LOG.md).
- Every automatic loop honours the **2-attempt ceiling** and escalates past it.
- The **dispatch loop runs independent items in genuine parallel**, gated by the
  dependency graph + per-file lock; auto-merge to `develop` needs no human click.
- Any completed run is **reconstructable from its recorded log**
  (`minion/runs/*.json` + `.log`), and the **dashboard reflects real state**.

## Related

- Agentic system map: [`SYSTEM.md`](./SYSTEM.md)
- Development log + autonomous-loop evidence: [`AI-DEV-LOG.md`](./AI-DEV-LOG.md)
- Full engineering spec: [`minion/SPEC.md`](../minion/SPEC.md) · external tools:
  [`minion/MCP.md`](../minion/MCP.md) · setup & run: [`README.md`](../README.md)
