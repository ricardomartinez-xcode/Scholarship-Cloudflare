DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'WhatsappTemplateStatus'
  ) THEN
    CREATE TYPE "recalc_admin"."WhatsappTemplateStatus" AS ENUM (
      'personal',
      'submitted_for_review',
      'approved',
      'rejected',
      'official',
      'archived'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'WhatsappTemplateKind'
  ) THEN
    CREATE TYPE "recalc_admin"."WhatsappTemplateKind" AS ENUM (
      'summary',
      'detailed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_admin"."whatsapp_template" (
  "id" UUID NOT NULL,
  "systemKey" TEXT,
  "name" TEXT NOT NULL,
  "kind" "recalc_admin"."WhatsappTemplateKind" NOT NULL DEFAULT 'detailed',
  "status" "recalc_admin"."WhatsappTemplateStatus" NOT NULL DEFAULT 'personal',
  "ownerUserId" UUID,
  "authorUserId" UUID,
  "sourceTemplateId" UUID,
  "isDefaultOfficial" BOOLEAN NOT NULL DEFAULT false,
  "baseText" TEXT,
  "fieldOrder" JSONB NOT NULL,
  "reviewNotes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID,
  "reviewedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."whatsapp_template_preference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "activeTemplateId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_template_preference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_template_systemKey_key"
  ON "recalc_admin"."whatsapp_template"("systemKey");

CREATE INDEX IF NOT EXISTS "whatsapp_template_status_updated_idx"
  ON "recalc_admin"."whatsapp_template"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "whatsapp_template_owner_updated_idx"
  ON "recalc_admin"."whatsapp_template"("ownerUserId", "updatedAt");

CREATE INDEX IF NOT EXISTS "whatsapp_template_source_idx"
  ON "recalc_admin"."whatsapp_template"("sourceTemplateId");

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_template_default_official_unique_idx"
  ON "recalc_admin"."whatsapp_template"("isDefaultOfficial")
  WHERE "status" = 'official' AND "isDefaultOfficial" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_template_preference_userId_key"
  ON "recalc_admin"."whatsapp_template_preference"("userId");

CREATE INDEX IF NOT EXISTS "whatsapp_template_preference_active_idx"
  ON "recalc_admin"."whatsapp_template_preference"("activeTemplateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_template_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."whatsapp_template"
      ADD CONSTRAINT "whatsapp_template_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_template_authorUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."whatsapp_template"
      ADD CONSTRAINT "whatsapp_template_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_template_sourceTemplateId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."whatsapp_template"
      ADD CONSTRAINT "whatsapp_template_sourceTemplateId_fkey"
      FOREIGN KEY ("sourceTemplateId") REFERENCES "recalc_admin"."whatsapp_template"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_template_reviewedByUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."whatsapp_template"
      ADD CONSTRAINT "whatsapp_template_reviewedByUserId_fkey"
      FOREIGN KEY ("reviewedByUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_template_preference_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."whatsapp_template_preference"
      ADD CONSTRAINT "whatsapp_template_preference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_template_preference_activeTemplateId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."whatsapp_template_preference"
      ADD CONSTRAINT "whatsapp_template_preference_activeTemplateId_fkey"
      FOREIGN KEY ("activeTemplateId") REFERENCES "recalc_admin"."whatsapp_template"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "recalc_admin"."whatsapp_template" (
  "id",
  "systemKey",
  "name",
  "kind",
  "status",
  "isDefaultOfficial",
  "baseText",
  "fieldOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'official-default-detailed',
  'Cotización detallada oficial',
  'detailed',
  'official',
  NOT EXISTS (
    SELECT 1
    FROM "recalc_admin"."whatsapp_template"
    WHERE "status" = 'official'
      AND "isDefaultOfficial" = true
  ),
  'Hola, te comparto la cotización estimada:',
  '["campus","program","business_line","modality","plan","enrollment_type","schedule","list_price","scholarship","additional_benefit","additional_charge","subtotal","total","notes","call_to_action"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "recalc_admin"."whatsapp_template"
  WHERE "systemKey" = 'official-default-detailed'
);

INSERT INTO "recalc_admin"."whatsapp_template" (
  "id",
  "systemKey",
  "name",
  "kind",
  "status",
  "isDefaultOfficial",
  "baseText",
  "fieldOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'official-default-summary',
  'Resumen comercial oficial',
  'summary',
  'official',
  false,
  'Hola, te comparto el resumen comercial estimado:',
  '["program","campus","modality","plan","scholarship","additional_benefit","total","call_to_action"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "recalc_admin"."whatsapp_template"
  WHERE "systemKey" = 'official-default-summary'
);
