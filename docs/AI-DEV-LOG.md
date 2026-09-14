# AI-DEV-LOG.md — AI Development Log

> The workflow, the important iterations, the failures and corrections, and the
> **autonomous-loop evidence**. Not every prompt — the decisions and loops that
> shaped the result. Companion to [`SYSTEM.md`](./SYSTEM.md).

---

## 1. Workflow at a glance

Spec-first, then build the *system* around the agents:

1. **Intent + spec.** Wrote the engineering spec for the harness
   (`minion/SPEC.md`) and the product spec for the target
   (`store/STORE_SPEC.md`) — including a chronological, TDD-first backlog —
   *before* substantial implementation.
2. **Context/tooling.** Connected 4 MCP servers (Tavily, Context7, GitHub,
   Playwright), verified live, secrets in a git-ignored `.env` (`minion/MCP.md`).
3. **Built the deterministic engine first**, tested against a fake agent runner
   (orchestrator, scheduler, graph, dispatch, harness, persistence) — so the
   whole pipeline was provable with zero LLM calls.
4. **Lit up the agentic layer** (`SdkAgentRunner` → Claude Agent SDK), then the
   `minion run` entry point, then the live dashboard, then the roadmap layer
   (decompose → judge → dispatch → auto-merge), then the finalize flow.

Each phase ended with a real run and a commit. The interesting part is where the
system caught and corrected its own mistakes.

---

## 2. Autonomous loop evidence (the headline)

**A complete loop with no human instruction in the middle.** Inside a single
`minion run store/STORE_SPEC.md` invocation, one agent produced a backlog,
a *different* agent judged it, found real defects, and the first agent
re-produced a corrected backlog that was then approved — ACT → VERIFY → OBSERVE
A PROBLEM → FIX → VERIFY AGAIN, autonomously.

Real execution log (abridged):

```
decomposing spec (attempt 1/2)…
  51 items — judging the backlog…
  backlog rejected (80/100) — … MISSING ENDPOINT: CATEGORIES. web-5 says
  'O mega-menu lista as categorias da API' … no item creates GET /categories …
  MISSING DEPENDENCY ON dom-1 … api-1 returns 'preço de vitrine', and §5 says
  shop-window, cart and checkout prices must come from the same pure function …
decomposing spec (attempt 2/2)…
  50 items — judging the backlog…
  backlog approved (86/100)
```

The judge did **genuine** engineering review — in another run it caught a
file-ownership conflict a human reviewer would be proud of:

```
backlog rejected (81/100) — … (2) Fix web-11-wishlist. Its criteria put the heart
button 'no card', but ProductCard.tsx is created in web-7-home, which web-11 does
not depend on … it will be built twice or conflict. Move ProductCard into
web-design-system … then make web-home, web-search-results and web-wishlist
depend on it.
…
backlog approved (90/100)
```

No human typed anything between the rejection and the approval. The attempt
ceiling (2) bounds it: had the judge rejected twice, the run would have
**escalated to a human** instead of looping — reliable autonomy, not blind
autonomy.

The same loop shape exists in the per-item worker (implement → `impl-judge` →
loop back on rejection, bounded by the ceiling); observed verdicts on the health
task were plan **95/100** and implementation **97/100**.

---

## 3. TDD, followed autonomously

`store/STORE_SPEC.md` states one rule: *every item starts with tests (red →
green → refactor).* The `implementer` agent honored it **without being told per
item** — the real history on the `develop` branch after building two items:

```
d94dff5 Integrate minion/dom-1-pricing-module
5d290ae Implement the shared pricing calculator (green)      ← green
2803099 Add failing tests for the shared pricing calculator (red)   ← red first
2ee57ac Integrate minion/fnd-1-monorepo-scaffold
6830de8 Scaffold … config/brand.ts exports 'OtakuVerso' and has a TDD test
```

A failing test committed *before* the implementation, then the implementation to
make it green — the policy from the spec became behavior in the artifacts.

---

## 4. Failures and corrections (engineering loops)

Real problems hit during development and how they were resolved — each an
act → observe → fix → re-verify cycle.

**(a) Judges emitted unparseable verdicts.** First real end-to-end worker run
died at `judge_plan`:

```
Error: field "verdict" must be "approved" or "rejected"  (parse.ts:58)
```

*Root cause:* the judge's definition said "return the verdict defined by the
`judging` skill", but the runner set `settingSources: []` and never loaded that
skill — so the judge improvised a shape. *Fix:* `SdkAgentRunner` now inlines any
skill referenced in an agent's frontmatter into the system prompt. *Re-verify:*
next run passed `judge_plan` → `judge_impl` with valid structured verdicts.

**(b) Implementation was never committed.** The first green run produced correct
code (`src/health.ts`) but `git diff main` was empty — the worker edited files but
nothing committed them, so a PR branch would be empty and rebase couldn't detect
real conflicts. *Fix:* commit the accepted implementation at the start of `sync`,
before the rebase. *Re-verify:* the branch then carried a real diff and a proper
commit.

**(c) Long background runs were killed by the laptop sleeping** mid-LLM-response
(`API Error: Your computer went to sleep mid-response`). *Fix:* wrap long
background builds in `caffeinate -is`. *Re-verify:* the full roadmap run then
completed cleanly (`DELIVERED`).

---

## 5. Key human decisions (human as orchestrator)

Where judgment stayed with the engineer:

- **Judgment vs. guarantees split** — the line between LLM nodes and
  deterministic controls (SYSTEM §1).
- **The product is the system** — build a real store to prove the harness, rather
  than a toy demo.
- **In-repo install model** — the Minion operates on the repository it lives in
  (auto-detected), not a `--repo` argument; the store is built into the same repo.
- **Isolation = fresh clone + branch**, not a shared worktree, so parallel runs
  cannot collide.
- **Single attempt ceiling of 2** everywhere, with fixed escalation triggers.
- **Tech stack + TDD-first policy** for the store (Fastify/Prisma/Postgres,
  React/Vite/Tailwind, Vitest/Playwright, Docker Postgres + MailHog).
- **Safety rails while building the harness** — dry-run by default (no PR without
  `--pr`); incremental `--max-items` caps before any full build; the `develop →
  main` promotion always a human PR.

---

## 6. Verification artifacts

- **Live end-to-end worker run** — full 12-node blueprint DONE, plan 95, impl 97,
  a real commit on an isolated branch.
- **Roadmap run** — spec decomposed into ~50 items, backlog rejected then
  approved, items dispatched in parallel and auto-merged into `develop`.
- **Dashboard** — `minion dashboard` renders the real `runs/` state live (not
  mocked); captured during a completed run.
- **Tests** — the deterministic engine has unit tests (orchestrator, scheduler,
  graph, dispatch, env, harness, parsing, glob); `npm test` green throughout.
