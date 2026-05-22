-- Remove Better Auth tables
-- Better Auth was replaced with Neon Auth completely, so we can safely remove these tables.

-- Drop Better Auth tables
DROP TABLE IF EXISTS "recalc_admin"."ba_verification" CASCADE;
DROP TABLE IF EXISTS "recalc_admin"."ba_account" CASCADE;
DROP TABLE IF EXISTS "recalc_admin"."ba_session" CASCADE;
DROP TABLE IF EXISTS "recalc_admin"."ba_user" CASCADE;
