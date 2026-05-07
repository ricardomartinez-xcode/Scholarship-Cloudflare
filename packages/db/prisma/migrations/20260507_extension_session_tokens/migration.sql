CREATE TABLE IF NOT EXISTS "recalc_admin"."extension_session_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'extension:default',
    "client" TEXT,
    "extensionVersion" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "extension_session_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "extension_session_token_tokenHash_key"
    ON "recalc_admin"."extension_session_token"("tokenHash");

CREATE INDEX IF NOT EXISTS "extension_session_token_user_valid_idx"
    ON "recalc_admin"."extension_session_token"("userId", "revokedAt", "expiresAt");

CREATE INDEX IF NOT EXISTS "extension_session_token_expires_idx"
    ON "recalc_admin"."extension_session_token"("expiresAt");

ALTER TABLE "recalc_admin"."extension_session_token"
    ADD CONSTRAINT "extension_session_token_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
