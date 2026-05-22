-- Add organization filtering and new-user flag to AdminPublicCta
ALTER TABLE "recalc_admin"."admin_public_cta"
  ADD COLUMN "organizationId" UUID REFERENCES "recalc_admin"."organization"("id") ON DELETE SET NULL,
  ADD COLUMN "onlyNewUsers"   BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "admin_public_cta_organization_idx"
  ON "recalc_admin"."admin_public_cta"("organizationId");
