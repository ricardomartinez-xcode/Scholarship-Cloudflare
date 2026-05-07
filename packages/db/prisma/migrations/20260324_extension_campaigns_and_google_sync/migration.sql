CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_campaign" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "campaignName" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'whatsapp_web',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "scheduleAt" TIMESTAMPTZ,
  "batchSize" INTEGER NOT NULL DEFAULT 25,
  "messageTemplate" TEXT,
  "messageDelayMs" INTEGER NOT NULL DEFAULT 4000,
  "mediaUrl" TEXT,
  "notes" TEXT,
  "meta" JSONB,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extension_campaign_owner_updated_idx"
ON "recalc_admin"."extension_campaign"("ownerUserId", "updatedAt");

CREATE INDEX IF NOT EXISTS "extension_campaign_status_schedule_idx"
ON "recalc_admin"."extension_campaign"("status", "scheduleAt");

ALTER TABLE "recalc_admin"."extension_campaign"
  ADD COLUMN IF NOT EXISTS "messageTemplate" TEXT;

ALTER TABLE "recalc_admin"."extension_campaign"
  ADD COLUMN IF NOT EXISTS "messageDelayMs" INTEGER NOT NULL DEFAULT 4000;

ALTER TABLE "recalc_admin"."extension_campaign"
  ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;

CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_campaign_recipient" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "externalKey" TEXT,
  "contactValue" TEXT NOT NULL,
  "contactName" TEXT,
  "payload" JSONB,
  "scheduledFor" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attemptedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_campaign_recipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "extension_campaign_recipient_campaign_contact_key"
ON "recalc_admin"."extension_campaign_recipient"("campaignId", "contactValue");

CREATE INDEX IF NOT EXISTS "extension_campaign_recipient_claim_idx"
ON "recalc_admin"."extension_campaign_recipient"("campaignId", "status", "scheduledFor");

CREATE TABLE IF NOT EXISTS "recalc_admin"."user_google_connection" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'google',
  "encryptedAccessToken" TEXT,
  "encryptedRefreshToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "scopes" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "calendarConnected" BOOLEAN NOT NULL DEFAULT false,
  "tasksConnected" BOOLEAN NOT NULL DEFAULT false,
  "sheetsConnected" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_google_connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_google_connection_userId_key"
ON "recalc_admin"."user_google_connection"("userId");

CREATE TABLE IF NOT EXISTS "recalc_admin"."agenda_sync_preference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "googleConnectionId" UUID,
  "syncCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
  "syncTasksEnabled" BOOLEAN NOT NULL DEFAULT false,
  "syncSheetsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "calendarId" TEXT,
  "tasklistId" TEXT,
  "spreadsheetId" TEXT,
  "worksheetName" TEXT,
  "lastSyncedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agenda_sync_preference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agenda_sync_preference_userId_key"
ON "recalc_admin"."agenda_sync_preference"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "agenda_sync_preference_googleConnectionId_key"
ON "recalc_admin"."agenda_sync_preference"("googleConnectionId");

CREATE TABLE IF NOT EXISTS "recalc_admin"."agenda_external_sync" (
  "id" UUID NOT NULL,
  "agendaItemId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agenda_external_sync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agenda_external_sync_item_provider_target_key"
ON "recalc_admin"."agenda_external_sync"("agendaItemId", "provider", "targetKind");

CREATE INDEX IF NOT EXISTS "agenda_external_sync_provider_target_idx"
ON "recalc_admin"."agenda_external_sync"("provider", "targetKind", "syncedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'extension_campaign_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."extension_campaign"
      ADD CONSTRAINT "extension_campaign_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'extension_campaign_recipient_campaignId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."extension_campaign_recipient"
      ADD CONSTRAINT "extension_campaign_recipient_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "recalc_admin"."extension_campaign"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_google_connection_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."user_google_connection"
      ADD CONSTRAINT "user_google_connection_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_sync_preference_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."agenda_sync_preference"
      ADD CONSTRAINT "agenda_sync_preference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_sync_preference_googleConnectionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."agenda_sync_preference"
      ADD CONSTRAINT "agenda_sync_preference_googleConnectionId_fkey"
      FOREIGN KEY ("googleConnectionId") REFERENCES "recalc_admin"."user_google_connection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_external_sync_agendaItemId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."agenda_external_sync"
      ADD CONSTRAINT "agenda_external_sync_agendaItemId_fkey"
      FOREIGN KEY ("agendaItemId") REFERENCES "recalc_admin"."user_agenda_item"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
