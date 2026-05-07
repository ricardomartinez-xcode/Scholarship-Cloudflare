# Realtime architecture

## Source of truth

- Main auth: Neon Auth (`src/lib/auth/server.ts`)
- Main persistence: Neon/Postgres through Prisma (`src/lib/prisma.ts`, `prisma/schema.prisma`)
- Realtime transport only: Supabase Broadcast + Presence

## Required environment variables

- `DATABASE_URL`
- `DIRECT_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REALTIME_JWT_SECRET`

## Channel conventions

- `training:room:{roomId}:presence`
- `training:chat:{chatId}:messages`
- `training:chat:{chatId}:presence`
- `inbox:thread:{threadId}:messages`
- `inbox:thread:{threadId}:presence`

## Why private channels

Neon decides who can access each room, chat, and thread.  
Supabase only receives a short-lived JWT with the exact topics approved by the app server.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
intentionally visible in the browser. The secrets are `SUPABASE_SERVICE_ROLE_KEY`
and `SUPABASE_REALTIME_JWT_SECRET`; those must never use the `NEXT_PUBLIC_`
prefix.

## Required Supabase Realtime setup

1. Disable `Allow public access` in Realtime settings.
2. Remove the old public `room:%:*` policies.
3. Replace them with topic-scoped policies that read `realtime_topics` from the JWT.

### Example SQL for `realtime.messages`

```sql
alter table realtime.messages enable row level security;

drop policy if exists "public can receive room broadcasts" on realtime.messages;
drop policy if exists "public can publish room presence" on realtime.messages;
drop policy if exists "public can receive room presence" on realtime.messages;
drop policy if exists "authenticated can receive broadcasts" on realtime.messages;

create policy "private realtime topics can read"
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(
        (current_setting('request.jwt.claims', true))::jsonb -> 'realtime_topics',
        '[]'::jsonb
      )
    ) as allowed(topic)
    where allowed.topic = realtime.topic()
      and realtime.messages.extension in ('broadcast', 'presence')
  )
);

create policy "private realtime topics can write"
on realtime.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(
        (current_setting('request.jwt.claims', true))::jsonb -> 'realtime_topics',
        '[]'::jsonb
      )
    ) as allowed(topic)
    where allowed.topic = realtime.topic()
      and realtime.messages.extension in ('broadcast', 'presence')
  )
);
```

## Important notes

- Roleplay messages persist in Neon tables, not in Supabase.
- Inbox messages persist in Neon tables, not in Supabase.
- Presence is used only for online status.
- Broadcast is used for chat messages.
- Postgres Changes are not the chat backbone.
- Realtime JWTs are short-lived and should stay short-lived in production.
