begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'recalc_admin'
        and table_name = 'inbox_message'
    ) and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'recalc_admin'
        and tablename = 'inbox_message'
    ) then
      alter publication supabase_realtime add table recalc_admin.inbox_message;
    end if;

    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'recalc_admin'
        and table_name = 'TrainingMessage'
    ) and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'recalc_admin'
        and tablename = 'TrainingMessage'
    ) then
      execute 'alter publication supabase_realtime add table recalc_admin."TrainingMessage"';
    end if;
  end if;
end $$;

commit;
