CREATE TABLE IF NOT EXISTS "recalc_admin"."meta_embedded_signup_session" (
  "id" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "connectionId" UUID,
  "clientSessionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'started',
  "flowType" TEXT,
  "appId" TEXT,
  "configId" TEXT,
  "sessionInfoVersion" INTEGER,
  "graphApiVersion" TEXT DEFAULT 'v25.0',
  "facebookUserId" TEXT,
  "facebookLoginStatus" TEXT,
  "encryptedAuthorizationCode" TEXT,
  "authorizationCodeReceivedAt" TIMESTAMPTZ,
  "wabaId" TEXT,
  "phoneNumberId" TEXT,
  "businessAccountId" TEXT,
  "cancelRedirectUrl" TEXT,
  "dataDeletionRequestUrl" TEXT,
  "dataDeletionCallbackUrl" TEXT,
  "errorMessage" TEXT,
  "payload" JSONB,
  "finishedAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "exchangedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_embedded_signup_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_embedded_signup_session_client_session_key"
ON "recalc_admin"."meta_embedded_signup_session"("clientSessionId");

CREATE INDEX IF NOT EXISTS "meta_embedded_signup_session_owner_created_idx"
ON "recalc_admin"."meta_embedded_signup_session"("ownerUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "meta_embedded_signup_session_connection_created_idx"
ON "recalc_admin"."meta_embedded_signup_session"("connectionId", "createdAt");

CREATE INDEX IF NOT EXISTS "meta_embedded_signup_session_owner_status_updated_idx"
ON "recalc_admin"."meta_embedded_signup_session"("ownerUserId", "status", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_embedded_signup_session_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_embedded_signup_session"
      ADD CONSTRAINT "meta_embedded_signup_session_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_embedded_signup_session_connectionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."meta_embedded_signup_session"
      ADD CONSTRAINT "meta_embedded_signup_session_connectionId_fkey"
      FOREIGN KEY ("connectionId") REFERENCES "recalc_admin"."user_meta_whatsapp_connection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
