# Minion Console

An **unsupervised orchestrator of coding agents** (a hackathon-scale take on
Stripe's "Minions"): hand it a **product spec** or a **GitHub issue** and it
plans, judges the plan, implements (TDD), verifies with a harness, and opens a
**pull request** — decomposing larger specs into a backlog and building item by
item — with the **human as orchestrator** and maximum visible verification.

The engineering **system** is the product. To prove it, the Minion builds a real
otaku e-commerce store (**OtakuVerso**) into this same repository — it authored
the store across PRs **#1–#6**, and later, triggered live from a public URL, it
resolved GitHub issue #10 into PR **#11** with no human in the loop.

- **Agentic system map:** [`docs/SYSTEM.md`](docs/SYSTEM.md)
- **Development log + autonomous-loop evidence:** [`docs/AI-DEV-LOG.md`](docs/AI-DEV-LOG.md)
- **Engineering spec:** [`docs/SPEC.md`](docs/SPEC.md) · [`minion/SPEC.md`](minion/SPEC.md)
- **Product spec actually shipped:** [`store/MVP_SPEC.md`](store/MVP_SPEC.md) (self-contained MVP) · original: [`store/STORE_SPEC.md`](store/STORE_SPEC.md)
- **External tools (MCP):** [`minion/MCP.md`](minion/MCP.md)

## Evidence map — the six capabilities, one artifact each

| Capability | Verify it in seconds |
|---|---|
| **1 · Intent + Spec** | [`minion/SPEC.md`](minion/SPEC.md) — FR1–FR25, architecture, Definition of Done, written before the build |
| **2 · Context engineering** | Fresh clone + fresh agent context per node; two context skills in parallel ([SYSTEM §4](docs/SYSTEM.md)); `settingSources: []` in [`sdk-runner.ts`](minion/src/agent/sdk-runner.ts) |
| **3 · Orchestration + parallel** | Two layers + 12-node blueprint ([SYSTEM §2/§6/§7](docs/SYSTEM.md)); parallel dispatch — [`docs/screenshots/`](docs/screenshots) |
| **4 · Harness + back-pressure** | Judges + `commands.{lint,test,e2e}` + evals ([SYSTEM §1](docs/SYSTEM.md)); 236 unit tests + [`store/e2e/`](store/e2e) |
| **5 · Autonomous loop + recovery** | Issue #10 → run `mu1im01x` → **PR #11**, no human in the loop ([AI-DEV-LOG §2](docs/AI-DEV-LOG.md); [`runs/run-mu1im01x.json`](minion/runs/run-mu1im01x.json)) |
| **6 · Human as orchestrator** | The integrity call + MVP descope + merge-conflict redirect ([AI-DEV-LOG §5/§6](docs/AI-DEV-LOG.md)); the `develop→main` promotion PR |

**See it:** the store built by the Minion → PRs **#1–#6** (+ live-triggered **#11**, **#13**) · dashboard/store screenshots in [`docs/screenshots/`](docs/screenshots).

## Working product (durable, for judging)

The store runs two durable ways — **locally in two commands** ([Run the store](#run-the-store)) or via the included **[`render.yaml`](render.yaml)** Blueprint (persistent URL). Any `*.trycloudflare.com` demo link is **ephemeral** — live only while the laptop is running — so treat local/Render as the working product.

---

## Prerequisites

- **Node.js ≥ 20** and **git**
- **Claude authentication** for the Agent SDK — either an active **Claude Code
  login** *or* `ANTHROPIC_API_KEY` in the environment (the agentic nodes use
  `@anthropic-ai/claude-agent-sdk`)
- **`gh` CLI** (authenticated) — for `--pr` and issue-triggered runs (real PRs)

> The **store is self-contained** — one Fastify service serves the REST API + the
> built React SPA, with all data in-memory (catalog, cart, users, reviews). No
> Docker, Postgres, Prisma or MailHog required to run it.

## Setup

```bash
cd minion
npm install

# secrets (git-ignored). Copy the template and fill in the keys.
cp ../.env.example ../.env
#   GITHUB_TOKEN=…        (PAT: contents + pull requests)
#   TAVILY_API_KEY=…      (tavily.com — official-sources context)
#   ANTHROPIC_API_KEY=…   (optional — only if not using a Claude Code login)
#   CONTEXT7_API_KEY=…    (optional — version-pinned docs; works keyless)

# load the secrets so the MCP servers and gh see them, then work from here
set -a; source ../.env; set +a
```

MCP servers are declared in `.mcp.json` (`${VAR}` references only — no secrets in
git). Verify them any time with `claude mcp list`. See [`minion/MCP.md`](minion/MCP.md).

## Run the Minion

All commands auto-detect the target repository (the one they're run inside) — no
`--repo` argument. Run them from `minion/`.

```bash
# Resolve a GitHub issue → single worker blueprint (plan→judge→implement→judge→verify→PR)
npx tsx src/index.ts run --issue 8

# A free-text task → same single worker blueprint
npx tsx src/index.ts run "Add a Favorites page backed by localStorage"

# A whole spec → roadmap layer (decompose → judge → dispatch → auto-merge to develop)
npx tsx src/index.ts run store/MVP_SPEC.md --max-items 2
```

**Flags:** `--pr` pushes the branch and opens a **real** PR (default is dry-run,
no push); `--max-items <n>` caps how many backlog items a spec build dispatches;
`--parallelism <n>` sets how many items dispatch concurrently.

> Tip: long builds can outlast a laptop's idle sleep — prefix with
> `caffeinate -is` on macOS.

## Live dashboard + trigger

```bash
# Read-only live console (reads minion/runs/*.json as runs progress)
npx tsx src/index.ts dashboard --port 8787

# …plus the live trigger: an issue-number input + POST /api/trigger
npx tsx src/index.ts dashboard --port 8787 --enable-trigger
```

With `--enable-trigger` the console lets you hand the Minion a **GitHub issue
number from the browser** and watch it walk the blueprint and open a real PR.
Without the flag the dashboard stays strictly read-only. Deterministic guardrails
on the public endpoint: **one run at a time**, positive-integer issue validation,
and a **per-process cap of 25** runs.

Expose it publicly for a demo:

```bash
cloudflared tunnel --url http://localhost:8787     # → https://<name>.trycloudflare.com
```

## Run the store

```bash
cd store
npm install
npm run build          # builds the React SPA (web/dist)
npm start              # Fastify serves API + SPA on http://localhost:3000
```

Override the port with `PORT` (the server binds `0.0.0.0`). `COOKIE_SECRET` signs
the auth session cookie (an insecure dev fallback is used when unset).

## Deploy

- **Store → Render:** the repo ships a [`render.yaml`](render.yaml) Blueprint.
  On [dashboard.render.com](https://dashboard.render.com): **New → Blueprint →**
  connect this repo **→ Apply**. Render builds and serves the single Node service
  and returns a public URL (free tier sleeps after ~15 min, wakes in ~30 s).
- **Console + store → VPS (live trigger):** to let anyone run the Minion from a
  URL, host it on a small always-on box (e.g. a Hetzner CX22, ~4 GB). Create the
  box, put the keys in `.env`, and run [`deploy/vps-setup.sh`](deploy/vps-setup.sh):
  it installs node/git/gh, authenticates, drops the heavy Playwright MCP, and runs
  the store (`:3000`) and the console with `--enable-trigger` (`:8787`) as
  auto-restarting systemd services. Guards: set a **low spending cap** on
  `ANTHROPIC_API_KEY`, and an optional `TRIGGER_TOKEN` (the console URL then needs
  `?token=…`) plus the built-in one-run-at-a-time + per-process cap.
- **Store → tunnel (instant, ephemeral):** `cloudflared tunnel --url http://localhost:3000`.

## Harness / feedback loops

The system is built so agents **verify their own work** and react to the result
(BUILD → VERIFY → OBSERVE → FIX → REPEAT):

1. **Blueprint verify nodes** — every worker run passes through `static_evals`,
   `lint_tests` (runs the target's `commands.lint` = strict typecheck + tests),
   and a conditional `e2e` node. A failure loops back into implementation.
2. **AI back-pressure (Judges)** — `plan-judge`, `impl-judge`, `backlog-judge`
   and `product-judge` return **structured verdicts** `{verdict, score,
   checklist, critique}`. A rejection loops back to the offending stage, bounded
   by an **attempt ceiling of 2**; after that the run **escalates to a human**
   rather than looping forever.
3. **The store's own tests** — Vitest unit tests written **TDD-first** per
   feature, plus strict TypeScript:

   ```bash
   cd store && npm test            # vitest (unit)
   cd store && npm run typecheck   # tsc --noEmit (strict)
   ```

4. **Real pull requests** are the integration record — each Minion-built feature
   landed as a reviewable PR (#1–#6, and live-triggered #11).

The Minion's own deterministic engine is separately unit-tested and runs with
**zero LLM calls** (a fake agent runner drives the pipeline):

```bash
cd minion
npm run typecheck     # tsc --noEmit (strict)
npm test              # orchestrator, scheduler, graph, dispatch, env, harness, parsing
```

## How it fits together

```
minion run <work item>
  ├─ --issue N / task  → one worker blueprint: plan → judge → implement → judge
  │                       → evals → lint/tests → e2e → sync → PR
  └─ <spec>.md         → roadmap layer: decompose → judge (loop) → graph/priority
                          → dispatch (parallel) → each item → worker → auto-merge to develop
                          → (full build) push develop → open develop→main PR → clean up
```

Full detail in [`docs/SYSTEM.md`](docs/SYSTEM.md).

---

🤖 Built with agentic engineering. The store (OtakuVerso) is produced by the
Minion itself — see PRs #1–#6 and the live-triggered #11.
