DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'AdminAdditionalBenefitType'
      AND e.enumlabel = 'fixed_scholarship'
  ) THEN
    ALTER TYPE "recalc_admin"."AdminAdditionalBenefitType" ADD VALUE 'fixed_scholarship';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "admin_price_override_scope_active_idx"
  ON "recalc_admin"."admin_price_override" ("scope", "isActive");
