-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "recalc_admin";

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPublicCtaKind" AS ENUM ('link', 'action');

-- CreateTable
CREATE TABLE "recalc_admin"."admin_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_additional_benefit" (
    "id" UUID NOT NULL,
    "campusIds" TEXT[],
    "extraPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_additional_benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_price_override" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "targetKeys" JSONB NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_price_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_public_cta" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "recalc_admin"."AdminPublicCtaKind" NOT NULL,
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "variant" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_public_cta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_sidebar_info" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_sidebar_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "recalc_admin"."admin_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sidebar_info_key_key" ON "recalc_admin"."admin_sidebar_info"("key");

