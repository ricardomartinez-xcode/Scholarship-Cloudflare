-- CreateTable (organization)
CREATE TABLE IF NOT EXISTS "recalc_admin"."organization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable (organization_member)
CREATE TABLE IF NOT EXISTS "recalc_admin"."organization_member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_member_pkey" PRIMARY KEY ("id")
);

-- Add organizationId to invite (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'recalc_admin' AND table_name = 'invite' AND column_name = 'organizationId'
    ) THEN
        ALTER TABLE "recalc_admin"."invite" ADD COLUMN "organizationId" UUID;
    END IF;
END $$;

-- Drop legacy teamId from invite
ALTER TABLE "recalc_admin"."invite" DROP COLUMN IF EXISTS "teamId";

-- CreateIndex (organization_member unique)
CREATE UNIQUE INDEX IF NOT EXISTS "organization_member_organizationId_userId_key"
    ON "recalc_admin"."organization_member"("organizationId", "userId");

-- CreateIndex (invite organization)
CREATE INDEX IF NOT EXISTS "invite_organization_idx"
    ON "recalc_admin"."invite"("organizationId");

-- AddForeignKey (invite -> organization)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'invite_organizationId_fkey'
          AND table_schema = 'recalc_admin'
    ) THEN
        ALTER TABLE "recalc_admin"."invite"
            ADD CONSTRAINT "invite_organizationId_fkey"
            FOREIGN KEY ("organizationId")
            REFERENCES "recalc_admin"."organization"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (organization_member -> organization)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'organization_member_organizationId_fkey'
          AND table_schema = 'recalc_admin'
    ) THEN
        ALTER TABLE "recalc_admin"."organization_member"
            ADD CONSTRAINT "organization_member_organizationId_fkey"
            FOREIGN KEY ("organizationId")
            REFERENCES "recalc_admin"."organization"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (organization_member -> user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'organization_member_userId_fkey'
          AND table_schema = 'recalc_admin'
    ) THEN
        ALTER TABLE "recalc_admin"."organization_member"
            ADD CONSTRAINT "organization_member_userId_fkey"
            FOREIGN KEY ("userId")
            REFERENCES "recalc_admin"."user"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
