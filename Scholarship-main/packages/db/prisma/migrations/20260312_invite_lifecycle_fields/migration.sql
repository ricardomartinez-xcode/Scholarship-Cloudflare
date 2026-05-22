-- Migration: invite_lifecycle_fields
-- Adds explicit lifecycle tracking columns to the invite table.
--
-- cancelledAt  : populated when an admin explicitly cancels an invitation;
--                replaces the previous implicit hack of setting expiresAt = createdAt.
-- cancelledById: the admin user who cancelled the invitation (nullable FK).
-- lastSentAt   : timestamp of the last time this invitation email was sent/resent.
-- resentCount  : number of times the invitation has been resent.
--
-- All columns are optional / nullable so existing rows remain valid.

ALTER TABLE "recalc_admin"."invite"
  ADD COLUMN IF NOT EXISTS "cancelledAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledById" UUID,
  ADD COLUMN IF NOT EXISTS "lastSentAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resentCount"   INTEGER NOT NULL DEFAULT 0;

-- FK: cancelledById → user.id  (SET NULL on user delete to avoid orphaned references)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invite_cancelledById_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."invite"
      ADD CONSTRAINT "invite_cancelledById_fkey"
      FOREIGN KEY ("cancelledById")
      REFERENCES "recalc_admin"."user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index to speed up queries that filter by cancelled status
CREATE INDEX IF NOT EXISTS "invite_cancelled_idx"
  ON "recalc_admin"."invite"("cancelledAt")
  WHERE "cancelledAt" IS NOT NULL;
