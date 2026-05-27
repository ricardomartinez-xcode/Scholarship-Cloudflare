CREATE TABLE "recalc_admin"."admin_canonical_alias" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "aliasType" TEXT NOT NULL,
  "canonicalValue" TEXT NOT NULL,
  "canonicalNormalized" TEXT NOT NULL,
  "aliasValue" TEXT NOT NULL,
  "aliasNormalized" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_canonical_alias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_canonical_alias_type_alias_key"
  ON "recalc_admin"."admin_canonical_alias"("aliasType", "aliasNormalized");

CREATE INDEX "admin_canonical_alias_type_canonical_active_idx"
  ON "recalc_admin"."admin_canonical_alias"("aliasType", "canonicalNormalized", "isActive");

CREATE INDEX "admin_canonical_alias_type_active_idx"
  ON "recalc_admin"."admin_canonical_alias"("aliasType", "isActive");
