ALTER TYPE "recalc_admin"."UserCapability" ADD VALUE IF NOT EXISTS 'owner_permissions';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'UserAgendaItemType'
  ) THEN
    CREATE TYPE "recalc_admin"."UserAgendaItemType" AS ENUM ('recordatorio', 'pago', 'pendiente');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'UserAgendaItemStatus'
  ) THEN
    CREATE TYPE "recalc_admin"."UserAgendaItemStatus" AS ENUM ('abierto', 'hecho', 'cancelado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_admin"."user_agenda_item" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "recalc_admin"."UserAgendaItemType" NOT NULL,
  "status" "recalc_admin"."UserAgendaItemStatus" NOT NULL DEFAULT 'abierto',
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "dueAt" TIMESTAMPTZ,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_agenda_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_agenda_item_user_status_updated_idx"
ON "recalc_admin"."user_agenda_item"("userId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "user_agenda_item_user_type_updated_idx"
ON "recalc_admin"."user_agenda_item"("userId", "type", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_agenda_item_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."user_agenda_item"
    ADD CONSTRAINT "user_agenda_item_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
