-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingAccessRole" AS ENUM ('user', 'moderator', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingChatStatus" AS ENUM ('open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "recalc_admin"."InboxThreadStatus" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "recalc_admin"."TrainingRoomMember"
ADD COLUMN "accessRole" "recalc_admin"."TrainingAccessRole" NOT NULL DEFAULT 'user';

UPDATE "recalc_admin"."TrainingRoomMember"
SET "accessRole" = CASE
  WHEN "role" IN ('trainer', 'facilitator') THEN 'moderator'::"recalc_admin"."TrainingAccessRole"
  ELSE 'user'::"recalc_admin"."TrainingAccessRole"
END;

-- AlterTable
ALTER TABLE "recalc_admin"."TrainingMessage"
ADD COLUMN "chatId" UUID;

-- CreateTable
CREATE TABLE "recalc_admin"."training_chat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "title" TEXT,
    "status" "recalc_admin"."TrainingChatStatus" NOT NULL DEFAULT 'open',
    "createdBy" UUID NOT NULL,
    "closedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."training_chat_participant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "roomMemberId" UUID,
    "userId" UUID NOT NULL,
    "role" "recalc_admin"."TrainingAccessRole" NOT NULL DEFAULT 'user',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_chat_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."training_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "rating" INTEGER,
    "summary" TEXT NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."inbox_thread" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID,
    "subject" TEXT,
    "status" "recalc_admin"."InboxThreadStatus" NOT NULL DEFAULT 'active',
    "createdBy" UUID NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."inbox_thread_participant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_thread_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."inbox_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingMessage_chatId_idx" ON "recalc_admin"."TrainingMessage"("chatId");

-- CreateIndex
CREATE INDEX "training_chat_room_updated_idx" ON "recalc_admin"."training_chat"("roomId", "updatedAt");

-- CreateIndex
CREATE INDEX "training_chat_status_last_message_idx" ON "recalc_admin"."training_chat"("status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "training_chat_participant_chatId_userId_key" ON "recalc_admin"."training_chat_participant"("chatId", "userId");

-- CreateIndex
CREATE INDEX "training_chat_participant_room_member_idx" ON "recalc_admin"."training_chat_participant"("roomMemberId");

-- CreateIndex
CREATE INDEX "training_chat_participant_user_joined_idx" ON "recalc_admin"."training_chat_participant"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "training_feedback_chat_created_idx" ON "recalc_admin"."training_feedback"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "training_feedback_target_created_idx" ON "recalc_admin"."training_feedback"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "inbox_thread_org_updated_idx" ON "recalc_admin"."inbox_thread"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "inbox_thread_status_last_message_idx" ON "recalc_admin"."inbox_thread"("status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_thread_participant_threadId_userId_key" ON "recalc_admin"."inbox_thread_participant"("threadId", "userId");

-- CreateIndex
CREATE INDEX "inbox_thread_participant_user_updated_idx" ON "recalc_admin"."inbox_thread_participant"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "inbox_message_thread_created_idx" ON "recalc_admin"."inbox_message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "inbox_message_user_created_idx" ON "recalc_admin"."inbox_message"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingMessage"
ADD CONSTRAINT "TrainingMessage_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "recalc_admin"."training_chat"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat"
ADD CONSTRAINT "training_chat_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat"
ADD CONSTRAINT "training_chat_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "recalc_admin"."user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat_participant"
ADD CONSTRAINT "training_chat_participant_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "recalc_admin"."training_chat"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat_participant"
ADD CONSTRAINT "training_chat_participant_roomMemberId_fkey"
FOREIGN KEY ("roomMemberId") REFERENCES "recalc_admin"."TrainingRoomMember"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat_participant"
ADD CONSTRAINT "training_chat_participant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback"
ADD CONSTRAINT "training_feedback_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback"
ADD CONSTRAINT "training_feedback_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "recalc_admin"."training_chat"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback"
ADD CONSTRAINT "training_feedback_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback"
ADD CONSTRAINT "training_feedback_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread"
ADD CONSTRAINT "inbox_thread_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread"
ADD CONSTRAINT "inbox_thread_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "recalc_admin"."user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread_participant"
ADD CONSTRAINT "inbox_thread_participant_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "recalc_admin"."inbox_thread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread_participant"
ADD CONSTRAINT "inbox_thread_participant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_message"
ADD CONSTRAINT "inbox_message_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "recalc_admin"."inbox_thread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_message"
ADD CONSTRAINT "inbox_message_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
