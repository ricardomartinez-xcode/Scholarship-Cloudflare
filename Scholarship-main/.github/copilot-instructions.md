# Scholarship AI Instructions

Follow the repository rules in [AGENTS.md](../AGENTS.md) for every change.

Use [docs/AI_AGENT_MEMORY.md](../docs/AI_AGENT_MEMORY.md) as the shared repository memory before proposing or applying changes. If the memory conflicts with current files, trust the current files and update the user with the discrepancy.

For this repository:

- Keep backend, auth, Prisma, API routes, middleware, deploy config, and environment files untouched unless the user explicitly overrides `AGENTS.md`.
- Prefer App Router, monorepo workspaces, and existing package boundaries.
- Preserve existing data contracts and endpoint names.
- Run or request the repo checks after changes: `npm run lint`, `npm run typecheck`, and `npm run build`.

