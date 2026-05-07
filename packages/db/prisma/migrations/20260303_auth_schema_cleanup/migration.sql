-- Auth schema cleanup:
-- 1. Drop the dead admin_user table that was never used once Neon Auth was adopted.
--    The application never calls prisma.adminUser; all admin auth goes through
--    Neon Auth + recalc_admin."user" with role=ADMIN.
-- 2. Backfill NULL updatedAt values that could exist due to the idempotent migration
--    pattern in 20260211_roles_invites_benefit_scope (ADD COLUMN without NOT NULL).
-- 3. Remove any user rows with NULL email that are not recoverable.

-- 1. Drop orphaned admin_user table
DROP TABLE IF EXISTS "recalc_admin"."admin_user";

-- 2. Backfill NULL updatedAt (safe: set to createdAt so the row is valid)
UPDATE "recalc_admin"."user"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" IS NULL;

UPDATE "recalc_admin"."invite"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" IS NULL;

-- 3. Remove rows with NULL email — these are unrecoverable orphans
--    (only possible if the old migration ran on a partially-initialized table)
DELETE FROM "recalc_admin"."user" WHERE "email" IS NULL;
