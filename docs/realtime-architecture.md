# Realtime architecture

## Source of truth

- Identity and browser session: Supabase Auth.
- Persistent data: Supabase PostgreSQL, accessed through Prisma while the
  repository layer is consolidated.
- Persistent events: Supabase Realtime `postgres_changes`.
- Ephemeral online state: Supabase Presence.
- Broadcast: reserved for ephemeral events that do not need persistence.

The former D1/outbox/Broadcast bridge and the custom Realtime JWT endpoint are
not part of the active Vercel runtime. See `docs/realtime-migration.md` for the
event inventory and staging validation status.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL` or its Vercel Supabase integration alias
- `DIRECT_URL` or its Vercel Supabase integration alias

`SUPABASE_SERVICE_ROLE_KEY` is not required by browser subscriptions. It remains
server-only for explicit administrative operations and migration scripts.

## Channel conventions

- `training:room:{roomId}:presence`
- `training:chat:{chatId}:messages`
- `training:chat:{chatId}:presence`
- `inbox:thread:{threadId}:messages`
- `inbox:thread:{threadId}:presence`

Persistent message subscriptions filter by `threadId` or `chatId`; no global
table subscription is used. Components remove their channel when unmounted.

## Authorization

The browser client uses the Supabase Auth session. RLS and organization
membership determine which rows can be read; application APIs still enforce
domain permissions before writes. The client must never receive the service
role key or a database connection string.

Before enabling Realtime in staging, apply the versioned Supabase migrations,
publish only the required message tables, and validate tenant isolation with two
different organizations.

## Degraded behavior

- Supabase handles channel reconnection.
- Message hooks reload the authorized API history after a Postgres change.
- Optional polling keeps the UI usable during a temporary Realtime outage.
- Presence is used only for online state and can be lost without losing data.
