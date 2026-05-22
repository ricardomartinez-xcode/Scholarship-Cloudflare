-- Create UserCapability enum
CREATE TYPE "recalc_admin"."UserCapability" AS ENUM (
  'access_admin_cta',
  'user_vip',
  'view_audit',
  'manage_template',
  'manage_comunications',
  'owner_permitions'
);

-- Create UserCapabilityAssignment table
CREATE TABLE "recalc_admin"."user_capability_assignment" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"     UUID        NOT NULL REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE,
  "capability" "recalc_admin"."UserCapability" NOT NULL,
  "grantedBy"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  CONSTRAINT "user_capability_assignment_user_capability_key" UNIQUE ("userId", "capability")
);

CREATE INDEX "user_capability_assignment_capability_idx"
  ON "recalc_admin"."user_capability_assignment"("capability");

-- Add requiredCapability to admin_public_cta
ALTER TABLE "recalc_admin"."admin_public_cta"
  ADD COLUMN "requiredCapability" "recalc_admin"."UserCapability";
