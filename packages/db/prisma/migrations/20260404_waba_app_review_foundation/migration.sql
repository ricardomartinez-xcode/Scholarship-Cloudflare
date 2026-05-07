ALTER TABLE "recalc_admin"."user_contact"
  ADD COLUMN IF NOT EXISTS "waId" TEXT,
  ADD COLUMN IF NOT EXISTS "bsuid" TEXT,
  ADD COLUMN IF NOT EXISTS "parentBsuid" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappUsername" TEXT,
  ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "profileSource" TEXT,
  ADD COLUMN IF NOT EXISTS "lastProfileSyncAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastIdentitySyncAt" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_owner_waid_key"
ON "recalc_admin"."user_contact"("ownerUserId", "waId");

CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_owner_bsuid_key"
ON "recalc_admin"."user_contact"("ownerUserId", "bsuid");

CREATE INDEX IF NOT EXISTS "user_contact_owner_identity_sync_idx"
ON "recalc_admin"."user_contact"("ownerUserId", "lastIdentitySyncAt");

ALTER TABLE "recalc_admin"."user_meta_whatsapp_connection"
  ADD COLUMN IF NOT EXISTS "graphApiVersion" TEXT NOT NULL DEFAULT 'v25.0',
  ADD COLUMN IF NOT EXISTS "businessManagerId" TEXT,
  ADD COLUMN IF NOT EXISTS "businessName" TEXT,
  ADD COLUMN IF NOT EXISTS "wabaName" TEXT,
  ADD COLUMN IF NOT EXISTS "wabaCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "wabaTimezoneId" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneDisplayNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerifiedName" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneQualityRating" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneCodeVerificationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastAssetSyncAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastTemplateSyncAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastWebhookAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "grantedScopes" JSONB,
  ADD COLUMN IF NOT EXISTS "accountReviewSnapshot" JSONB;

CREATE TABLE IF NOT EXISTS "recalc_admin"."meta_whatsapp_message" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "connectionId" UUID,
  "contactId" UUID,
  "metaMessageId" TEXT,
  "direction" TEXT NOT NULL,
  "messageType" TEXT NOT NULL,
  "templateName" TEXT,
  "templateLanguage" TEXT,
  "textBody" TEXT,
  "mediaId" TEXT,
  "mediaMimeType" TEXT,
  "mediaSha256" TEXT,
  "mediaCaption" TEXT,
  "externalStatus" TEXT,
  "conversationId" TEXT,
  "pricingCategory" TEXT,
  "errorCode" TEXT,
  "errorTitle" TEXT,
  "errorMessage" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "readAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_whatsapp_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_message_owner_meta_message_key"
ON "recalc_admin"."meta_whatsapp_message"("ownerUserId", "metaMessageId");

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_owner_created_idx"
ON "recalc_admin"."meta_whatsapp_message"("ownerUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_connection_created_idx"
ON "recalc_admin"."meta_whatsapp_message"("connectionId", "createdAt");

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_contact_created_idx"
ON "recalc_admin"."meta_whatsapp_message"("contactId", "createdAt");

CREATE TABLE IF NOT EXISTS "recalc_admin"."meta_whatsapp_message_event" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "connectionId" UUID,
  "contactId" UUID,
  "messageId" UUID,
  "metaMessageId" TEXT,
  "eventType" TEXT NOT NULL,
  "deliveryStatus" TEXT,
  "payload" JSONB,
  "eventAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_whatsapp_message_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_event_owner_event_idx"
ON "recalc_admin"."meta_whatsapp_message_event"("ownerUserId", "eventAt");

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_event_connection_event_idx"
ON "recalc_admin"."meta_whatsapp_message_event"("connectionId", "eventAt");

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_event_contact_event_idx"
ON "recalc_admin"."meta_whatsapp_message_event"("contactId", "eventAt");

CREATE INDEX IF NOT EXISTS "meta_whatsapp_message_event_meta_message_idx"
ON "recalc_admin"."meta_whatsapp_message_event"("metaMessageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message"
      ADD CONSTRAINT "meta_whatsapp_message_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_connectionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message"
      ADD CONSTRAINT "meta_whatsapp_message_connectionId_fkey"
      FOREIGN KEY ("connectionId") REFERENCES "recalc_admin"."user_meta_whatsapp_connection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_contactId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message"
      ADD CONSTRAINT "meta_whatsapp_message_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "recalc_admin"."user_contact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_event_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message_event"
      ADD CONSTRAINT "meta_whatsapp_message_event_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_event_connectionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message_event"
      ADD CONSTRAINT "meta_whatsapp_message_event_connectionId_fkey"
      FOREIGN KEY ("connectionId") REFERENCES "recalc_admin"."user_meta_whatsapp_connection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_event_contactId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message_event"
      ADD CONSTRAINT "meta_whatsapp_message_event_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "recalc_admin"."user_contact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_whatsapp_message_event_messageId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_whatsapp_message_event"
      ADD CONSTRAINT "meta_whatsapp_message_event_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "recalc_admin"."meta_whatsapp_message"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
