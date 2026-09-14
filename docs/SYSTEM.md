# SYSTEM.md — Agentic System Map

> How this project is engineered as a **system of agents**, not a prompt. The
> product itself — **Minion Console** — *is* an agentic engineering system: an
> unsupervised orchestrator of coding agents that takes a product specification
> and builds the product, self-verifying at every step. To prove it, the Minion
> builds a real store (**OtakuVerso**, `store/STORE_SPEC.md`) into the same repo
> it lives in.
>
> Engineering spec: [`minion/SPEC.md`](../minion/SPEC.md). External tools:
> [`minion/MCP.md`](../minion/MCP.md). Development narrative + autonomous-loop
> evidence: [`AI-DEV-LOG.md`](./AI-DEV-LOG.md).

---

## 1. The core idea: judgment vs. guarantees

Every design decision follows one rule (SPEC §4):

> **Use agents (LLMs) where judgment is useful. Use deterministic code where
> guarantees are useful.**

| Deterministic (pure code — guarantees) | Agentic (LLM — judgment) |
|---|---|
| Work-item type detection (spec / task / issue) | Decomposing a spec into a backlog |
| Dependency graph + topological order + priority | Judging a backlog / plan / implementation |
| Dispatch loop (readiness, parallelism, ordering) | Planning a change |
| Per-file lock scheduler (FIFO) | Implementing from an approved plan |
| Git isolation (clone + branch), commit, rebase | Gathering context (repo + official docs) |
| Auto-merge to `develop` (git worktree) | Resolving a merge conflict |
| Harness: lint / tests / static evals / E2E gate | — |
| Attempt-ceiling routing (loop back / escalate) | — |

The engine never asks an LLM to do something a deterministic control can
guarantee. This is what makes the autonomy *reliable* rather than hopeful.

---

## 2. Two layers

### 2.1 Roadmap layer (self-coordination) — `minion/src/roadmap/`

Turns one spec into a built product:

```
store/STORE_SPEC.md
   → roadmap-planner (AGENT, opus)      decompose into atomic backlog items
   → topologicalOrder (DET)             validate the dependency graph
   → backlog-judge (JUDGE, opus)        approve / reject  ── reject (≤2×) ─┐
   → computePriorities (DET)            unblocked-count × weight           │ re-decompose
   → dispatch loop (DET)                fire ready items in parallel  ◄─────┘
        └─ each ready item → the §2.2 worker → auto-merge into develop
   → (full build) push develop → open PR develop→main → clean up
```

### 2.2 Per-item worker blueprint — `minion/src/orchestrator/` + `minion/src/worker/`

A deterministic state machine (`orchestrator.ts`) walks a declarative 12-node
blueprint (`blueprint.ts`); each node's work is an injected handler
(`worker/handlers.ts`). Judgment lives only in the AGENT/JUDGE handlers; the
routing (loop-back on rejection, attempt ceiling, escalation) is pure code.

```
schedule(DET) → isolate(DET) → context(AGENT ∥) → plan(AGENT) → judge_plan(JUDGE)
   → implement(AGENT) → judge_impl(JUDGE) → static_evals(DET) → lint_tests(DET)
   → e2e(DET, conditional) → sync(DET→AGENT on conflict) → open_pr(DET)
```

Rejections/failures loop back to the offending stage, bounded by a single
**attempt ceiling of 2** across every loop (plan, implementation, tests, merge).
On the 3rd failure the run **escalates to a human** rather than looping forever.

---

## 3. Agents, skills, and how they're loaded

Agents and skills are **markdown definitions** under `minion/.claude/`, loaded at
runtime by `SdkAgentRunner` (`src/agent/sdk-runner.ts`) via the **Claude Agent
SDK** `query()`. Each Minion node runs exactly one named agent: the runner reads
its definition, uses the body as the system prompt, the `model` frontmatter as
the model tier, `tools` as the allowed tools, and **inlines any referenced
skill** into the prompt. `cwd` is the run's isolated clone, so edits land there.

**Subagents** (`.claude/agents/`):

| Agent | Tier | Role |
|---|---|---|
| `roadmap-planner` | opus (strong) | decompose the spec into a backlog (uses `decompose-spec`) |
| `backlog-judge` | opus | judge the decomposition (uses `judging`) |
| `planner` | opus | plan one item before any edit |
| `plan-judge` | opus | judge the plan against acceptance criteria (uses `judging`) |
| `implementer` | sonnet (fast) | implement from the approved plan (TDD) |
| `impl-judge` | opus | judge the diff against the plan (uses `judging`) |
| `conflict-resolver` | sonnet | one attempt at a rebase conflict, then re-verify |
| `product-judge` | opus | judge the final product against the spec (uses `judging`) |

**Skills** (`.claude/skills/`): `decompose-spec`, `judging` (the shared Judge
rubric), `gather-internal-context`, `gather-official-sources`.

**Judge ≠ Agent.** A Judge only evaluates and returns a structured verdict
(`{verdict, score, checklist, critique}`); it never edits code. Structured output
is validated at the boundary (`src/agent/parse.ts`) so a stochastic model can
never feed malformed data into the deterministic engine — a malformed verdict
fails loudly and loops.

**Model tiering** is explicit: high-impact judgment (planning, all judging,
decomposition) uses the strong model (opus); mechanical work (implementing from
an approved plan, conflict resolution) uses the fast model (sonnet).

---

## 4. Context engineering

- **Fresh context per node.** Each agent invocation is a self-contained `query()`
  with only its own system prompt + the task/context it needs — no accumulated
  chat. A judge sees the answer key and the artifact, nothing else.
- **Isolation per run.** Every item runs in a **fresh git clone + dedicated
  branch** (`env/env-manager.ts`), not just a worktree — two runs can never see
  each other's uncommitted state. `settingSources: []` stops the target repo's
  own `.claude`/`CLAUDE.md` from leaking into agent context.
- **Parallel context gathering.** Two skills run **concurrently** per item —
  `gather-internal-context` (repo + internal docs) and `gather-official-sources`
  (Tavily + Context7 for current library docs) — then consolidate into one
  grounding block for the planner (`worker/handlers.ts` → `context`).
- **The approved plan is a single source of truth**, reused three ways: the impl
  Judge's answer key, the scheduler's lock key, and the E2E fire/skip decision.

---

## 5. External tools (MCP) — `minion/MCP.md`

MCP servers exist only where an *agent* needs to reach outside the repo;
deterministic nodes use plain `git`/`gh`/test-runner CLIs.

| MCP | Consumed by | For |
|---|---|---|
| **Tavily** | `gather-official-sources` (AGENT) | live web search over official docs |
| **Context7** | `gather-official-sources` (AGENT) | version-pinned library docs |
| **GitHub** | sync / PR context (AGENT read) | PR/branch state (writes via `gh` CLI) |
| **Playwright** | E2E recovery (AGENT) | drive the browser to diagnose failures |

All four verified live (`MCP.md`). Secrets live in a git-ignored `.env`;
`.mcp.json` references `${VAR}` only.

---

## 6. Orchestration & delegation

Single front door: **`minion run <work item>`** (`src/cli/run.ts`). Type is
detected deterministically:

- a `.md` path → **roadmap layer** (build the whole spec);
- `--issue N` or free text → **one worker blueprint**.

Delegation is meaningful, not cosmetic: each boundary exists for **context
isolation** (a fresh clone + fresh agent context per item) or **specialization**
(planner ≠ implementer ≠ judge, each a different model tier and system prompt).
The roadmap "maestro" (`roadmap/roadmap.ts`) composes the pieces; the dispatch
loop (`roadmap/dispatch.ts`) delegates each ready item to the worker.

---

## 7. Parallelization (evidence)

Two independent axes of parallelism, both real:

1. **Context gathering** — the 2 context skills run concurrently *within* each
   item (`Promise.all` in the `context` handler).
2. **Item dispatch** — the dispatch loop runs up to `parallelism` items at once,
   gated by the dependency graph and the per-file lock scheduler.

**Observed** (capped 2-item build, `parallelism 2`):

```
dispatching 2 items (parallelism 2)…
[integrate] fnd-1-monorepo-scaffold → develop
[integrate] dom-1-pricing-module   → develop
══ roadmap: DELIVERED ══   done: 2 · failed: 0 · escalated: 0 · unreached: 0
```

The scheduler (`scheduler/scheduler.ts`) makes parallelism safe: it locks each
item's files (all-or-nothing, FIFO) so two concurrent items can never edit the
same file. Merges into `develop` are serialized (one worktree) even while the
workers themselves run in parallel.

---

## 8. How outputs are integrated

Auto-merge to `develop` (FR23, `roadmap/integrate.ts`), without touching the
engineer's own checkout:

- A dedicated **git worktree** (`minion/integration`) holds `develop`; the
  engineer stays on `main`, untouched.
- Each item's work reaches the repo by **pushing its branch** from the item's
  clone (whose `origin` is the repo), then the worktree **merges it** (`--no-ff`).
- The next item bases off the now-updated `develop`, so the product grows item by
  item. Verified — `develop` accumulated both a scaffold and a pricing module
  across two items, with a clean history.
- On a **complete** build the roadmap pushes `develop`, opens the **`develop →
  main` PR** (the one merge that always needs a human, SPEC §4), and removes the
  worktree.

---

## 9. Human as orchestrator

The human sets goals and makes judgment calls; the system handles the repetition.
Fixed human touchpoints only:

- **Before:** authored the specs (`minion/SPEC.md`, `store/STORE_SPEC.md`), chose
  the architecture (judgment-vs-guarantees split, two layers, in-repo install
  model), the tech stack, the pricing rules, and the TDD-first policy.
- **During (escalation triggers, SPEC §4):** a Judge rejects 2× in a row; the
  harness fails 2× in a row; a merge conflict escapes the plan's scope or
  survives one resolution attempt; the backlog Judge rejects 2×; the product
  Judge rejects 2×.
- **After:** the **`develop → main` promotion PR** — the only merge that always
  requires a human click.

Everything between those points runs without a human in the loop — see the
autonomous-loop evidence in [`AI-DEV-LOG.md`](./AI-DEV-LOG.md).

---

## 10. Reproducibility

- `minion dashboard` serves the live state read from `minion/runs/*.json` (+ the
  append-only `.log`); every run is reconstructable from that record.
- `minion.config.json` (or built-in defaults) declares the project's
  lint/test/e2e commands and eval set, keeping the engine generic.
- Setup and commands: [`README.md`](../README.md).
