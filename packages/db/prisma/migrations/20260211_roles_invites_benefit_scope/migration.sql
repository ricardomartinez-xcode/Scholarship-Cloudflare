-- Roles + user management + invitations + benefit scope fields.
-- Idempotent migration for existing recalc_admin schema.

CREATE SCHEMA IF NOT EXISTS "recalc_admin";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'Role'
  ) THEN
    CREATE TYPE "recalc_admin"."Role" AS ENUM ('USER', 'ADMIN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'BenefitBusinessLine'
  ) THEN
    CREATE TYPE "recalc_admin"."BenefitBusinessLine" AS ENUM ('salud', 'licenciatura', 'prepa', 'posgrado');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'BenefitModality'
  ) THEN
    CREATE TYPE "recalc_admin"."BenefitModality" AS ENUM ('presencial', 'mixta', 'online');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'BenefitDuration'
  ) THEN
    CREATE TYPE "recalc_admin"."BenefitDuration" AS ENUM ('primer_cuatrimestre', 'toda_la_carrera', 'pago_inicial');
  END IF;
END $$;

-- User table
CREATE TABLE IF NOT EXISTS "recalc_admin"."user" (
  "id" UUID NOT NULL,
  "authUserId" TEXT,
  "email" TEXT NOT NULL,
  "role" "recalc_admin"."Role" NOT NULL DEFAULT 'USER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recalc_admin"."user"
  ADD COLUMN IF NOT EXISTS "authUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "recalc_admin"."Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'user_email_key'
  ) THEN
    CREATE UNIQUE INDEX "user_email_key" ON "recalc_admin"."user"("email");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'user_authUserId_key'
  ) THEN
    CREATE UNIQUE INDEX "user_authUserId_key" ON "recalc_admin"."user"("authUserId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'user_role_isActive_idx'
  ) THEN
    CREATE INDEX "user_role_isActive_idx" ON "recalc_admin"."user"("role", "isActive");
  END IF;
END $$;

-- Invite table
CREATE TABLE IF NOT EXISTS "recalc_admin"."invite" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "recalc_admin"."Role" NOT NULL DEFAULT 'USER',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recalc_admin"."invite"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "recalc_admin"."Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "tokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdById" UUID,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'invite_tokenHash_key'
  ) THEN
    CREATE UNIQUE INDEX "invite_tokenHash_key" ON "recalc_admin"."invite"("tokenHash");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'invite_email_used_expires_idx'
  ) THEN
    CREATE INDEX "invite_email_used_expires_idx" ON "recalc_admin"."invite"("email", "usedAt", "expiresAt");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'invite_creator_created_idx'
  ) THEN
    CREATE INDEX "invite_creator_created_idx" ON "recalc_admin"."invite"("createdById", "createdAt");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invite_createdById_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."invite"
      ADD CONSTRAINT "invite_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "recalc_admin"."user"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Benefit scope fields
ALTER TABLE "recalc_admin"."admin_additional_benefit"
  ADD COLUMN IF NOT EXISTS "businessLine" "recalc_admin"."BenefitBusinessLine",
  ADD COLUMN IF NOT EXISTS "modality" "recalc_admin"."BenefitModality",
  ADD COLUMN IF NOT EXISTS "duration" "recalc_admin"."BenefitDuration";
