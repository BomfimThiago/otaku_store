---
name: gather-official-sources
description: Gather grounding from official external sources — library docs, framework changelogs, version-pinned references — via web search and doc lookup, and return a cited summary.
when_to_use: Use before planning a work item that touches a library, framework or external API, to ground the plan in current, authoritative docs instead of memory.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Gather official sources

Assemble authoritative external grounding for one work item. This is the
"official sources" half of context gathering; a sibling skill covers the
repository and internal docs. Run read-only.

## Tools

- **Tavily** (MCP) — open web search over official documentation and changelogs.
- **Context7** (MCP) — precise, version-pinned documentation lookup for a named
  library or framework.

Use Context7 when you know the exact library; use Tavily to discover the right
source or check current behaviour. Prefer the **version actually used by the
project** (check the lockfile / manifest first).

## How to work

- Ground claims in **current** docs, not the model's memory — this is the whole
  point of the node.
- **Cite every claim** with the source URL (and version where relevant).
- Be concise; this feeds a planning prompt.

## Output

Return a short markdown briefing with these sections:

- **Library/version** — what the project uses and the source consulted.
- **Relevant API / behaviour** — the specific facts that shape the plan (cited).
- **Gotchas / breaking changes** — anything version-specific to avoid (cited).
- **Sources** — the URLs consulted.
