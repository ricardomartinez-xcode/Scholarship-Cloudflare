# Realtime Messaging Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Inbox dock behave like a realtime internal messaging entry point and improve focused keyboard accessibility for the affected messaging surfaces.

**Architecture:** Neon/Prisma remains the persistence and authorization layer. Supabase private Broadcast/Presence remains the transport layer. The dock reuses the same private inbox message topics already consumed by the full Inbox page.

**Tech Stack:** Next.js App Router, React client components, Prisma-backed API routes, Supabase Realtime client helpers, plain CSS in `apps/web/src/app/globals.css`.

---

### Task 1: Realtime Dock

**Files:**
- Modify: `apps/web/src/components/unidep/InboxDock.tsx`

- [ ] Add `subscribeToPrivateBroadcast` and `realtimeTopics` imports.
- [ ] Add a local `MessageSummary` type matching the inbox message API response.
- [ ] Track handled realtime message ids with a ref.
- [ ] Add a helper that updates thread previews, sender, timestamp, and sort order.
- [ ] Subscribe to `realtimeTopics.inboxThreadMessages(thread.id)` for recent threads.
- [ ] On inbound messages, ignore already handled ids, update the preview, and let notification count derive from `lastMessageSender`.
- [ ] Make quick reply optimistic and replace the optimistic preview with the API message when the POST succeeds.

### Task 2: Keyboard and ARIA Pass

**Files:**
- Modify: `apps/web/src/components/app/AppChrome.tsx`
- Modify: `apps/web/src/components/unidep/InboxDock.tsx`
- Modify: `apps/web/src/components/unidep/InboxWorkspace.tsx`
- Modify: `apps/web/src/components/capacitacion/RolplayWorkspace.tsx`
- Modify: `apps/web/src/components/ui/chat-workspace.tsx`

- [ ] Add `Dialog.Description` inside the mobile navigation dialog to resolve the existing Radix warning.
- [ ] Add explicit accessible labels to message composers and search fields that currently rely only on placeholder text.
- [ ] Use consistent composer keyboard behavior: Enter sends, Shift+Enter inserts a new line, Ctrl/Cmd+Enter also sends.
- [ ] Render empty-state copy only when copy text exists.
- [ ] Mark decorative avatar presence dots as hidden from assistive tech.
- [ ] Add polite status regions for quick reply send results.

### Task 3: Capacitación Materiales Guidance

**Files:**
- Modify: `apps/web/src/app/(app)/unidep/capacitacion/materiales/page.tsx`

- [ ] Update empty-state copy to explain that materials are published from Admin > Archivos R2.
- [ ] Mention the required relation: `Material de capacitación`.
- [ ] Mention slots: `Material capacitación`, `Video capacitación`, `PDF capacitación`, `Imagen capacitación`, or `Archivo capacitación`.

### Task 4: Validation and Publish

**Files:**
- No source files.

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build` if lint/typecheck/test pass.
- [ ] Verify affected pages in the in-app browser when the local server responds.
- [ ] Commit and push the messaging change.
- [ ] Check the Vercel deployment created by GitHub and wait until it is `READY`.

