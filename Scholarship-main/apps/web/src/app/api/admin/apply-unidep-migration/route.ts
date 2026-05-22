import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Each SQL statement to execute in order (idempotent)
const MIGRATION_STEPS: { name: string; sql: string }[] = [
  {
    name: "campus: add address column",
    sql: `ALTER TABLE "recalc_admin"."campus" ADD COLUMN IF NOT EXISTS "address" TEXT`,
  },
  {
    name: "campus: add phone column",
    sql: `ALTER TABLE "recalc_admin"."campus" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  },
  {
    name: "campus: add whatsapp column",
    sql: `ALTER TABLE "recalc_admin"."campus" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT`,
  },
  {
    name: "enum: create BenefitBusinessLine if not exists",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'BenefitBusinessLine'
  ) THEN
    CREATE TYPE "recalc_admin"."BenefitBusinessLine" AS ENUM ('salud','licenciatura','prepa','posgrado');
  END IF;
END $$`,
  },
  {
    name: "program: add businessLine column",
    sql: `ALTER TABLE "recalc_admin"."program" ADD COLUMN IF NOT EXISTS "businessLine" "recalc_admin"."BenefitBusinessLine"`,
  },
  {
    name: "program: add planPdfUrl column",
    sql: `ALTER TABLE "recalc_admin"."program" ADD COLUMN IF NOT EXISTS "planPdfUrl" TEXT`,
  },
  {
    name: "program: add brochurePdfUrl column",
    sql: `ALTER TABLE "recalc_admin"."program" ADD COLUMN IF NOT EXISTS "brochurePdfUrl" TEXT`,
  },
  {
    name: "enum: create AcademicFeeSection if not exists",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AcademicFeeSection'
  ) THEN
    CREATE TYPE "recalc_admin"."AcademicFeeSection" AS ENUM ('EXAMENES','TRAMITES','DIVERSOS');
  END IF;
END $$`,
  },
  {
    name: "table: create academic_fee",
    sql: `CREATE TABLE IF NOT EXISTS "recalc_admin"."academic_fee" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "costMxn" INTEGER NOT NULL,
  "section" "recalc_admin"."AcademicFeeSection" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_fee_pkey" PRIMARY KEY ("id")
)`,
  },
  {
    name: "index: academic_fee unique code",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'academic_fee_code_key'
  ) THEN
    CREATE UNIQUE INDEX "academic_fee_code_key" ON "recalc_admin"."academic_fee"("code");
  END IF;
END $$`,
  },
  {
    name: "table: create campus_academic_fee",
    sql: `CREATE TABLE IF NOT EXISTS "recalc_admin"."campus_academic_fee" (
  "id" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  "academicFeeId" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "overrideCostMxn" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campus_academic_fee_pkey" PRIMARY KEY ("id")
)`,
  },
  {
    name: "index: campus_academic_fee unique pair",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_academic_fee_campusId_academicFeeId_key'
  ) THEN
    CREATE UNIQUE INDEX "campus_academic_fee_campusId_academicFeeId_key"
      ON "recalc_admin"."campus_academic_fee"("campusId","academicFeeId");
  END IF;
END $$`,
  },
  {
    name: "index: campus_academic_fee campusId",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_academic_fee_campusId_idx'
  ) THEN
    CREATE INDEX "campus_academic_fee_campusId_idx" ON "recalc_admin"."campus_academic_fee"("campusId");
  END IF;
END $$`,
  },
  {
    name: "fk: campus_academic_fee -> campus",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_academic_fee_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."campus_academic_fee"
      ADD CONSTRAINT "campus_academic_fee_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$`,
  },
  {
    name: "fk: campus_academic_fee -> academic_fee",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_academic_fee_academicFeeId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."campus_academic_fee"
      ADD CONSTRAINT "campus_academic_fee_academicFeeId_fkey"
      FOREIGN KEY ("academicFeeId") REFERENCES "recalc_admin"."academic_fee"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$`,
  },
  {
    name: "enum: add UNIDEP_PRIMARY to AdminPublicCtaLocation",
    sql: `ALTER TYPE "recalc_admin"."AdminPublicCtaLocation" ADD VALUE IF NOT EXISTS 'UNIDEP_PRIMARY'`,
  },
];

export async function POST() {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const step of MIGRATION_STEPS) {
    try {
      await prisma.$executeRawUnsafe(step.sql);
      results.push({ name: step.name, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: step.name, ok: false, error: msg });
      // Continue with other steps even if one fails
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results });
}
