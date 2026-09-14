# SPEC.md — Engineering Specification (index)

This project has two specs. This file, under `/docs` as the competition expects,
points to both.

- **Engineering spec of the product (the harness): [`minion/SPEC.md`](../minion/SPEC.md)**
  — objective, scope, functional requirements (FR1–FR25), non-functional
  constraints (determinism, single attempt ceiling, escalation triggers, model
  tiering), the two-layer architecture (roadmap + per-item worker), key technical
  decisions, and the Definition of Done. **This is the primary engineering spec.**

- **Product spec of the demo target (what the harness builds):
  [`store/MVP_SPEC.md`](../store/MVP_SPEC.md)** — OtakuVerso, an otaku e-commerce
  store, **shipped as a self-contained MVP**: one Fastify service serves the REST
  API + the built React (Vite + Tailwind) SPA, with all data in-memory
  (catalog / cart / users / reviews) — no Docker, Postgres, or Prisma. The
  broader ambition spec ([`store/STORE_SPEC.md`](../store/STORE_SPEC.md) —
  Postgres/Prisma/MailHog, ~50 items) was deliberately descoped to this MVP to
  ship in the available time (a human tradeoff; see AI-DEV-LOG). Every feature was
  built by the Minion, TDD-first — one PR per feature (#1–#6) plus a
  live-triggered PR (#11).

## Objective (one paragraph)

Build a hackathon-scale version of Stripe's "Minions" pattern: an **unsupervised
orchestrator of coding agents** that takes a spec, decomposes it into a backlog,
and builds the product item by item — planning, judging, implementing (TDD),
verifying, and auto-merging to an integration branch — with the minimum human
intervention and the maximum visible verification reasoning. The engineering
*system* is the deliverable; the OtakuVerso store is what it builds to prove it.

## Related

- Agentic system map: [`SYSTEM.md`](./SYSTEM.md)
- Development log + autonomous-loop evidence: [`AI-DEV-LOG.md`](./AI-DEV-LOG.md)
- External tools (MCP): [`minion/MCP.md`](../minion/MCP.md)
- Setup & run: [`README.md`](../README.md)
