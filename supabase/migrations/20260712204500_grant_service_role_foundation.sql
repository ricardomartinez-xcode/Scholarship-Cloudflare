-- The foundation tables predate the Prisma-derived application schema. The
-- service role bypasses RLS, but it still needs explicit table privileges for
-- administrative migration and validation tasks.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  recalc_admin.profiles,
  recalc_admin.organizations,
  recalc_admin.organization_members,
  recalc_admin.roles,
  recalc_admin.permissions,
  recalc_admin.role_permissions,
  recalc_admin.file_assets,
  recalc_admin.inbox_threads,
  recalc_admin.inbox_messages,
  recalc_admin.training_rooms,
  recalc_admin.training_messages,
  recalc_admin.migration_batches
TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA recalc_admin TO service_role;
