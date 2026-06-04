# Roleplay Operations Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MVPs for the roleplay sales agent and the operations assistant without Prisma migrations or destructive actions.

**Architecture:** Reuse existing `TrainingRoom`, `TrainingChat`, `TrainingChatParticipant`, `TrainingMessage`, and `TrainingFeedback` by creating a controlled internal user for the roleplay agent. Add an internal AI wrapper that degrades with `ai_not_configured`, and expose operations assistant tools through admin-protected API routes with preview/confirm semantics and audit logs.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, existing admin capability/auth/rate-limit/audit helpers.

**Implementation note:** Final code uses the existing repo routes under
`/api/capacitacion/*` for roleplay and `apps/web/src/lib/agents/*` for the
operations assistant. The canonical handoff doc is
`docs/agents/roleplay-and-operations-assistant-mvp.md`.

---

### Task 1: AI Client Wrapper

**Files:**
- Create: `apps/web/src/lib/ai/client.ts`
- Test: `apps/web/src/lib/ai/__tests__/client.test.ts`

- [ ] Write tests for missing `OPENAI_API_KEY` returning `ai_not_configured`.
- [ ] Write tests for prompt/history truncation inputs.
- [ ] Implement `generateAiText()` with `OPENAI_API_KEY`, `OPENAI_MODEL`, fetch to OpenAI Responses API, and safe fallback.
- [ ] Run targeted tests.

### Task 2: Roleplay Agent Library And APIs

**Files:**
- Create: `apps/web/src/lib/training-roleplay-agents.ts`
- Create: `apps/web/src/lib/__tests__/training-roleplay-agents.test.ts`
- Create: `apps/web/src/app/api/training/roleplay/agents/route.ts`
- Create: `apps/web/src/app/api/training/roleplay/chats/[chatId]/agents/route.ts`
- Create: `apps/web/src/app/api/training/roleplay/chats/[chatId]/agents/[agentId]/route.ts`
- Create: `apps/web/src/app/api/training/roleplay/chats/[chatId]/agent-reply/route.ts`
- Create: `apps/web/src/app/api/training/roleplay/chats/[chatId]/evaluate/route.ts`

- [ ] Write tests for catalog listing.
- [ ] Write tests for admin/moderator access and user rejection via mocked Prisma/access helpers.
- [ ] Implement agent catalog modes: `prospecto_indeciso`, `prospecto_objecion_precio`, `prospecto_comparando_escuelas`, `coach_ventas`, `evaluador`.
- [ ] Implement internal agent user creation with email `sales-roleplay-agent@system.recalc.local`, no schema migration.
- [ ] Implement add/remove participant, reply generation, and evaluation feedback creation.
- [ ] Add rate limit and audit logs on mutating routes.
- [ ] Run targeted tests.

### Task 3: Roleplay UI

**Files:**
- Modify: `apps/web/src/components/capacitacion/RolplayWorkspace.tsx`

- [ ] Add local types for roleplay agents.
- [ ] Load agent catalog when a chat is active.
- [ ] Add admin-only controls in the moderator panel: select mode, scenario, difficulty, extra instructions, add agent, generate agent response, evaluate.
- [ ] Render agent participants/messages with labels such as `Agente IA`, `Prospecto simulado`, `Coach`.
- [ ] Keep controls compact inside the existing right panel.

### Task 4: Operations Assistant Library And APIs

**Files:**
- Create: `apps/web/src/lib/assistant/operations/types.ts`
- Create: `apps/web/src/lib/assistant/operations/tools.ts`
- Create: `apps/web/src/lib/assistant/operations/prompts.ts`
- Create: `apps/web/src/lib/assistant/operations/actions.ts`
- Create: `apps/web/src/lib/assistant/operations/index.ts`
- Create: `apps/web/src/lib/assistant/operations/__tests__/operations-assistant.test.ts`
- Create: `apps/web/src/app/api/assistant/operations/capabilities/route.ts`
- Create: `apps/web/src/app/api/assistant/operations/chat/route.ts`
- Create: `apps/web/src/app/api/assistant/operations/action-preview/route.ts`
- Create: `apps/web/src/app/api/assistant/operations/action-confirm/route.ts`

- [ ] Write tests for process improvement shape.
- [ ] Write tests that preview does not execute.
- [ ] Write tests that confirm requires explicit confirmation and allowed action.
- [ ] Implement tools for system status, quote status, offer summary, audit log summary, import summary, process recommendations, and issue preparation.
- [ ] Implement chat response with deterministic fallback plus optional AI synthesis.
- [ ] Implement action preview/confirm with `create_audit_note` only for MVP.
- [ ] Add rate limit and `AdminAuditLog` for assistant chat/actions.

### Task 5: Operations Assistant UI And Navigation

**Files:**
- Create: `apps/web/src/components/admin/OperationsAssistantPanel.tsx`
- Create: `apps/web/src/app/(admin)/admin/(protected)/operations/assistant/page.tsx`
- Modify: `apps/web/src/config/dashboard-navigation.ts`

- [ ] Add `/admin/operations/assistant` to nav and dashboard title.
- [ ] Add chat UI with capabilities, recommendations, pending action preview, and confirm controls.
- [ ] Keep the page dense and operational, matching existing admin patterns.

### Task 6: Documentation And Desktop README

**Files:**
- Create: `docs/agents/roleplay-and-operations-assistant-mvp.md`
- Create outside repo: `C:\Users\ricar\Desktop\README.md`

- [ ] Document architecture found, env vars, permissions, how to configure roleplay agent, operations assistant, and auditor/reparador.
- [ ] Include where to configure `OPENAI_API_KEY`, `OPENAI_MODEL`, GitHub vars, Upstash vars, Vercel/Neon vars without secret values.

### Task 7: Verification, Commit, Push, PR, Deploy

**Files:** all changed files.

- [ ] Run targeted red/green tests during implementation.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Browser-check affected pages when auth allows; otherwise verify protected redirects.
- [ ] Commit on `codex/roleplay-operations-agents-mvp`.
- [ ] Push branch, create PR, and wait for GitHub checks and Vercel deployments to be `Ready`.
