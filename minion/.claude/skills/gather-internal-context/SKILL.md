---
name: gather-internal-context
description: Gather context for a work item from the repository code and the internal knowledge base (local markdown), and return a concise, cited summary.
when_to_use: Use before planning a work item, to ground the plan in the existing codebase and internal conventions.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Gather internal context

Assemble the internal grounding a planner needs for one work item. This is the
"code + internal RAG" half of context gathering; a sibling skill covers official
external sources. Run read-only — you never edit anything.

## What to collect

- **Relevant code.** The files, functions and modules the item will most likely
  touch or depend on. Prefer the smallest set that actually matters.
- **Existing conventions.** Patterns already used in the repo (naming, structure,
  error handling, test style) that the implementation should match.
- **Internal knowledge base.** Any local markdown docs that state decisions,
  constraints or domain rules relevant to the item.

## How to work

- Search before reading: use Grep/Glob to locate, then Read the specific parts.
- **Cite every claim** with a `path:line` reference so the planner can verify.
- Be concise. This summary is fed into a planning prompt — signal over volume.

## Output

Return a short markdown briefing with these sections:

- **Relevant code** — bullet list of `path:line` with one line each on why it matters.
- **Conventions to follow** — patterns the implementation must respect (cited).
- **Constraints & decisions** — anything from the internal docs that limits the approach (cited).
- **Open questions** — anything ambiguous the planner should resolve.
