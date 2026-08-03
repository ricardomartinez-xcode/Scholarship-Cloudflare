CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_analytics_installation" (
  "id" UUID NOT NULL,
  "nameId" TEXT NOT NULL,
  "proofHash" TEXT NOT NULL,
  "extensionVersion" TEXT,
  "clientMeta" JSONB,
  "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_analytics_installation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extension_analytics_installation_name_seen_idx"
  ON "recalc_admin"."extension_analytics_installation"("nameId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "extension_analytics_installation_seen_idx"
  ON "recalc_admin"."extension_analytics_installation"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_analytics_campaign" (
  "id" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "nameId" TEXT NOT NULL,
  "campaignName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "messageTemplate" TEXT,
  "scheduleAt" TIMESTAMPTZ,
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "batchSize" INTEGER NOT NULL DEFAULT 25,
  "messageDelayMs" INTEGER NOT NULL DEFAULT 4000,
  "batchDelayMs" INTEGER NOT NULL DEFAULT 30000,
  "jitterMs" INTEGER NOT NULL DEFAULT 3000,
  "hasMedia" BOOLEAN NOT NULL DEFAULT false,
  "mediaType" TEXT,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "invalidCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostMxn" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "country" JSONB,
  "settings" JSONB,
  "meta" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_analytics_campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extension_analytics_campaign_installation_updated_idx"
  ON "recalc_admin"."extension_analytics_campaign"("installationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "extension_analytics_campaign_name_updated_idx"
  ON "recalc_admin"."extension_analytics_campaign"("nameId", "updatedAt");
CREATE INDEX IF NOT EXISTS "extension_analytics_campaign_status_updated_idx"
  ON "recalc_admin"."extension_analytics_campaign"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_analytics_recipient" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "nameId" TEXT NOT NULL,
  "contactValue" TEXT NOT NULL,
  "contactName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "resolvedMessage" TEXT,
  "attemptedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_analytics_recipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "extension_analytics_recipient_campaign_contact_key"
  ON "recalc_admin"."extension_analytics_recipient"("campaignId", "contactValue");
CREATE INDEX IF NOT EXISTS "extension_analytics_recipient_campaign_status_idx"
  ON "recalc_admin"."extension_analytics_recipient"("campaignId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "extension_analytics_recipient_name_status_idx"
  ON "recalc_admin"."extension_analytics_recipient"("nameId", "status", "updatedAt");

CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_analytics_event" (
  "id" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "campaignId" UUID,
  "recipientId" UUID,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_analytics_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extension_analytics_event_installation_occurred_idx"
  ON "recalc_admin"."extension_analytics_event"("installationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "extension_analytics_event_campaign_occurred_idx"
  ON "recalc_admin"."extension_analytics_event"("campaignId", "occurredAt");
CREATE INDEX IF NOT EXISTS "extension_analytics_event_type_occurred_idx"
  ON "recalc_admin"."extension_analytics_event"("eventType", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extension_analytics_campaign_installationId_fkey') THEN
    ALTER TABLE "recalc_admin"."extension_analytics_campaign"
      ADD CONSTRAINT "extension_analytics_campaign_installationId_fkey"
      FOREIGN KEY ("installationId") REFERENCES "recalc_admin"."extension_analytics_installation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extension_analytics_recipient_campaignId_fkey') THEN
    ALTER TABLE "recalc_admin"."extension_analytics_recipient"
      ADD CONSTRAINT "extension_analytics_recipient_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "recalc_admin"."extension_analytics_campaign"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extension_analytics_recipient_installationId_fkey') THEN
    ALTER TABLE "recalc_admin"."extension_analytics_recipient"
      ADD CONSTRAINT "extension_analytics_recipient_installationId_fkey"
      FOREIGN KEY ("installationId") REFERENCES "recalc_admin"."extension_analytics_installation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extension_analytics_event_installationId_fkey') THEN
    ALTER TABLE "recalc_admin"."extension_analytics_event"
      ADD CONSTRAINT "extension_analytics_event_installationId_fkey"
      FOREIGN KEY ("installationId") REFERENCES "recalc_admin"."extension_analytics_installation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
