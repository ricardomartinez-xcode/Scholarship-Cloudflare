DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminConfigModule'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminConfigModule" AS ENUM (
      'BENEFITS',
      'PRICES',
      'CTAS',
      'SIDEBAR',
      'DIRECTORY',
      'OFFER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminAuditAction'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminAuditAction" AS ENUM (
      'CREATE',
      'UPDATE',
      'DELETE',
      'PUBLISH',
      'ROLLBACK',
      'IMPORT_VALIDATE',
      'IMPORT_APPLY',
      'IMPORT_ROLLBACK'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminChangeSource'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminChangeSource" AS ENUM (
      'UI',
      'IMPORT',
      'SYSTEM'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminImportSessionStatus'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminImportSessionStatus" AS ENUM (
      'preview',
      'applied',
      'rolled_back',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_audit_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "module" "recalc_admin"."AdminConfigModule" NOT NULL,
  "action" "recalc_admin"."AdminAuditAction" NOT NULL,
  "source" "recalc_admin"."AdminChangeSource" NOT NULL DEFAULT 'UI',
  "actorUserId" UUID,
  "actorEmail" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "requestId" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "diffSummary" JSONB,
  "message" TEXT,
  "importSessionId" UUID,
  "versionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_config_version" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "module" "recalc_admin"."AdminConfigModule" NOT NULL,
  "source" "recalc_admin"."AdminChangeSource" NOT NULL DEFAULT 'UI',
  "snapshot" JSONB NOT NULL,
  "diffSummary" JSONB,
  "summary" JSONB,
  "notes" TEXT,
  "createdByUserId" UUID,
  "createdByEmail" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedByUserId" UUID,
  "publishedByEmail" TEXT,
  "importSessionId" UUID,
  "restoredFromVersionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_config_version_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_published_config" (
  "module" "recalc_admin"."AdminConfigModule" NOT NULL,
  "versionId" UUID NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" UUID,
  "updatedByEmail" TEXT,

  CONSTRAINT "admin_published_config_pkey" PRIMARY KEY ("module")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_import_session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "module" "recalc_admin"."AdminConfigModule" NOT NULL,
  "status" "recalc_admin"."AdminImportSessionStatus" NOT NULL DEFAULT 'preview',
  "source" "recalc_admin"."AdminChangeSource" NOT NULL DEFAULT 'IMPORT',
  "fileName" TEXT,
  "fileChecksum" TEXT,
  "preview" JSONB,
  "payload" JSONB,
  "warnings" JSONB,
  "errors" JSONB,
  "result" JSONB,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "summary" JSONB,
  "createdByUserId" UUID,
  "createdByEmail" TEXT,
  "appliedByUserId" UUID,
  "appliedByEmail" TEXT,
  "appliedVersionId" UUID,
  "rolledBackVersionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),

  CONSTRAINT "admin_import_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_published_config_versionId_key"
ON "recalc_admin"."admin_published_config"("versionId");

CREATE INDEX IF NOT EXISTS "admin_audit_log_module_created_idx"
ON "recalc_admin"."admin_audit_log"("module", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_created_idx"
ON "recalc_admin"."admin_audit_log"("actorEmail", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_audit_log_request_idx"
ON "recalc_admin"."admin_audit_log"("requestId");

CREATE INDEX IF NOT EXISTS "admin_config_version_module_created_idx"
ON "recalc_admin"."admin_config_version"("module", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_config_version_module_published_idx"
ON "recalc_admin"."admin_config_version"("module", "publishedAt");

CREATE INDEX IF NOT EXISTS "admin_config_version_import_session_idx"
ON "recalc_admin"."admin_config_version"("importSessionId");

CREATE INDEX IF NOT EXISTS "admin_import_session_module_status_created_idx"
ON "recalc_admin"."admin_import_session"("module", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_import_session_creator_created_idx"
ON "recalc_admin"."admin_import_session"("createdByEmail", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_published_config_versionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_published_config"
    ADD CONSTRAINT "admin_published_config_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "recalc_admin"."admin_config_version"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
