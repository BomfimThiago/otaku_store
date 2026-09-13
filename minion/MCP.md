# MCP.md — External tools (MCP servers)

> This document lists the MCP servers the Minion Console connects to, **what each one is
> for**, and **which SPEC node consumes it**. It also records the guiding rule for when a
> tool is an MCP at all.

## Guiding rule: MCP is for judgment, not for guarantees

The SPEC (section 4) says: *determinism wherever possible; an LLM call only where judgment
is required.* That rule decides what becomes an MCP:

- **Deterministic (DET) nodes** — `git worktree`, rebase, open PR, auto-merge to `develop`,
  run the linter/test runner, run the Playwright suite in CI mode — call plain CLIs
  (`git`, `gh`, `pnpm test`, `playwright test`) directly. **They do not go through an MCP**,
  because we want a guaranteed, reproducible result, not an agent's discretion.
- **Agent (AGENT) nodes** — the context-gathering subagents, the merge-conflict resolution
  agent, an optional browser-driven verify/fix loop — are LLMs that need tools. **Those
  tools are exposed as MCP servers.**

So an MCP appears in this list only when an *agent* genuinely needs to reach outside the
repo to do its job.

## Servers we connect

| MCP server | What it's for | Consumed by (SPEC node) | Type of consumer | Auth |
|---|---|---|---|---|
| **Tavily** | Real web search over **official sources** (library docs, framework changelogs) so the context skill grounds the plan in current, authoritative information instead of the model's memory. | `context_gatherer` → "Official sources" skill (FR3, §5.2) | AGENT | `TAVILY_API_KEY` |
| **Context7** | Fetches **version-pinned library/framework documentation** on demand. Complements Tavily: Tavily = open web search, Context7 = precise doc lookup for a named library. | `context_gatherer` → "Official sources" skill (FR3, §5.2) | AGENT | Free / API key (optional) |
| **GitHub** | Read/act on the target repository from an agent's perspective: read PR status & review comments, read issues, inspect branch state. Deterministic git operations (branch, commit, rebase, open PR, merge `develop`) still run via `git`/`gh` CLI in the worktree — the MCP is for the parts that need agent reasoning *about* GitHub state, and for a uniform read interface in the dashboard. | `sync_manager` (conflict context), "Open PR"/auto-merge context (FR12, FR13, FR23) | AGENT (read) + DET (write via CLI) | `GITHUB_TOKEN` (PAT) |
| **Playwright** | Agent-driven browser automation: when the E2E node fails, an agent can open the app, observe the real DOM/screenshot, and drive the browser to reproduce and diagnose. The plain `playwright test` suite (DET) is the pass/fail gate; the MCP is the agent's eyes for the recovery loop. | `harness_runner` → E2E recovery (FR11, FR24, §5.2) | AGENT (DET suite runs via CLI) | none |

## Explicitly NOT connected (and why)

- **Confluence / Slack** — out of scope per SPEC §2. The "internal source" RAG is simulated
  with local markdown, which fills the same architectural role without external auth.
- **A remote CI provider** — the SPEC's "CI" is the local harness execution itself.
- **A database MCP** — the sample product (MiniVerso store) owns its own persistence; the
  orchestrator does not query it through an agent.

## Connection plan & required keys

Servers are registered at **project scope** (committed `.mcp.json`) so the setup is
reproducible for judges. Secrets go in a **local, git-ignored `.env`**, never in `.mcp.json`;
an `.env.example` documents the variable names.

Keys needed from the human:

1. `GITHUB_TOKEN` — a GitHub PAT (fine-grained, scoped to the target repo: contents, pull
   requests, and — for the final `develop → main` promotion — the ability to merge).
2. `TAVILY_API_KEY` — from tavily.com.
3. Context7 — API key only if we use the authenticated tier (works keyless for basic use).
4. Playwright — no key.

## Status

| Server | Registered (`.mcp.json`) | Key present | API verified |
|---|---|---|---|
| Tavily | ✅ | ✅ `TAVILY_API_KEY` | ✅ HTTP 200 |
| Context7 | ✅ | ✅ `CONTEXT7_API_KEY` | ✅ HTTP 200 |
| GitHub | ✅ | ✅ `GITHUB_TOKEN` (`repo`, `workflow`, …) | ✅ HTTP 200 (user `BomfimThiago`, repo access ok) |
| Playwright | ✅ | n/a | ✅ package resolves |

npm packages resolved: `tavily-mcp@0.2.22`, `@upstash/context7-mcp@4.1.0`, `@playwright/mcp@0.0.80`.

To activate inside Claude Code, launch from a shell that loaded the secrets:

```bash
set -a; source .env; set +a
claude   # then run /mcp to confirm all four are connected
```
