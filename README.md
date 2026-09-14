# Minion Console

An **unsupervised orchestrator of coding agents** (a hackathon-scale take on
Stripe's "Minions"): give it a product spec and it decomposes the spec into a
backlog, then builds the product item by item — planning, judging, implementing
(TDD), verifying with a harness, and auto-merging into an integration branch —
with minimal human intervention and maximum visible verification.

The engineering **system** is the product. To prove it, the Minion builds a real
otaku e-commerce store (**OtakuVerso**) into this same repository.

- **Agentic system map:** [`docs/SYSTEM.md`](docs/SYSTEM.md)
- **Development log + autonomous-loop evidence:** [`docs/AI-DEV-LOG.md`](docs/AI-DEV-LOG.md)
- **Engineering spec:** [`minion/SPEC.md`](minion/SPEC.md) · **product spec:** [`store/STORE_SPEC.md`](store/STORE_SPEC.md) · **external tools:** [`minion/MCP.md`](minion/MCP.md)

---

## Prerequisites

- **Node.js ≥ 20** and **git**
- **Claude authentication** for the Agent SDK — either an active Claude Code
  login or `ANTHROPIC_API_KEY` in the environment (the agentic nodes use
  `@anthropic-ai/claude-agent-sdk`)
- **`gh` CLI** (authenticated) — only for `--pr` (opening real pull requests)
- Optional now, required to *run* the built store later: **Docker** (Postgres +
  MailHog, per `store/STORE_SPEC.md`)

## Setup

```bash
cd minion
npm install

# secrets (git-ignored). Copy the template and fill in the keys.
cp ../.env.example ../.env
#   GITHUB_TOKEN=…      (PAT: contents + pull requests)
#   TAVILY_API_KEY=…    (tavily.com — official-sources context)
#   CONTEXT7_API_KEY=…  (optional — version-pinned docs)

# load the secrets so the MCP servers and gh see them, then work from here
set -a; source ../.env; set +a
```

MCP servers are declared in `.mcp.json` (`${VAR}` references only — no secrets in
git). Verify them any time with `claude mcp list`. See [`minion/MCP.md`](minion/MCP.md).

## Run

All commands auto-detect the target repository (the one they're run inside) — no
`--repo` argument. Run them from `minion/`.

```bash
# 1) One free-text task through the full worker blueprint (dry-run: no push/PR)
npx tsx src/index.ts run "Add a src/health.ts exporting health(): string"

# 2) Build a whole spec via the roadmap layer.
#    --max-items caps the batch (cheap); dry-run auto-merges into `develop` only.
npx tsx src/index.ts run store/STORE_SPEC.md --max-items 2

# 3) Full build + promotion: build every item, push develop, open develop→main PR.
npx tsx src/index.ts run store/STORE_SPEC.md --pr

# 4) Live dashboard (separate process — reads minion/runs/ as runs progress)
npx tsx src/index.ts dashboard --port 4173     # → http://localhost:4173
```

**Flags:** `--pr` pushes the branch and opens a real PR (default is dry-run, no
push); `--max-items <n>` caps how many backlog items a spec build dispatches.

> Tip: long full builds can outlast a laptop's idle sleep — prefix with
> `caffeinate -is` on macOS.

## Harness (the feedback loop)

The deterministic engine is fully tested and runs with no LLM calls (a fake agent
runner drives the pipeline):

```bash
npm run typecheck     # tsc --noEmit (strict)
npm test              # unit tests: orchestrator, scheduler, graph, dispatch, env, harness, parsing
```

Within a run, the harness node runs the target project's `lint` / `test` / `e2e`
commands (from `minion.config.json`, or safe defaults) and feeds failures back
into the implementation loop, bounded by the attempt ceiling.

## How it fits together

```
minion run <work item>
  ├─ task / issue  → one worker blueprint (§5.2): plan → judge → implement → judge
  │                   → evals → lint/tests → e2e → sync → PR
  └─ <spec>.md     → roadmap layer (§5.1): decompose → judge (loop) → graph/priority
                      → dispatch (parallel) → each item → worker → auto-merge to develop
                      → (full build) push develop → open develop→main PR → clean up
```

Full detail in [`docs/SYSTEM.md`](docs/SYSTEM.md).

---

🤖 Built with agentic engineering. The store (OtakuVerso) is produced by the
Minion itself — see the `develop` branch after a build.
