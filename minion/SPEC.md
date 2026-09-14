# SPEC.md — Minion Console

## 1. Objective

Build a version of Stripe's "Minions" pattern: an **unsupervised** orchestrator of coding
agents that receives a task in natural language, plans, implements, self-verifies,
self-corrects within an attempt ceiling, and delivers a PR ready for review — with the
minimum possible human intervention and the maximum visible verification reasoning
(harness).

The final product has two parts:
1. **Orchestrator** (CLI + background process) — runs the blueprint end to end.
2. **Dashboard** — visualizes, in real time, the blueprint state, the Judges' verdicts, the
   execution log and the generated diff.

## 2. Scope

**In scope:**
- Full blueprint (scheduling → isolation → context → plan → implementation →
  verification → synchronization → PR) running against a task, spec, or issue.
- Isolation per run via a **fresh clone of the repository + a new branch**. A `git
  worktree` alone is not enough: two agents operating on the same underlying repository
  can still collide, so each run gets its own clone to guarantee true isolation.
- Parallel context gathering (code + "internal" source via local markdown; official
  sources via a real search API, e.g. Tavily).
- Two Judges (plan and implementation) with structured output (score + checklist + critique).
- Per-file lock scheduler, with queue and visible blocking.
- Synchronization with `main` via deterministic rebase + 1 agent-assisted conflict
  resolution attempt, always followed by a full re-verification.
- Deterministic static evals — **project-specific, still to be defined for this store**
  (not left generic, so each eval is easy to explain and justify).
- End-to-end tests with Playwright, as a conditional node (only fires if the plan touches
  frontend files).
- Web dashboard showing the live blueprint, including multiple simultaneous runs.

**Out of scope:**
- Real integration with Confluence/Slack (replaced by local markdown that fulfills the
  same architectural role).
- A real remote CI — the "CI" is the local execution of the harness itself.
- Authentication/multi-user in the dashboard.
- Complex multi-file merge conflict resolution — the agent tries once; beyond that, it
  escalates to a human.

## 3. Functional requirements

| # | Requirement |
|---|---|
| FR1 | The system accepts a work item as free text — a task, spec, or issue — as the entry point for a run. |
| FR2 | Each run runs in an isolated environment (fresh clone + dedicated branch), created and destroyed automatically. |
| FR3 | Context gathering (code + internal RAG, and official sources) runs in parallel via two dedicated skills. |
| FR4 | A plan is generated before any code edit. |
| FR5 | The plan is approved or rejected by a Judge with structured output (score, checklist, critique). |
| FR6 | A rejected plan goes back for replanning, up to 2 attempts; beyond that, it escalates to a human. |
| FR7 | The implementation is evaluated by a second Judge, comparing the diff against the approved plan. |
| FR8 | A rejected implementation goes back for reimplementation with the Judge's critique, up to 2 attempts; beyond that, it escalates to a human. |
| FR9 | Deterministic static evals always run, without involving an LLM. |
| FR10 | Lint and tests always run; a failure triggers reimplementation, up to 2 attempts; beyond that, it escalates to a human. |
| FR11 | E2E via Playwright runs only if the approved plan lists frontend files. |
| FR12 | Before the PR, the branch is synchronized (`rebase`) against the current `main`. |
| FR13 | A rebase conflict triggers 1 agent-driven resolution attempt, followed by a full re-run of the harness. |
| FR14 | The scheduler prevents two simultaneous runs from editing the same file at the same time (per-file lock, FIFO queue). |
| FR15 | Backlog items can declare an explicit dependency on other items (`depends_on: item_id`). |
| FR16 | The dashboard shows, live: all active/queued/blocked runs, the selected run's blueprint, the log, the Judges' verdicts and the diff. |
| FR17 | Each agentic/Judge node records which model "tier" was used. |
| FR18 | The system accepts a product specification document (e.g. `store/STORE_SPEC.md`) instead of loose tasks. |
| FR19 | An agent decomposes the specification into a backlog of atomic items, each with a description, acceptance criteria, likely files and declared dependencies relative to other items. |
| FR20 | A backlog Judge approves or rejects the decomposition, checking full coverage of the specification, adequate item sizing and dependency coherence (same ceiling of 2 attempts before escalating). |
| FR21 | From the approved backlog, the system builds a dependency graph and computes priority deterministically (number of items unblocked × MVP/nice-to-have weight) — no LLM decides execution order at runtime. |
| FR22 | A continuous, deterministic dispatch loop fires every "ready" item (no pending dependency and no conflicting file lock) respecting a configurable parallelism limit, until the backlog empties. |
| FR23 | PRs that pass the entire harness (both Judges + evals + tests + E2E) auto-merge into an integration branch (`develop`), with no per-item human review. |
| FR24 | When the backlog empties, a full product-journey E2E suite runs; a failure here becomes a new backlog item (same mechanism, no special case) instead of stalling the system. |
| FR25 | A product Judge compares the final result against the original specification before marking the delivery as complete. |

## 4. Non-functional requirements / constraints

- **Determinism wherever possible.** Any decision that does not require judgment (file
  lock, running the linter, deciding whether to fire E2E) is pure code, never an LLM
  call — a principle inherited directly from Stripe's blueprint model.
- **Single, consistent attempt ceiling**: every automatic correction (plan, implementation,
  tests, merge conflict) respects the same limit of 2 attempts before escalating to human
  review. There is no "infinite loop" in any node.
- **Minimal human intervention at fixed points.** Only these triggers call a human:
  1. A Judge (plan or implementation) rejects 2 times in a row.
  2. The full harness fails 2 times in a row.
  3. A merge conflict touches a file outside the scope of the approved plan.
  4. A merge conflict persists after the resolution attempt + full re-verification.
  5. The backlog Judge rejects the decomposition 2 times in a row (ambiguous or poorly covered spec).
  6. The product Judge rejects the final delivery 2 times in a row.
  7. Promotion from `develop` to `main` — the only merge that **always** requires a human click.
- **Reproducibility**: any run must be reconstructable from the recorded log (original
  task, approved plan, diffs, verdicts, times).
- **Model tiering**: planning and judging nodes use the strongest model available;
  implementation/correction nodes use the fastest/cheapest model.

## 5. Proposed architecture

### 5.1 Self-coordination layer (Roadmap Planner)

Sits **above** the per-backlog-item blueprint (section 5.2) and is what allows feeding the
system an entire product specification instead of loose items:

```
   store/STORE_SPEC.md (or equivalent spec)
              ▼
   ┌───────────────────────┐
   │  Decompose into backlog│  AGENT (strong model)
   └──────────┬─────────────┘
              ▼
   ┌───────────────────────┐
   │  Judge · backlog       │  JUDGE ──► rejected (max 2x) ──┐
   └──────────┬─────────────┘                                │
              ▼ approved                                      │
   ┌───────────────────────┐                                  │
   │ Graph + priority       │  DET  (topological sort +        │
   └──────────┬─────────────┘   deterministic score)           │
              ▼                                                │
   ┌───────────────────────┐                                  │
   │  Dispatch loop         │  DET  (respects parallelism +    │
   └──────────┬─────────────┘   file lock from section 5.2)    │
              ▼                                                │
     [each ready item enters the section 5.2 blueprint] ───────┘ (failure becomes a new item)
              ▼
   ┌───────────────────────┐
   │  Auto-merge            │  DET  → integration branch (develop)
   └──────────┬─────────────┘
              ▼
     backlog empty? ──no──► back to the dispatch loop
              │ yes
              ▼
   ┌───────────────────────┐
   │ Full-product E2E       │  DET
   └──────────┬─────────────┘
              ▼
   ┌───────────────────────┐
   │  Judge · product       │  JUDGE ──► rejected ──► becomes a new backlog item
   └──────────┬─────────────┘
              ▼ approved
        ready for human promotion develop → main
```

### 5.2 Per-backlog-item blueprint (worker)

```
                     ┌────────────────────────┐
  backlog item ─────►│ Schedule / lock files   │  DET
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │    Isolate environment  │  DET   (fresh clone + branch)
                     └───────────┬────────────┘
                                 ▼
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
   ┌─────────────────────┐               ┌─────────────────────────┐
   │ Internal context/RAG │  AGENT        │ Official sources (Tavily)│ AGENT   (parallel skills)
   └──────────┬───────────┘               └────────────┬────────────┘
              └──────────────────┬──────────────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │    Present plan         │  AGENT  (strong model)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │   Judge · plan          │  JUDGE  (strong model) ──┐
                     └───────────┬────────────┘                          │ rejected (max 2x)
                                 ▼ approved                               │
                     ┌────────────────────────┐                          │
                     │      Implement          │◄─────────────────────────┘
                     └───────────┬────────────┘  AGENT (fast model)
                                 ▼
                     ┌────────────────────────┐
                     │ Judge · implementation  │  JUDGE (strong model) ──┐
                     └───────────┬────────────┘                         │ rejected (max 2x)
                                 ▼ approved                              │
                     ┌────────────────────────┐                         │
                     │   Static evals          │  DET                    │
                     └───────────┬────────────┘                         │
                                 ▼                                      │
                     ┌────────────────────────┐                         │
                     │   Lint + tests          │  DET ────────────────────┘ (failure)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │  E2E (Playwright)       │  DET  (conditional: only if it touches frontend)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │ Sync with main          │  DET → AGENT if conflict → DET (re-verifies everything)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │       Open PR           │  DET
                     └────────────────────────┘
```

**Components:**

Every component is built from a specific agentic primitive, chosen by the same determinism
rule as §4 (and the MCP rule in `MCP.md`). We deliberately use each primitive only where it
fits, rather than sprinkling them everywhere:

- **Subagents** — for any role that needs isolated context or a distinct persona: the coding
  implementer, the merge-conflict resolver, and every Judge. Running Judges as separate
  subagents keeps "who decides what to do" and "who checks whether it was done well" in
  independent contexts (§7).
- **Skills** — for reusable, prompt-driven procedures invoked across runs: two
  **context-gathering skills** (internal-RAG and official-sources), which the `orchestrator`
  fires in parallel; a single **judging skill** (the score + checklist + critique rubric)
  shared by all three Judges; and a **decomposition skill** for turning a spec into a
  backlog. One rubric, reused, keeps every verdict consistent.
- **MCP servers** — for any agent that must reach outside the repo (see `MCP.md`): Tavily,
  Context7, GitHub, Playwright.
- **Deterministic code, CLI & hooks** — for everything that must be *guaranteed* rather than
  *judged*: the state machine, the scheduler, all `git`/`gh` operations, the harness, and
  the dispatch loop. Hooks enforce the guardrails (e.g. blocking an edit to a file the run
  does not hold the lock for).

| Component | Responsibility | Built as |
|---|---|---|
| `orchestrator` | Runs the blueprint state machine; decides which node runs next. | DET host process (Agent SDK); not an LLM — it invokes every node below. |
| `scheduler` | Maintains the per-file lock table and the queue of blocked runs. | DET code, keyed on the approved plan's file list; enforced via hooks. |
| `env_manager` | Creates/destroys the isolated environment (fresh clone + dedicated branch) per run. | DET `git` CLI. |
| `context_gatherer` | Fires the 2 context skills in parallel and consolidates the result. | 2 **skills** (internal-RAG, official-sources), each scoped to its MCP tools; dispatched in parallel by the `orchestrator`. |
| `implementer` | Writes the diff from the approved plan, and reworks it on a Judge's critique. | Coding **subagent**, fast-model tier. |
| `plan_judge` / `impl_judge` | Evaluate with structured output (fixed schema: score, checklist, critique). | Read-only **judge subagents** (strong tier) driven by the shared **judging skill**. |
| `harness_runner` | Runs lint, tests, static evals and Playwright; interprets the results deterministically. | DET CLIs + custom eval scripts; no LLM. |
| `sync_manager` | Runs the rebase, detects conflict, triggers the resolution agent, re-runs the harness. | DET `git rebase` → conflict-resolution **subagent** (GitHub MCP) only on conflict → DET re-run. |
| `dashboard` | Front-end that reads the orchestrator state (polling or SSE) and renders the live blueprint. | Plain web app (not agentic); verified by its own Playwright suite (§6.4). |
| `roadmap_planner` | Decomposes the specification into a backlog, builds the dependency graph and computes priority. | Decomposition **subagent** (strong tier) via the **decomposition skill**, then DET code for graph + priority. |
| `dispatch_loop` | Continuous process that dispatches "ready" backlog items respecting parallelism and locks. | DET code. |
| `product_judge` | Evaluates the final delivery against the original specification; failures become new backlog items. | Read-only **judge subagent** (strong tier), same **judging skill**. |

## 6. Dashboard

The dashboard is the second half of the deliverable (§1). It is a **read-only window into
the orchestrator**: it reflects state, it never drives the pipeline. The only human actions
it exposes are the fixed escalation points from §4 (never a step that the orchestrator would
otherwise take on its own). It must render the orchestrator's **real** state, never mocked
data (see §8).

### 6.1 Views

- **Run view (worker, mirrors §5.2).** A sidebar lists every run with its status
  (active / queued / blocked, with the blocking file when blocked). Selecting a run shows:
  its blueprint as a vertical rail of nodes, a live execution log, the Judges' verdicts
  (score + checklist + critique) and the generated diff. This is exactly what
  `minion-console.html` mocks up today.
- **Roadmap view (coordination, mirrors §5.1).** The decomposed backlog, the dependency
  graph, which items are ready / blocked / running, auto-merges into `develop`, and the
  final product-Judge verdict. This is the "view from above" that the current mockup does
  not yet cover.

### 6.2 What the run view shows per node

- **Node type**, colour-coded: deterministic (DET), agent (AGENT), judge (JUDGE) — the same
  taxonomy used throughout the SPEC.
- **State**: pending / active / done / failed, plus a loop-back indicator when a Judge
  rejects and the node re-runs (attempt N/2).
- **Model tier** used by each agentic/Judge node (FR17).
- **Conditional nodes** shown as deterministically skipped when they don't apply (e.g. E2E
  when the plan touches no frontend files).
- A **scheduler panel** with the active per-file locks and the queue of runs waiting behind
  them (FR14).

### 6.3 Data source

The dashboard reads orchestrator state by **polling the per-run JSON files** the orchestrator
writes under `runs/` (see §9.2); SSE is a later optimization, not required now. It holds no
state of its own and performs no pipeline logic — if the dashboard is closed, runs continue
unaffected.

### 6.4 Reference mockup & visual verification

`minion-console.html` is the **visual reference** for the run view. To keep the real
dashboard faithful to it, we verify it with Playwright using a **fixture-driven** approach:

1. Freeze an orchestrator-state fixture whose data matches the mockup's example run.
2. Load the real dashboard against that fixture so the data is identical to the mockup's.
3. **Structural check** — assert the expected components exist (run sidebar, blueprint rail
   with nodes in the right order and correct type badges, log panel, Judge verdict panel,
   diff panel).
4. **Visual check** — screenshot-compare against the mockup; because the data is pinned,
   any difference is genuinely layout/style, not content.

This suite belongs to the **Minion project itself** and is distinct from the per-item E2E
node (FR11), which tests the *store* the Minion builds — not the Minion's own dashboard.

> Note: the current mockup still labels isolation as a `worktree`; the real dashboard must
> reflect the isolation model adopted in §2 (fresh clone + dedicated branch per run).

## 7. Key technical decisions

- **Judge ≠ Agent.** A Judge never edits code — it only evaluates and returns a structured
  critique. This separates "who decides what to do" from "who checks whether it was done
  well", and lets each role's model be swapped independently.
- **The approved plan is reused 3 times**: (1) the implementation Judge uses it as the
  answer key; (2) the scheduler uses the plan's file list as the lock key; (3) the E2E node
  uses the same list to decide, deterministically, whether to fire Playwright. A single
  source of truth avoids 3 divergent heuristics.
- **A ceiling of 2 attempts on every loop**, not just on CI — the same logic in plan,
  implementation, tests and conflict resolution. Consistency of policy is easier to explain
  and to trust than a different limit per step.
- **A merge conflict is never resolved "blindly".** The agent may try, but acceptance
  depends on running the entire harness suite again — we never trust the resolution on its own.
- **Model tiering is an explicit cost/quality decision**: high-impact decisions (planning,
  judging) use the strongest model available; mechanical decisions (implementing from an
  already-approved plan) use the fastest model. This is logged and exposed in the dashboard,
  it is not a hidden detail.

## 8. Definition of Done

Each criterion below is verifiable — it can be checked as true or false against a real run,
not just against the documentation.

**Coordination layer (§5.1)**
- [ ] The system runs end to end from a single product specification (e.g. `store/STORE_SPEC.md`), with no work item created by hand.
- [ ] The backlog Judge confirms the decomposition covers 100% of the specification's mandatory features.
- [ ] The dispatch loop runs at least 2 independent items in genuine parallel (no dependency or lock between them).
- [ ] At least 1 item's execution order is governed by a declared dependency (not by an incidental file lock).
- [ ] Auto-merge into `develop` requires no human click; only the `develop → main` promotion is manual.

**Worker blueprint (§5.2)**
- [ ] A work item runs from scheduling to open PR with no human instruction in between.
- [ ] The scheduler blocks two runs that collide on the same file — one proceeds, the other waits in the FIFO queue.
- [ ] The sync node performs a real rebase against a `main` that advanced during the run.
- [ ] Playwright fires or is deterministically skipped strictly according to the approved plan's file list.

**Self-correction & human control (§4)**
- [ ] At least 1 complete recovery loop is recorded (Judge rejects → agent fixes → Judge approves, or tests fail → agent fixes → tests pass).
- [ ] Every automatic loop honours the 2-attempt ceiling and escalates once it is exceeded.
- [ ] All human-escalation triggers (§4) are implemented and actionable, not just documented.
- [ ] Any completed run is reconstructable from its recorded log (task, plan, diffs, verdicts, times).

**Dashboard (§6)**
- [ ] The dashboard reflects the orchestrator's real state — not mocked data — for a full end-to-end run, in both the run view and the roadmap view.
- [ ] The dashboard passes its fixture-driven Playwright checks (structural + visual) against the reference mockup.

## 9. Implementation decisions

These pin the *how* so the SPEC is buildable. They do not change the *what* above — they
record the concrete choices for the first build.

### 9.1 Execution model

- A **single `orchestrator` process**. Each run is an **async task**, and concurrency is
  bounded by the configurable parallelism limit (FR22).
- **Isolation is at the filesystem level, not the process level.** Each run clones the target
  repo into its own directory (`clones/run-<id>/`) and the coding agent operates there. Async
  tasks share CPU/IO but never the working directory, so clone-per-run (§2) still guarantees
  isolation.
- **Shared state has a single owner.** The scheduler lock table and the backlog/graph live
  in memory, owned solely by the orchestrator. Runs *request* locks; they never mutate shared
  state directly. One writer by construction ⇒ no data race.
- **Migration path:** because per-run state is already partitioned (one file per run, §9.2)
  and shared state has a single owner, moving to separate processes later is a localized
  change (swap the in-memory lock table for a lock service). Starting simple costs nothing
  downstream.

### 9.2 State & persistence

Everything lives under `runs/`:

```
runs/
  run-<id>.json    ← current state of one run; sole writer = that run's task
  run-<id>.log     ← append-only JSONL event log for that run
  backlog.json     ← written only by the orchestrator
  locks.json       ← written only by the orchestrator
```

- **One file per run** (not one shared blob) — this is what keeps parallel writes contention-free
  and makes both the dashboard and a future process split easy.
- **Atomic writes** (temp file + `rename`) so the polling dashboard never reads a half-written
  file.
- These files **are** the reproducibility log (§4) *and* the dashboard's data source (§6.3) —
  one artifact, two purposes.

### 9.3 Dashboard build

- **Extends the existing `minion-console.html`** (vanilla HTML/CSS + minimal JS); no framework,
  no build step.
- **Reads state by polling** the `runs/` JSON (§9.2).
- **Run view first** (already mocked); the **roadmap view** (§6.1) comes once the dispatch loop
  produces real data to display.
- **Fixture-driven verification** (§6.4): the fixture is a frozen `runs/` snapshot, so the real
  dashboard renders it identically to a live run.

### 9.4 Project-specific parts (deferred to the target repo)

- **Static evals** (FR9) and the **lint/test commands** are project-specific. The harness
  exposes a **pluggable interface**; the concrete evals and commands come from a
  `minion.config` in the target repo, filled in when the store exists.
- **Frontend-file detection** (FR11) is a path glob in that same config.

### 9.5 Bootstrapping order

- The Minion is built and validated **first**, against a **small sample repo + sample spec**,
  so the full pipeline (including the roadmap layer) can be exercised before `store/STORE_SPEC.md`
  exists.
- Only after the Minion works do we point it at the store. DoD criteria that reference
  `store/STORE_SPEC.md` are validated in that second phase.

### 9.6 Language / runtime

**TypeScript**, front to back. The orchestrator, scheduler, static evals and the dashboard's
JS all share one language — the dashboard is already HTML/CSS/JS, so TypeScript avoids a
second language in the stack, and the Claude Agent SDK is first-class in TS. Node.js is the
runtime for the deterministic core; `git`/`gh` are shelled out to as CLIs (§5.2).
</content>
