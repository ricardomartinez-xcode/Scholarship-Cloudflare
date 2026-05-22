DO $$
BEGIN
  ALTER TYPE "recalc_admin"."AdminPublicCtaLocation" ADD VALUE IF NOT EXISTS 'SIMULATOR_TOP';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "recalc_admin"."AdminPublicCtaLocation" ADD VALUE IF NOT EXISTS 'SIMULATOR_BOTTOM';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
