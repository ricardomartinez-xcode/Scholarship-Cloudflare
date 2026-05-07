DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'AdminPublicCtaLocation'
  ) THEN
    ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
      ADD VALUE IF NOT EXISTS 'APP_RESULTS_BELOW';
  END IF;
END $$;
