# AI-DEV-LOG.md — AI Development Log

> The workflow, the important iterations, the failures and corrections, and the
> **autonomous-loop evidence**. Not every prompt — the decisions and loops that
> shaped the result. Companion to [`SYSTEM.md`](./SYSTEM.md).

---

## 1. Workflow at a glance

Spec-first, then build the *system* around the agents:

1. **Intent + spec.** Wrote the engineering spec for the harness
   (`minion/SPEC.md`) and a product spec for the target (`store/STORE_SPEC.md`,
   later descoped to the self-contained `store/MVP_SPEC.md`) *before* substantial
   implementation.
2. **Context/tooling.** Connected 4 MCP servers (Tavily, Context7, GitHub,
   Playwright), verified live, secrets in a git-ignored `.env` (`minion/MCP.md`).
3. **Built the deterministic engine first**, tested against a fake agent runner
   (orchestrator, scheduler, graph, dispatch, harness, persistence) — so the
   whole pipeline was provable with zero LLM calls.
4. **Lit up the agentic layer** (`SdkAgentRunner` → Claude Agent SDK), then the
   `minion run` entry point, the live dashboard, the roadmap layer (decompose →
   judge → dispatch → auto-merge), and finally a **live public trigger**.
5. **Made the Minion build the real store** — OtakuVerso shipped across PRs
   #1–#6, each planned, judged, implemented TDD-first, and browser-verified.

Each phase ended with a real run and a commit. The interesting part is where the
system caught and corrected its own mistakes — and where the human had to step in.

---

## 2. Autonomous loop evidence (the headline)

### 2a. Ask by URL → a real PR, no human in the loop

The strongest evidence is the **live trigger**. The read-only dashboard gained
`POST /api/trigger` + an issue-number input (opt-in via `minion dashboard
--enable-trigger`), exposed to the public internet through a cloudflared tunnel.
Anyone types a GitHub issue number; the Minion autonomously clones the repo from
GitHub, plans, judges the plan, implements (TDD), judges the diff, runs the
harness, and opens a **real pull request** into `develop`.

Proven end-to-end. GitHub **issue #10** ("Produtos relacionados na página do
produto") was triggered *from the public URL*; run `mu1im01x` walked every
blueprint node with **no human instruction in the middle**:

```
17:26:45  schedule ✓  isolate ✓ (clone from GitHub)
17:27:12  context ✓   (internal + official sources, in parallel)
17:28:23  plan ✓  →  judge_plan ✓  approved 88/100
17:29:24  implement ✓ →  judge_impl ✓  approved 93/100
17:32:11  static_evals ✓  lint_tests ✓ (typecheck + tests green)
17:32:15  e2e (skipped)   sync ✓ (rebased onto develop)
17:32:20  open_pr ✓  →  PR #11  (+317 lines, 5 files, 2 of them tests)
```

Issue in → reviewed PR out in **~5.5 minutes**, from an anonymous URL. Deterministic
guardrails keep the public endpoint safe (**guarantees, not agent judgment**): one
run at a time, positive-integer issue validation, and a per-process cap of 25.

### 2b. The Judge does genuine engineering review

Inside a `minion run <spec>` invocation, one agent produced a backlog, a
*different* agent judged it, found real defects, and the first agent re-produced a
corrected backlog that was then approved — ACT → VERIFY → OBSERVE A PROBLEM → FIX
→ VERIFY AGAIN, autonomously. Real captured traces:

```
decomposing spec (attempt 1/2)… 51 items — judging the backlog…
  backlog rejected (80/100) — MISSING ENDPOINT: CATEGORIES. web-5 says
  'o mega-menu lista as categorias da API' … no item creates GET /categories …
decomposing spec (attempt 2/2)… 50 items — judging the backlog…
  backlog approved (86/100)
```

```
backlog rejected (81/100) — Fix web-11-wishlist. Its criteria put the heart
button 'no card', but ProductCard.tsx is created in web-7-home, which web-11 does
not depend on … it will be built twice or conflict. Move ProductCard into
web-design-system … then make web-home/-search/-wishlist depend on it.
  … backlog approved (90/100)
```

No human typed anything between rejection and approval. The **attempt ceiling of
2** bounds it: a second consecutive rejection **escalates to a human** instead of
looping — reliable autonomy, not blind autonomy. The same loop shape drives the
per-item worker (implement → `impl-judge` → loop back on rejection).

---

## 3. TDD, followed autonomously

Every store feature started with tests (red → green). The `implementer` agent
honored it **without being told per item**. Example — the reviews PR (#4) landed
`reviews.test.ts` (216 lines) and `ProductPage.reviews.test.tsx` (221 lines)
alongside the implementation; the related-products trigger run (#11) landed
`related.test.ts` + `ProductPage.related.test.tsx` with the component. The
`lint_tests` node runs `commands.lint` (typecheck + tests) as machine-readable
back pressure before a PR can open.

---

## 4. How the store actually shipped (a real orchestration pivot)

The plan was one `minion run store/STORE_SPEC.md` → decompose → parallel dispatch
→ auto-merge. The roadmap layer works (proven on a capped build), but a full
multi-item parallel build hit **stale-clone merge conflicts on hub files**
(`App.tsx`, `products.ts`, `package-lock.json`): items cloned an integration
branch before a prior item's merge landed, so independent edits to the same files
collided.

Rather than fight it under deadline, the engineer **redirected the system**: ship
the store through the single-worker task/issue path, **one feature per PR**, each
based off `develop` and merged before the next — so every task stacks on the
previous with no hub-file races. Result — six autonomous PRs, each judged
(plan/impl 86–93), TDD, and browser-verified, then promoted `develop → main`:

| PR | Feature | plan/impl |
|----|---------|-----------|
| #1 | Amazon-style UI + **real product images sourced via Tavily search** | 88 / 88 |
| #2 | Full-bleed layout, header + category nav (links), filters sidebar, footer, hero, breadcrumbs, buy-box | 86 / 92 |
| #3 | Accounts: register / login / logout (scrypt hash, signed httpOnly cookie) | 88 / 90 |
| #4 | Product reviews & star ratings (auth-required writes, aggregate on products) | 88 / 90 |
| #5 | Promote `develop → main` | — |
| #6 | Light theme (remapped Tailwind tokens) + seeded reviews on 6/8 products | 87 / 93 |

This is *parallelism where safe, serialization where correctness needs it* — an
engineering judgment, made by the human, applied through the system.

---

## 5. Failures and corrections (engineering loops)

Each an act → observe → fix → re-verify cycle.

**(a) Judges emitted unparseable verdicts.** The first worker run died at
`judge_plan`: `field "verdict" must be "approved" or "rejected"` (`parse.ts`).
*Cause:* the judge referenced the `judging` skill but `settingSources: []` never
loaded it. *Fix:* `SdkAgentRunner` now inlines any skill referenced in an agent's
frontmatter into the system prompt. *Re-verify:* valid structured verdicts since.

**(b) Implementation was never committed.** A green run produced correct code but
`git diff` was empty — files edited, nothing committed, so a PR branch would be
empty. *Fix:* commit the accepted implementation at the start of `sync`, before
the rebase. *Re-verify:* the branch then carried a real diff.

**(c) Long background runs were killed by the laptop sleeping** mid-LLM-response.
*Fix:* wrap long builds in `caffeinate -is`. *Re-verify:* the full run completed.

**(d) Stale-clone merge conflicts** on hub files during parallel multi-item builds
(§4). *Fix:* ship via serialized single-worker PRs stacking on `develop`.
*Re-verify:* six features merged clean, zero conflicts.

**(e) The integrity correction (human judgment).** Under time pressure the engineer
(via Claude Code) started building the store with an **ad-hoc subagent**. The
human **stopped it**: the *Minion itself* must build the store — otherwise the
submission would misrepresent the very agentic system being judged. The ad-hoc
work was **discarded** and redone through the Minion. A deliberate call about
honesty over speed.

---

## 6. Key human decisions (human as orchestrator)

- **Judgment vs. guarantees split** — the line between LLM nodes and deterministic
  controls (SYSTEM §1).
- **The product is the system** — build a real store to prove the harness; and the
  **Minion**, not an ad-hoc agent, must be the one that builds it (§5e).
- **Descope to a self-contained MVP** — the original Postgres/Prisma/MailHog stack
  was cut to one Fastify service serving the API + built SPA with **in-memory
  data** (`store/MVP_SPEC.md`), to ship in the time available.
- **In-repo install model** — the Minion operates on the repo it lives in
  (auto-detected), not a `--repo` argument.
- **Isolation = fresh clone + branch**, not a shared worktree, so runs can't collide.
- **Single attempt ceiling of 2** everywhere, with fixed escalation triggers.
- **Safety rails** — dry-run by default (no PR without `--pr`); the live trigger is
  opt-in (`--enable-trigger`) with hard guardrails; the `develop → main` promotion
  is always a human PR.

---

## 7. Verification artifacts

- **Live-triggered run** — issue #10 → full 12-node blueprint → **PR #11**, from a
  public URL, plan 88 / impl 93 (`minion/runs/run-mu1im01x.json` + `.log`).
- **Six autonomous store PRs** (#1–#6) on GitHub, each judged + TDD + browser-verified.
- **Dashboard** — `minion dashboard` renders the real `runs/` state live (not
  mocked); `docs/screenshots/` captures run states, parallel dispatch, the store
  before/after, login, reviews, and the light theme.
- **Tests** — the deterministic engine has unit tests (orchestrator, scheduler,
  graph, dispatch, env, harness, parsing, glob); the store has Vitest TDD suites +
  strict typecheck. Green throughout.
