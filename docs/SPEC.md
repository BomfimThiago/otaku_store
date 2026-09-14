# SPEC.md — Engineering Specification (index)

This project has two specs. This file, under `/docs` as the competition expects,
points to both.

- **Engineering spec of the product (the harness): [`minion/SPEC.md`](../minion/SPEC.md)**
  — objective, scope, functional requirements (FR1–FR25), non-functional
  constraints (determinism, single attempt ceiling, escalation triggers, model
  tiering), the two-layer architecture (roadmap + per-item worker), key technical
  decisions, and the Definition of Done. **This is the primary engineering spec.**

- **Product spec of the demo target (what the harness builds):
  [`store/STORE_SPEC.md`](../store/STORE_SPEC.md)** — OtakuVerso, an otaku
  e-commerce store: catalog, domain model, business rules, pages/menus, tech
  stack (Fastify/Prisma/Postgres, React/Vite/Tailwind, Vitest/Playwright, Docker
  Postgres + MailHog), and a chronological, TDD-first backlog (~50 items).

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
