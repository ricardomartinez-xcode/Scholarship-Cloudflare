CREATE TABLE "recalc_admin"."user_contact" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "email" TEXT,
    "tags" JSONB,
    "personalData" TEXT,
    "notes" TEXT,
    "lastWhatsappMessageAt" TIMESTAMP(3),
    "lastWhatsappMessageText" TEXT,
    "campaignMessageCount" INTEGER NOT NULL DEFAULT 0,
    "assignedQuoteSessionPublicId" TEXT,
    "assignedScenarioId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sheetSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_contact_owner_phone_key"
ON "recalc_admin"."user_contact"("ownerUserId", "normalizedPhone");

CREATE INDEX "user_contact_owner_updated_idx"
ON "recalc_admin"."user_contact"("ownerUserId", "updatedAt" DESC);

CREATE INDEX "user_contact_owner_session_idx"
ON "recalc_admin"."user_contact"("ownerUserId", "assignedQuoteSessionPublicId");

ALTER TABLE "recalc_admin"."user_contact"
ADD CONSTRAINT "user_contact_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId")
REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
