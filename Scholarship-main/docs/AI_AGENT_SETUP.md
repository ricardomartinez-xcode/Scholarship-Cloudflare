# VS Code AI Agent Setup

This workspace is configured so VS Code chat agents can share the same repo rules and memory.

## Choose The Model

1. Open Copilot Chat in VS Code.
2. Use the model picker in the chat input.
3. Pick the model/provider you want for that conversation.
4. For extra providers, use `Chat: Manage Language Models` from the Command Palette.

The repo cannot force Copilot, Codex, Claude, or another provider to appear in the picker. Availability depends on the installed extensions, your GitHub Copilot plan, organization policy, and any configured model provider keys.

## Choose The Agent

Use the agents dropdown in VS Code Chat and select one of:

- `Scholarship Codex`: careful implementation and verification.
- `Scholarship Copilot`: quick Copilot-oriented edits.
- `Scholarship Architect`: planning and architecture review.

If the agents do not appear, run `Chat: Open Chat Customizations` or `Chat: Configure Custom Agents` and verify that `.github/agents` is enabled.

## Shared Memory

Shared repo memory lives in `docs/AI_AGENT_MEMORY.md`.

Copilot memory is also enabled in workspace settings, but GitHub-hosted Copilot Memory must be enabled in your GitHub account or organization settings. Local VS Code memory and GitHub-hosted Copilot Memory are separate systems, so this repo file is the stable cross-agent fallback.

## Diagnostics

If instructions or agents are not being picked up:

1. Right-click the Chat view and open diagnostics.
2. Confirm `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/shared-memory.instructions.md`, and `.github/agents/*.agent.md` are loaded.
3. Reload VS Code after changing agent or model settings.

