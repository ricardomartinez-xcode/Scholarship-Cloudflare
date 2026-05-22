alter table realtime.messages enable row level security;

drop policy if exists "private realtime topics can read" on realtime.messages;
drop policy if exists "private realtime topics can write" on realtime.messages;

create policy "private realtime topics can read"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'realtime_topics',
        '[]'::jsonb
      )
    ) as allowed(topic)
    where allowed.topic = realtime.topic()
  )
);

create policy "private realtime topics can write"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'realtime_topics',
        '[]'::jsonb
      )
    ) as allowed(topic)
    where allowed.topic = realtime.topic()
  )
);
