CREATE TABLE IF NOT EXISTS "recalc_admin"."enrollment_format" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileName" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileMimeType" TEXT,
  "fileSizeBytes" INTEGER,
  "sourceType" TEXT NOT NULL DEFAULT 'link',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enrollment_format_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "enrollment_format_active_sort_idx"
  ON "recalc_admin"."enrollment_format"("isActive", "sortOrder");
