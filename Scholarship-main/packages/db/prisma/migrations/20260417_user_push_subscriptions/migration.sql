CREATE TABLE "recalc_admin"."user_push_subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3),
    "publicKey" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_push_subscription_endpoint_key"
ON "recalc_admin"."user_push_subscription"("endpoint");

CREATE INDEX "user_push_subscription_user_updated_idx"
ON "recalc_admin"."user_push_subscription"("userId", "updatedAt");

ALTER TABLE "recalc_admin"."user_push_subscription"
ADD CONSTRAINT "user_push_subscription_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "recalc_admin"."user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
