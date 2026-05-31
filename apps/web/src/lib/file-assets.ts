import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type FileAssetSlot = "study_plan_pdf" | "brochure_pdf" | "hero_image";

export type FileAssetRecord = {
  id: string;
  r2Key: string;
  bucket: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  etag: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FileAssetUsageRecord = {
  id: string;
  fileId: string;
  targetType: string;
  targetId: string;
  slot: string;
  sortOrder: number;
  isPrimary: boolean;
  file: FileAssetRecord;
};

export type PublicFileAssetPayload = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  previewUrl: string;
  downloadUrl: string;
};

export type ProgramAssetInput = PublicFileAssetPayload | {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
};

export type ProgramAssetSlots = Partial<Record<FileAssetSlot, ProgramAssetInput | null>>;

type RawFileAssetRow = {
  id: string;
  r2Key: string;
  bucket: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint | number | null;
  etag: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type RawFileAssetUsageRow = RawFileAssetRow & {
  usageId: string;
  fileId: string;
  targetType: string;
  targetId: string;
  slot: string;
  sortOrder: number;
  isPrimary: boolean;
};

function toNumber(value: bigint | number | null) {
  if (value === null) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

function mapFileAsset(row: RawFileAssetRow): FileAssetRecord {
  return {
    id: row.id,
    r2Key: row.r2Key,
    bucket: row.bucket,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: toNumber(row.sizeBytes),
    etag: row.etag,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapUsage(row: RawFileAssetUsageRow): FileAssetUsageRecord {
  return {
    id: row.usageId,
    fileId: row.fileId,
    targetType: row.targetType,
    targetId: row.targetId,
    slot: row.slot,
    sortOrder: row.sortOrder,
    isPrimary: row.isPrimary,
    file: mapFileAsset(row),
  };
}

export function normalizeFileAssetUsageKey(input: {
  targetType: string;
  targetId: string;
  slot: string;
}) {
  return {
    targetType: normalizeSnakeish(input.targetType),
    targetId: input.targetId,
    slot: normalizeSnakeish(input.slot),
  };
}

function normalizeSnakeish(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildFileAssetLinks(fileId: string) {
  return {
    previewUrl: `/api/files/${encodeURIComponent(fileId)}/auth-view`,
    downloadUrl: `/api/files/${encodeURIComponent(fileId)}/download`,
  };
}

export function toPublicFileAssetPayload(
  file: Pick<FileAssetRecord, "id" | "fileName" | "mimeType" | "sizeBytes"> | null | undefined,
): PublicFileAssetPayload | null {
  if (!file) return null;
  return {
    fileId: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    ...buildFileAssetLinks(file.id),
  };
}

export function resolveProgramR2AssetPayload(input: {
  programId: string;
  planPdfUrl: string | null;
  brochurePdfUrl: string | null;
  assets: ProgramAssetSlots;
}) {
  const studyPlan = normalizeProgramAssetPayload(input.assets.study_plan_pdf);
  const brochure = normalizeProgramAssetPayload(input.assets.brochure_pdf);
  const heroImage = normalizeProgramAssetPayload(input.assets.hero_image);

  return {
    planPdfUrl: studyPlan?.previewUrl ?? input.planPdfUrl,
    brochurePdfUrl: brochure?.previewUrl ?? input.brochurePdfUrl,
    heroImageUrl: heroImage?.previewUrl ?? null,
    planDownloadUrl: studyPlan?.downloadUrl ?? input.planPdfUrl,
    brochureDownloadUrl: brochure?.downloadUrl ?? input.brochurePdfUrl,
    r2Assets: {
      studyPlan,
      brochure,
      heroImage,
    },
  };
}

function normalizeProgramAssetPayload(
  asset: ProgramAssetInput | null | undefined,
): PublicFileAssetPayload | null {
  if (!asset) return null;
  if ("previewUrl" in asset && "downloadUrl" in asset) return asset;
  const links = buildFileAssetLinks(asset.fileId);
  return {
    ...asset,
    ...links,
  };
}

export async function createFileAsset(input: {
  r2Key: string;
  bucket?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
  uploadedByUserId?: string | null;
  status?: string;
}) {
  const rows = await prisma.$queryRaw<RawFileAssetRow[]>`
    INSERT INTO "recalc_admin"."file_asset"
      ("r2_key", "bucket", "file_name", "mime_type", "size_bytes", "uploaded_by_user_id", "status")
    VALUES
      (${input.r2Key}, ${input.bucket ?? null}, ${input.fileName}, ${input.mimeType}, ${input.sizeBytes ?? null}, ${input.uploadedByUserId ?? null}::uuid, ${input.status ?? "uploaded"})
    RETURNING
      "id",
      "r2_key" AS "r2Key",
      "bucket",
      "file_name" AS "fileName",
      "mime_type" AS "mimeType",
      "size_bytes" AS "sizeBytes",
      "etag",
      "status",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;
  return mapFileAsset(rows[0]);
}

export async function markFileAssetUploaded(fileId: string, etag?: string | null) {
  const rows = await prisma.$queryRaw<RawFileAssetRow[]>`
    UPDATE "recalc_admin"."file_asset"
    SET "status" = 'uploaded',
        "etag" = COALESCE(${etag ?? null}, "etag"),
        "updated_at" = now()
    WHERE "id" = ${fileId}::uuid
    RETURNING
      "id",
      "r2_key" AS "r2Key",
      "bucket",
      "file_name" AS "fileName",
      "mime_type" AS "mimeType",
      "size_bytes" AS "sizeBytes",
      "etag",
      "status",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;
  return rows[0] ? mapFileAsset(rows[0]) : null;
}

export async function getFileAssetById(fileId: string) {
  const rows = await prisma.$queryRaw<RawFileAssetRow[]>`
    SELECT
      "id",
      "r2_key" AS "r2Key",
      "bucket",
      "file_name" AS "fileName",
      "mime_type" AS "mimeType",
      "size_bytes" AS "sizeBytes",
      "etag",
      "status",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "recalc_admin"."file_asset"
    WHERE "id" = ${fileId}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapFileAsset(rows[0]) : null;
}

export async function listFileAssets(options?: {
  mimePrefix?: string;
  mimeType?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 1000);
  const rows = await prisma.$queryRaw<RawFileAssetRow[]>`
    SELECT
      "id",
      "r2_key" AS "r2Key",
      "bucket",
      "file_name" AS "fileName",
      "mime_type" AS "mimeType",
      "size_bytes" AS "sizeBytes",
      "etag",
      "status",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "recalc_admin"."file_asset"
    WHERE (${options?.mimeType ?? null}::text IS NULL OR "mime_type" = ${options?.mimeType ?? null})
      AND (${options?.mimePrefix ?? null}::text IS NULL OR "mime_type" LIKE ${options?.mimePrefix ? `${options.mimePrefix}%` : null})
    ORDER BY "created_at" DESC
    LIMIT ${limit}
  `;
  return rows.map(mapFileAsset);
}

export async function clearFileAssetUsage(input: {
  targetType: string;
  targetId: string;
  slot: string;
}) {
  const key = normalizeFileAssetUsageKey(input);
  await prisma.$executeRaw`
    DELETE FROM "recalc_admin"."file_asset_usage"
    WHERE "target_type" = ${key.targetType}
      AND "target_id" = ${key.targetId}
      AND "slot" = ${key.slot}
  `;
}

export async function assignFileAssetUsage(
  fileId: string,
  input: {
    targetType: string;
    targetId: string;
    slot: string;
    isPrimary?: boolean;
    sortOrder?: number;
  },
) {
  const key = normalizeFileAssetUsageKey(input);
  const isPrimary = input.isPrimary ?? true;
  const sortOrder = input.sortOrder ?? 0;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "recalc_admin"."file_asset_usage"
      WHERE "target_type" = ${key.targetType}
        AND "target_id" = ${key.targetId}
        AND "slot" = ${key.slot}
    `;

    const rows = await tx.$queryRaw<RawFileAssetUsageRow[]>`
      INSERT INTO "recalc_admin"."file_asset_usage"
        ("file_id", "target_type", "target_id", "slot", "sort_order", "is_primary")
      VALUES
        (${fileId}::uuid, ${key.targetType}, ${key.targetId}, ${key.slot}, ${sortOrder}, ${isPrimary})
      RETURNING
        "id" AS "usageId",
        "file_id" AS "fileId",
        "target_type" AS "targetType",
        "target_id" AS "targetId",
        "slot",
        "sort_order" AS "sortOrder",
        "is_primary" AS "isPrimary",
        (SELECT "id" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "id",
        (SELECT "r2_key" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "r2Key",
        (SELECT "bucket" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "bucket",
        (SELECT "file_name" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "fileName",
        (SELECT "mime_type" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "mimeType",
        (SELECT "size_bytes" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "sizeBytes",
        (SELECT "etag" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "etag",
        (SELECT "status" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "status",
        (SELECT "created_at" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "createdAt",
        (SELECT "updated_at" FROM "recalc_admin"."file_asset" WHERE "id" = ${fileId}::uuid) AS "updatedAt"
    `;

    return mapUsage(rows[0]);
  });
}

export async function getFileAssetForUsage(input: {
  targetType: string;
  targetId: string;
  slot: string;
}) {
  const key = normalizeFileAssetUsageKey(input);
  const rows = await prisma.$queryRaw<RawFileAssetUsageRow[]>`
    SELECT
      u."id" AS "usageId",
      u."file_id" AS "fileId",
      u."target_type" AS "targetType",
      u."target_id" AS "targetId",
      u."slot",
      u."sort_order" AS "sortOrder",
      u."is_primary" AS "isPrimary",
      f."id",
      f."r2_key" AS "r2Key",
      f."bucket",
      f."file_name" AS "fileName",
      f."mime_type" AS "mimeType",
      f."size_bytes" AS "sizeBytes",
      f."etag",
      f."status",
      f."created_at" AS "createdAt",
      f."updated_at" AS "updatedAt"
    FROM "recalc_admin"."file_asset_usage" u
    INNER JOIN "recalc_admin"."file_asset" f ON f."id" = u."file_id"
    WHERE u."target_type" = ${key.targetType}
      AND u."target_id" = ${key.targetId}
      AND u."slot" = ${key.slot}
    ORDER BY u."is_primary" DESC, u."sort_order" ASC, u."created_at" DESC
    LIMIT 1
  `;
  return rows[0] ? mapUsage(rows[0]) : null;
}

export async function listFileAssetAssignmentsForTargets(
  targetType: string,
  targetIds: string[],
) {
  const normalizedTargetType = normalizeSnakeish(targetType);
  const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)));
  if (!uniqueTargetIds.length) return new Map<string, Record<string, PublicFileAssetPayload>>();
  if (typeof prisma.$queryRaw !== "function") {
    return new Map<string, Record<string, PublicFileAssetPayload>>();
  }

  const rows = await prisma.$queryRaw<RawFileAssetUsageRow[]>`
    SELECT
      u."id" AS "usageId",
      u."file_id" AS "fileId",
      u."target_type" AS "targetType",
      u."target_id" AS "targetId",
      u."slot",
      u."sort_order" AS "sortOrder",
      u."is_primary" AS "isPrimary",
      f."id",
      f."r2_key" AS "r2Key",
      f."bucket",
      f."file_name" AS "fileName",
      f."mime_type" AS "mimeType",
      f."size_bytes" AS "sizeBytes",
      f."etag",
      f."status",
      f."created_at" AS "createdAt",
      f."updated_at" AS "updatedAt"
    FROM "recalc_admin"."file_asset_usage" u
    INNER JOIN "recalc_admin"."file_asset" f ON f."id" = u."file_id"
    WHERE u."target_type" = ${normalizedTargetType}
      AND u."target_id" IN (${Prisma.join(uniqueTargetIds)})
      AND u."is_primary" = true
    ORDER BY u."target_id" ASC, u."slot" ASC, u."sort_order" ASC
  `;

  const byTarget = new Map<string, Record<string, PublicFileAssetPayload>>();
  for (const usage of rows.map(mapUsage)) {
    const targetAssets = byTarget.get(usage.targetId) ?? {};
    if (!targetAssets[usage.slot]) {
      targetAssets[usage.slot] = toPublicFileAssetPayload(usage.file) as PublicFileAssetPayload;
    }
    byTarget.set(usage.targetId, targetAssets);
  }

  return byTarget;
}
