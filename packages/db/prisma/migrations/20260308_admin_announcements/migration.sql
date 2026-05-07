CREATE TYPE "recalc_admin"."AdminAnnouncementDisplay" AS ENUM ('banner', 'popout');

CREATE TABLE "recalc_admin"."admin_announcement" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "display" "recalc_admin"."AdminAnnouncementDisplay" NOT NULL DEFAULT 'banner',
  "location" "recalc_admin"."AdminPublicCtaLocation" NOT NULL DEFAULT 'HOME_PRIMARY',
  "organizationId" UUID,
  "onlyNewUsers" BOOLEAN NOT NULL DEFAULT false,
  "url" TEXT,
  "buttonLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "variant" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_announcement_location_sortOrder_idx"
ON "recalc_admin"."admin_announcement"("location", "sortOrder");

CREATE INDEX "admin_announcement_organization_idx"
ON "recalc_admin"."admin_announcement"("organizationId");

ALTER TABLE "recalc_admin"."admin_announcement"
ADD CONSTRAINT "admin_announcement_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
