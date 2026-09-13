---
name: decompose-spec
description: Turn a product specification into a backlog of atomic, independently shippable items with acceptance criteria, likely files and declared dependencies.
when_to_use: Use when decomposing a spec (e.g. STORE_SPEC.md) into the Minion backlog.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Decompose a specification into a backlog

Break the specification into the smallest set of **atomic items** that together
cover it completely. The backlog you emit feeds a deterministic dependency graph
and dispatch loop, so the structure matters as much as the prose.

## What makes a good item

- **Atomic & shippable.** One coherent change that can pass the full harness on
  its own. If it needs two unrelated things, split it.
- **Testable acceptance criteria.** Each criterion must be checkable as
  true/false — no vague "works well".
- **Honest dependencies.** `dependsOn` lists item ids that must be **done first**
  because this item builds on their output (e.g. a checkout page depends on the
  cart model). Do **not** encode incidental file overlap as a dependency — the
  scheduler handles file locks separately.
- **Likely files.** Your best estimate of the files the item will touch. Used for
  scheduling; approximate is fine.
- **Weight.** `mvp` for anything the product cannot ship without; `nice-to-have`
  otherwise.

## Coverage

Every mandatory feature of the spec must be traceable to at least one item. A
backlog Judge will reject the decomposition if coverage is incomplete, items are
mis-sized, or dependencies are incoherent — so aim for full coverage and a clean,
acyclic dependency structure.

## Output — return exactly this JSON, nothing else

```json
{
  "items": [
    {
      "id": "cart-model",
      "description": "Add the cart domain model and persistence",
      "acceptanceCriteria": ["Cart holds line items", "Totals recompute on change"],
      "likelyFiles": ["src/cart/model.ts", "src/cart/store.ts"],
      "dependsOn": [],
      "weight": "mvp"
    }
  ]
}
```

Rules for the JSON:
- Emit a **single** fenced `json` block and no prose outside it.
- `id` is short, unique, kebab-case.
- `dependsOn` references other item `id`s only; the graph must be acyclic.
- Do not set `status`, `priority` or `runId` — the orchestrator manages those.
