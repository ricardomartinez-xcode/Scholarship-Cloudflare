begin;

create schema if not exists recalc_admin;
create extension if not exists pgcrypto;

do $$
begin
  create type recalc_admin.organization_role as enum ('owner', 'admin', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type recalc_admin.membership_status as enum ('active', 'invited', 'disabled');
exception
  when duplicate_object then null;
end $$;

create or replace function recalc_admin.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function recalc_admin.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create table if not exists recalc_admin.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_path text,
  default_organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email))
);

create table if not exists recalc_admin.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid references recalc_admin.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint organizations_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);

alter table recalc_admin.profiles
  drop constraint if exists profiles_default_organization_id_fkey;

alter table recalc_admin.profiles
  add constraint profiles_default_organization_id_fkey
  foreign key (default_organization_id)
  references recalc_admin.organizations(id)
  on delete set null;

create table if not exists recalc_admin.organization_members (
  organization_id uuid not null references recalc_admin.organizations(id) on delete cascade,
  user_id uuid not null references recalc_admin.profiles(id) on delete cascade,
  role recalc_admin.organization_role not null default 'member',
  status recalc_admin.membership_status not null default 'active',
  invited_by uuid references recalc_admin.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on recalc_admin.organization_members(user_id, status);

create index if not exists organization_members_org_role_idx
  on recalc_admin.organization_members(organization_id, role, status);

create table if not exists recalc_admin.roles (
  key text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists recalc_admin.permissions (
  key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists recalc_admin.role_permissions (
  role_key text not null references recalc_admin.roles(key) on delete cascade,
  permission_key text not null references recalc_admin.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists recalc_admin.file_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references recalc_admin.organizations(id) on delete cascade,
  owner_user_id uuid not null references recalc_admin.profiles(id) on delete restrict,
  bucket_id text not null,
  object_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  checksum_sha256 text,
  visibility text not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint file_assets_visibility_check check (visibility in ('private', 'organization', 'public')),
  constraint file_assets_size_check check (size_bytes is null or size_bytes >= 0),
  unique (bucket_id, object_path)
);

create index if not exists file_assets_org_created_idx
  on recalc_admin.file_assets(organization_id, created_at desc);

create index if not exists file_assets_owner_created_idx
  on recalc_admin.file_assets(owner_user_id, created_at desc);

create table if not exists recalc_admin.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references recalc_admin.organizations(id) on delete cascade,
  subject text,
  status text not null default 'active',
  created_by uuid references recalc_admin.profiles(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_threads_status_check check (status in ('active', 'archived'))
);

create index if not exists inbox_threads_org_updated_idx
  on recalc_admin.inbox_threads(organization_id, updated_at desc);

create table if not exists recalc_admin.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references recalc_admin.inbox_threads(id) on delete cascade,
  organization_id uuid not null references recalc_admin.organizations(id) on delete cascade,
  sender_user_id uuid references recalc_admin.profiles(id) on delete set null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbox_messages_thread_created_idx
  on recalc_admin.inbox_messages(thread_id, created_at asc);

create index if not exists inbox_messages_org_created_idx
  on recalc_admin.inbox_messages(organization_id, created_at desc);

create table if not exists recalc_admin.training_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references recalc_admin.organizations(id) on delete cascade,
  name text not null,
  created_by uuid references recalc_admin.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recalc_admin.training_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references recalc_admin.training_rooms(id) on delete cascade,
  organization_id uuid not null references recalc_admin.organizations(id) on delete cascade,
  sender_user_id uuid references recalc_admin.profiles(id) on delete set null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_messages_room_created_idx
  on recalc_admin.training_messages(room_id, created_at asc);

create table if not exists recalc_admin.migration_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_cursor text,
  status text not null default 'pending',
  row_counts jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint migration_batches_status_check check (status in ('pending', 'running', 'succeeded', 'failed'))
);

create index if not exists migration_batches_source_status_idx
  on recalc_admin.migration_batches(source, status, created_at desc);

drop trigger if exists profiles_set_updated_at on recalc_admin.profiles;
create trigger profiles_set_updated_at
before update on recalc_admin.profiles
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists organizations_set_updated_at on recalc_admin.organizations;
create trigger organizations_set_updated_at
before update on recalc_admin.organizations
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists organization_members_set_updated_at on recalc_admin.organization_members;
create trigger organization_members_set_updated_at
before update on recalc_admin.organization_members
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists file_assets_set_updated_at on recalc_admin.file_assets;
create trigger file_assets_set_updated_at
before update on recalc_admin.file_assets
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists inbox_threads_set_updated_at on recalc_admin.inbox_threads;
create trigger inbox_threads_set_updated_at
before update on recalc_admin.inbox_threads
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists inbox_messages_set_updated_at on recalc_admin.inbox_messages;
create trigger inbox_messages_set_updated_at
before update on recalc_admin.inbox_messages
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists training_rooms_set_updated_at on recalc_admin.training_rooms;
create trigger training_rooms_set_updated_at
before update on recalc_admin.training_rooms
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists training_messages_set_updated_at on recalc_admin.training_messages;
create trigger training_messages_set_updated_at
before update on recalc_admin.training_messages
for each row execute function recalc_admin.set_updated_at();

drop trigger if exists migration_batches_set_updated_at on recalc_admin.migration_batches;
create trigger migration_batches_set_updated_at
before update on recalc_admin.migration_batches
for each row execute function recalc_admin.set_updated_at();

create or replace function recalc_admin.current_user_is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = recalc_admin, public
as $$
  select exists (
    select 1
    from recalc_admin.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

create or replace function recalc_admin.current_user_is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = recalc_admin, public
as $$
  select exists (
    select 1
    from recalc_admin.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  );
$$;

create or replace function recalc_admin.current_user_shares_org_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = recalc_admin, public
as $$
  select target_user_id = (select auth.uid())
    or exists (
      select 1
      from recalc_admin.organization_members viewer
      join recalc_admin.organization_members subject
        on subject.organization_id = viewer.organization_id
      where viewer.user_id = (select auth.uid())
        and viewer.status = 'active'
        and subject.user_id = target_user_id
        and subject.status = 'active'
    );
$$;

revoke all on function recalc_admin.try_uuid(text) from public;
revoke all on function recalc_admin.current_user_is_org_member(uuid) from public;
revoke all on function recalc_admin.current_user_is_org_admin(uuid) from public;
revoke all on function recalc_admin.current_user_shares_org_with(uuid) from public;
grant execute on function recalc_admin.try_uuid(text) to authenticated;
grant execute on function recalc_admin.current_user_is_org_member(uuid) to authenticated;
grant execute on function recalc_admin.current_user_is_org_admin(uuid) to authenticated;
grant execute on function recalc_admin.current_user_shares_org_with(uuid) to authenticated;

grant usage on schema recalc_admin to authenticated, service_role;
grant select, insert, update, delete on all tables in schema recalc_admin to authenticated;
grant usage, select on all sequences in schema recalc_admin to authenticated;
alter default privileges in schema recalc_admin
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema recalc_admin
  grant usage, select on sequences to authenticated;

alter table recalc_admin.profiles enable row level security;
alter table recalc_admin.organizations enable row level security;
alter table recalc_admin.organization_members enable row level security;
alter table recalc_admin.roles enable row level security;
alter table recalc_admin.permissions enable row level security;
alter table recalc_admin.role_permissions enable row level security;
alter table recalc_admin.file_assets enable row level security;
alter table recalc_admin.inbox_threads enable row level security;
alter table recalc_admin.inbox_messages enable row level security;
alter table recalc_admin.training_rooms enable row level security;
alter table recalc_admin.training_messages enable row level security;
alter table recalc_admin.migration_batches enable row level security;

drop policy if exists profiles_select_own on recalc_admin.profiles;
create policy profiles_select_own
on recalc_admin.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_select_same_org on recalc_admin.profiles;
create policy profiles_select_same_org
on recalc_admin.profiles
for select
to authenticated
using (recalc_admin.current_user_shares_org_with(id));

drop policy if exists profiles_update_own on recalc_admin.profiles;
create policy profiles_update_own
on recalc_admin.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists organizations_select_member on recalc_admin.organizations;
create policy organizations_select_member
on recalc_admin.organizations
for select
to authenticated
using (recalc_admin.current_user_is_org_member(id));

drop policy if exists organizations_update_admin on recalc_admin.organizations;
create policy organizations_update_admin
on recalc_admin.organizations
for update
to authenticated
using (recalc_admin.current_user_is_org_admin(id))
with check (recalc_admin.current_user_is_org_admin(id));

drop policy if exists organization_members_select_same_org on recalc_admin.organization_members;
create policy organization_members_select_same_org
on recalc_admin.organization_members
for select
to authenticated
using (recalc_admin.current_user_is_org_member(organization_id));

drop policy if exists organization_members_admin_manage on recalc_admin.organization_members;
create policy organization_members_admin_manage
on recalc_admin.organization_members
for all
to authenticated
using (recalc_admin.current_user_is_org_admin(organization_id))
with check (recalc_admin.current_user_is_org_admin(organization_id));

drop policy if exists roles_select_member on recalc_admin.roles;
create policy roles_select_member
on recalc_admin.roles
for select
to authenticated
using (true);

drop policy if exists permissions_select_member on recalc_admin.permissions;
create policy permissions_select_member
on recalc_admin.permissions
for select
to authenticated
using (true);

drop policy if exists role_permissions_select_member on recalc_admin.role_permissions;
create policy role_permissions_select_member
on recalc_admin.role_permissions
for select
to authenticated
using (true);

drop policy if exists file_assets_select_member on recalc_admin.file_assets;
create policy file_assets_select_member
on recalc_admin.file_assets
for select
to authenticated
using (
  deleted_at is null
  and (
    visibility = 'public'
    or owner_user_id = (select auth.uid())
    or recalc_admin.current_user_is_org_member(organization_id)
  )
);

drop policy if exists file_assets_insert_member on recalc_admin.file_assets;
create policy file_assets_insert_member
on recalc_admin.file_assets
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and recalc_admin.current_user_is_org_member(organization_id)
);

drop policy if exists file_assets_update_admin_or_owner on recalc_admin.file_assets;
create policy file_assets_update_admin_or_owner
on recalc_admin.file_assets
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  or recalc_admin.current_user_is_org_admin(organization_id)
)
with check (
  owner_user_id = (select auth.uid())
  or recalc_admin.current_user_is_org_admin(organization_id)
);

drop policy if exists inbox_threads_select_member on recalc_admin.inbox_threads;
create policy inbox_threads_select_member
on recalc_admin.inbox_threads
for select
to authenticated
using (recalc_admin.current_user_is_org_member(organization_id));

drop policy if exists inbox_threads_insert_member on recalc_admin.inbox_threads;
create policy inbox_threads_insert_member
on recalc_admin.inbox_threads
for insert
to authenticated
with check (recalc_admin.current_user_is_org_member(organization_id));

drop policy if exists inbox_messages_select_member on recalc_admin.inbox_messages;
create policy inbox_messages_select_member
on recalc_admin.inbox_messages
for select
to authenticated
using (recalc_admin.current_user_is_org_member(organization_id));

drop policy if exists inbox_messages_insert_member on recalc_admin.inbox_messages;
create policy inbox_messages_insert_member
on recalc_admin.inbox_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and recalc_admin.current_user_is_org_member(organization_id)
);

drop policy if exists training_rooms_select_member on recalc_admin.training_rooms;
create policy training_rooms_select_member
on recalc_admin.training_rooms
for select
to authenticated
using (recalc_admin.current_user_is_org_member(organization_id));

drop policy if exists training_messages_select_member on recalc_admin.training_messages;
create policy training_messages_select_member
on recalc_admin.training_messages
for select
to authenticated
using (recalc_admin.current_user_is_org_member(organization_id));

drop policy if exists training_messages_insert_member on recalc_admin.training_messages;
create policy training_messages_insert_member
on recalc_admin.training_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and recalc_admin.current_user_is_org_member(organization_id)
);

drop policy if exists migration_batches_admin_only on recalc_admin.migration_batches;
create policy migration_batches_admin_only
on recalc_admin.migration_batches
for all
to authenticated
using (false)
with check (false);

insert into recalc_admin.roles (key, label)
values
  ('owner', 'Owner'),
  ('admin', 'Administrator'),
  ('member', 'Member')
on conflict (key) do update
set label = excluded.label;

insert into recalc_admin.permissions (key, description)
values
  ('organizations.read', 'Read organization data'),
  ('organizations.manage', 'Manage organization settings and members'),
  ('files.read', 'Read organization files'),
  ('files.manage', 'Upload and manage organization files'),
  ('inbox.read', 'Read inbox threads and messages'),
  ('inbox.write', 'Create inbox messages'),
  ('training.read', 'Read training rooms and messages'),
  ('training.write', 'Create training messages')
on conflict (key) do update
set description = excluded.description;

insert into recalc_admin.role_permissions (role_key, permission_key)
values
  ('owner', 'organizations.read'),
  ('owner', 'organizations.manage'),
  ('owner', 'files.read'),
  ('owner', 'files.manage'),
  ('owner', 'inbox.read'),
  ('owner', 'inbox.write'),
  ('owner', 'training.read'),
  ('owner', 'training.write'),
  ('admin', 'organizations.read'),
  ('admin', 'organizations.manage'),
  ('admin', 'files.read'),
  ('admin', 'files.manage'),
  ('admin', 'inbox.read'),
  ('admin', 'inbox.write'),
  ('admin', 'training.read'),
  ('admin', 'training.write'),
  ('member', 'organizations.read'),
  ('member', 'files.read'),
  ('member', 'inbox.read'),
  ('member', 'inbox.write'),
  ('member', 'training.read'),
  ('member', 'training.write')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 52428800, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('avatars', 'avatars', false, 5242880, array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]),
  ('imports', 'imports', false, 52428800, array[
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('exports', 'exports', false, 52428800, array[
    'text/csv',
    'application/json',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('attachments', 'attachments', false, 20971520, array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
  ])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists recalc_storage_select_metadata_authorized on storage.objects;
create policy recalc_storage_select_metadata_authorized
on storage.objects
for select
to authenticated
using (
  (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  or exists (
    select 1
    from recalc_admin.file_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.object_path = storage.objects.name
      and asset.deleted_at is null
      and (
        asset.visibility = 'public'
        or asset.owner_user_id = (select auth.uid())
        or recalc_admin.current_user_is_org_member(asset.organization_id)
      )
  )
);

drop policy if exists recalc_storage_insert_member_path on storage.objects;
create policy recalc_storage_insert_member_path
on storage.objects
for insert
to authenticated
with check (
  (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  or (
    bucket_id in ('documents', 'imports', 'exports', 'attachments')
    and (storage.foldername(name))[1] = 'organizations'
    and recalc_admin.current_user_is_org_member(recalc_admin.try_uuid((storage.foldername(name))[2]))
  )
);

drop policy if exists recalc_storage_update_metadata_authorized on storage.objects;
create policy recalc_storage_update_metadata_authorized
on storage.objects
for update
to authenticated
using (
  exists (
    select 1
    from recalc_admin.file_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.object_path = storage.objects.name
      and (
        asset.owner_user_id = (select auth.uid())
        or recalc_admin.current_user_is_org_admin(asset.organization_id)
      )
  )
)
with check (
  exists (
    select 1
    from recalc_admin.file_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.object_path = storage.objects.name
      and (
        asset.owner_user_id = (select auth.uid())
        or recalc_admin.current_user_is_org_admin(asset.organization_id)
      )
  )
);

drop policy if exists recalc_storage_delete_metadata_authorized on storage.objects;
create policy recalc_storage_delete_metadata_authorized
on storage.objects
for delete
to authenticated
using (
  exists (
    select 1
    from recalc_admin.file_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.object_path = storage.objects.name
      and (
        asset.owner_user_id = (select auth.uid())
        or recalc_admin.current_user_is_org_admin(asset.organization_id)
      )
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'recalc_admin'
        and tablename = 'inbox_messages'
    ) then
      alter publication supabase_realtime add table recalc_admin.inbox_messages;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'recalc_admin'
        and tablename = 'training_messages'
    ) then
      alter publication supabase_realtime add table recalc_admin.training_messages;
    end if;
  end if;
end $$;

commit;
