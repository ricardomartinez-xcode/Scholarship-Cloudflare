-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingRoomVisibility" AS ENUM ('private', 'org', 'public');

-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingRoomRole" AS ENUM ('participant', 'trainer', 'facilitator');

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingRoom" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scenario" TEXT,
    "visibility" "recalc_admin"."TrainingRoomVisibility" NOT NULL DEFAULT 'org',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingRoomMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "recalc_admin"."TrainingRoomRole" NOT NULL DEFAULT 'participant',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "anonymousAlias" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingRoomPermission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "canViewRolplay" BOOLEAN NOT NULL DEFAULT false,
    "canJoinRolplay" BOOLEAN NOT NULL DEFAULT false,
    "canCreateRoom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoomPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingRoom_organizationId_idx" ON "recalc_admin"."TrainingRoom"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingRoom_createdBy_idx" ON "recalc_admin"."TrainingRoom"("createdBy");

-- CreateIndex
CREATE INDEX "TrainingRoom_createdAt_idx" ON "recalc_admin"."TrainingRoom"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRoomMember_roomId_userId_key" ON "recalc_admin"."TrainingRoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "TrainingRoomMember_roomId_idx" ON "recalc_admin"."TrainingRoomMember"("roomId");

-- CreateIndex
CREATE INDEX "TrainingRoomMember_userId_idx" ON "recalc_admin"."TrainingRoomMember"("userId");

-- CreateIndex
CREATE INDEX "TrainingRoomMember_joinedAt_idx" ON "recalc_admin"."TrainingRoomMember"("joinedAt");

-- CreateIndex
CREATE INDEX "TrainingMessage_roomId_idx" ON "recalc_admin"."TrainingMessage"("roomId");

-- CreateIndex
CREATE INDEX "TrainingMessage_userId_idx" ON "recalc_admin"."TrainingMessage"("userId");

-- CreateIndex
CREATE INDEX "TrainingMessage_createdAt_idx" ON "recalc_admin"."TrainingMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRoomPermission_userId_organizationId_key" ON "recalc_admin"."TrainingRoomPermission"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "TrainingRoomPermission_userId_idx" ON "recalc_admin"."TrainingRoomPermission"("userId");

-- CreateIndex
CREATE INDEX "TrainingRoomPermission_organizationId_idx" ON "recalc_admin"."TrainingRoomPermission"("organizationId");

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoom" ADD CONSTRAINT "TrainingRoom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoom" ADD CONSTRAINT "TrainingRoom_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "recalc_admin"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomMember" ADD CONSTRAINT "TrainingRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomMember" ADD CONSTRAINT "TrainingRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingMessage" ADD CONSTRAINT "TrainingMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingMessage" ADD CONSTRAINT "TrainingMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomPermission" ADD CONSTRAINT "TrainingRoomPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomPermission" ADD CONSTRAINT "TrainingRoomPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
