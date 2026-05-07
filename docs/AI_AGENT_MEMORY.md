# AI Agent Memory

This file is the shared repository memory for VS Code chat agents, Copilot custom agents, Codex-style workflows, and other AI assistants that can read workspace files.

## Current Repository Rules

- The authoritative instruction file is `AGENTS.md`.
- Protected areas: `prisma/**`, `app/api/**`, `lib/db/**`, `lib/auth/**`, `middleware.ts`, `auth.ts`, `integrations/google/**`, `integrations/meta/**`, `.env*`, and deploy configuration.
- Preferred editable areas: dashboard UI, UI components, layout components, styles, navigation/shells, `apps/**`, `packages/**`, and technical migration docs.
- Every meaningful code change should pass `npm run lint`, `npm run typecheck`, and `npm run build`.

## Agent And Model Routing

- VS Code model selection is done from the chat input model picker. The workspace cannot make unavailable models appear; that depends on installed extensions, account plan, organization policy, and configured model providers.
- Use `Scholarship Codex` for careful implementation and terminal-backed verification.
- Use `Scholarship Copilot` for quick Copilot chat work while still obeying repository constraints.
- Use `Scholarship Architect` for read-heavy planning and migration decisions.
- For small edits or explanations, use a fast/default model.
- For debugging, refactors, architecture, and multi-file changes, use a reasoning model.

## Memory Policy

- Keep durable project decisions here when they should be visible to every agent.
- Do not store secrets, tokens, credentials, customer data, or environment variable values.
- If this memory conflicts with current source files, trust the current files and mention the conflict before changing anything.

