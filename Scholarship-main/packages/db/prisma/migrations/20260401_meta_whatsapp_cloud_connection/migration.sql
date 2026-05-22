CREATE TABLE IF NOT EXISTS "recalc_admin"."user_meta_whatsapp_connection" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'meta_whatsapp',
  "encryptedMetaAccessToken" TEXT,
  "encryptedSystemUserToken" TEXT,
  "wabaId" TEXT,
  "phoneNumberId" TEXT,
  "businessAccountId" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_meta_whatsapp_connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_meta_whatsapp_connection_userId_key"
ON "recalc_admin"."user_meta_whatsapp_connection"("userId");

CREATE INDEX IF NOT EXISTS "user_meta_whatsapp_connection_status_updated_idx"
ON "recalc_admin"."user_meta_whatsapp_connection"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "user_meta_whatsapp_connection_waba_idx"
ON "recalc_admin"."user_meta_whatsapp_connection"("wabaId");

CREATE INDEX IF NOT EXISTS "user_meta_whatsapp_connection_phone_idx"
ON "recalc_admin"."user_meta_whatsapp_connection"("phoneNumberId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_meta_whatsapp_connection_userId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."user_meta_whatsapp_connection"
      ADD CONSTRAINT "user_meta_whatsapp_connection_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
