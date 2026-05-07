DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'AdminConfigModule'
      AND e.enumlabel = 'ACCESS'
  ) THEN
    ALTER TYPE "recalc_admin"."AdminConfigModule" ADD VALUE 'ACCESS';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminCapability'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminCapability" AS ENUM (
      'view_admin',
      'manage_benefits',
      'manage_prices',
      'manage_ctas',
      'manage_sidebar',
      'manage_offers',
      'manage_directory',
      'view_users',
      'manage_users',
      'view_invites',
      'manage_invites',
      'view_org_members',
      'manage_org_members',
      'view_reports',
      'publish_config'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminUiModule'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminUiModule" AS ENUM (
      'ADMIN_HOME',
      'USERS',
      'INVITATIONS',
      'ORGANIZATIONS',
      'AUDIT',
      'BENEFITS',
      'PRICES',
      'CTAS',
      'SIDEBAR',
      'OFFER',
      'DIRECTORY',
      'CAMPUSES',
      'FEES',
      'PROGRAMS'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_user_capability" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "capability" "recalc_admin"."AdminCapability" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedByUserId" UUID,
  "updatedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_user_capability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_ui_preference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "module" "recalc_admin"."AdminUiModule" NOT NULL,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_ui_preference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_capability_user_capability_key"
  ON "recalc_admin"."admin_user_capability"("userId", "capability");

CREATE INDEX IF NOT EXISTS "admin_user_capability_capability_enabled_idx"
  ON "recalc_admin"."admin_user_capability"("capability", "enabled");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_ui_preference_user_module_key"
  ON "recalc_admin"."admin_ui_preference"("userId", "module");

CREATE INDEX IF NOT EXISTS "admin_ui_preference_module_updated_idx"
  ON "recalc_admin"."admin_ui_preference"("module", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_user_capability_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_user_capability"
      ADD CONSTRAINT "admin_user_capability_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_ui_preference_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_ui_preference"
      ADD CONSTRAINT "admin_ui_preference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
