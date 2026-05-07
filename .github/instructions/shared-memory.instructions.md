---
applyTo: "**"
---

# Shared AI Memory

Before making repository changes, read `AGENTS.md` and `docs/AI_AGENT_MEMORY.md`.

Treat `docs/AI_AGENT_MEMORY.md` as the repo-level shared memory for Copilot, Codex-style agents, Claude-style agents, and other VS Code chat agents. Add durable project decisions there only when the user asks to persist them or when a completed change creates a reusable constraint.

Do not store secrets, tokens, credentials, private customer data, or `.env` values in memory files.

Model routing convention:

- Use fast/default models for small explanations, search, formatting, and narrow edits.
- Use reasoning models for architecture, refactors, migrations, debugging, and multi-file changes.
- Use the selected VS Code chat model picker for the actual model choice; the repo can provide agent profiles and instructions, but installed extensions and account policy decide which concrete models are available.

