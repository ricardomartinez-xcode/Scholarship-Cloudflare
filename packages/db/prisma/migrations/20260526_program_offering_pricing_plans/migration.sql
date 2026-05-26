ALTER TABLE "recalc_admin"."program_offering"
ADD COLUMN IF NOT EXISTS "pricingPlans" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
