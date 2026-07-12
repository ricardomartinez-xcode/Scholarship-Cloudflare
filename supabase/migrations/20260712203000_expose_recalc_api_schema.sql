-- Expose the RLS-protected custom schema through Supabase Data API.
-- This role-level setting avoids pushing unrelated local Auth configuration.
BEGIN;

ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, recalc_admin';

ALTER ROLE authenticator
  SET pgrst.db_extra_search_path = 'public, extensions, recalc_admin';

NOTIFY pgrst, 'reload config';

COMMIT;
