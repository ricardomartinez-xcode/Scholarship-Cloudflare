DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'AdminCapability'
      AND e.enumlabel = 'view_admin_operations'
  ) THEN
    ALTER TYPE "recalc_admin"."AdminCapability" ADD VALUE 'view_admin_operations';
  END IF;
END $$;
