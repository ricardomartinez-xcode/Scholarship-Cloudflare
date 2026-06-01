# Realtime Messaging Hub Design

## Decision

Use approach B: make Inbox, Rolplay, and the floating Inbox dock behave like one realtime internal messaging surface.

## Scope

- Keep Neon/Prisma as the source of truth for users, threads, chats, messages, and permissions.
- Keep Supabase as transport only for private Broadcast and Presence channels.
- Improve the current Inbox dock so it updates from the same private inbox message channels used by the full Inbox screen.
- Improve focused keyboard accessibility in the app shell, Inbox, Rolplay, and dock.
- Document the Capacitación Materiales upload flow from the existing Archivos R2 admin path.

## Non-Goals

- No Prisma schema changes.
- No auth contract changes.
- No endpoint renames.
- No migration from the existing Supabase transport pattern.
- Chrome extension rebuild and Importación UI reorganization are separate follow-up phases after this messaging change.

## Current Behavior

Inbox and Rolplay already persist messages through server routes backed by Neon/Prisma. Message creation broadcasts through Supabase private channels after the database write. `InboxWorkspace` and `RolplayWorkspace` consume those channels. `InboxDock` can send a quick reply but refreshes thread summaries by polling every 60 seconds, so it does not feel like a realtime service.

## Target Behavior

The floating dock opens with recent inbox threads, subscribes to each visible thread's private message channel, updates previews and notification badges immediately when a broadcast arrives, and keeps the quick-reply composer consistent with the full Inbox composer. Full views keep their existing data model while receiving focused accessibility improvements.

## Components

- `apps/web/src/components/unidep/InboxDock.tsx`: realtime subscriptions, optimistic quick replies, keyboard composer behavior, status announcements.
- `apps/web/src/components/unidep/InboxWorkspace.tsx`: a11y labels and consistent composer semantics.
- `apps/web/src/components/capacitacion/RolplayWorkspace.tsx`: a11y labels and consistent composer semantics.
- `apps/web/src/components/ui/chat-workspace.tsx`: avoid empty descriptive paragraphs and mark decorative presence correctly.
- `apps/web/src/components/app/AppChrome.tsx`: add the missing Radix dialog description and preserve global shortcuts.
- `apps/web/src/app/(app)/unidep/capacitacion/materiales/page.tsx`: reinforce the existing admin upload path in UI copy.

## Error Handling

If Supabase public configuration is missing, the existing client helper returns a no-op unsubscribe and the dock remains usable through initial fetch and manual sends. Failed quick replies restore the typed content and expose a visible status message. Database and authorization failures stay handled by existing API routes.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm test`
- Browser check for `/unidep/inbox`, `/unidep/capacitacion/rolplay`, and `/admin/capacitacion` when the local app is available.

