import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getR2BucketName } from "@/lib/r2-storage";

export type FileAsset = {
  id: string;
  ownerUserId: string | null;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  title: string | null;
  description: string | null;
  visibility: "private" | "link" | "public";
  createdAt: Date;
  updatedAt: Date;
};

export type FileAssetUsage = {
  id: string;
  fileId: string;
  targetType: string;
  targetId: string;
  slot: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type FileAssetRow = {
  id: string;
  owner_user_id: string | null;
  bucket: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  title: string | null;
  description: string | null;
  visibility: "private" | "link" | "public";
  created_at: Date;
  updated_at: Date;
};

type FileAssetUsageRow = {
  id: string;
  file_id: string;
  target_type: string;
  target_id: string;
  slot: string;
  sort_order: number;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
};

export type FileAssetUsageInput = {
  targetType: string;
  targetId: string;
  slot: string;
  sortOrder?: number;
  isPrimary?: boolean;
};

function mapFileAsset(row: FileAssetRow): FileAsset {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    bucket: row.bucket,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFileAssetUsage(row: FileAssetUsageRow): FileAssetUsage {
  return {
    id: row.id,
    fileId: row.file_id,
    targetType: row.target_type,
    targetId: row.target_id,
    slot: row.slot,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeUsage(input: FileAssetUsageInput) {
  const targetType = input.targetType.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const targetId = input.targetId.trim();
  const slot = input.slot.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!targetType || !targetId || !slot) return null;
  return {
    targetType,
    targetId,
    slot,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    isPrimary: input.isPrimary ?? true,
  };
}

export async function createFileAsset(input: {
  ownerUserId: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  title?: string | null;
  description?: string | null;
  visibility?: "private" | "link" | "public";
}) {
  const rows = await prisma.$queryRaw<FileAssetRow[]>`
    INSERT INTO "recalc_admin"."file_asset" (
      "owner_user_id", "bucket", "object_key", "file_name", "mime_type", "size_bytes", "title", "description", "visibility"
    ) VALUES (
      ${input.ownerUserId}::uuid,
      ${getR2BucketName()},
      ${input.objectKey},
      ${input.fileName},
      ${input.mimeType},
      ${input.sizeBytes},
      ${input.title ?? null},
      ${input.description ?? null},
      ${input.visibility ?? "private"}
    )
    RETURNING *;
  `;
  return mapFileAsset(rows[0]);
}

export async function listFileAssets(limit = 50) {
  const rows = await prisma.$queryRaw<FileAssetRow[]>`
    SELECT * FROM "recalc_admin"."file_asset"
    ORDER BY "created_at" DESC
    LIMIT ${Math.min(Math.max(limit, 1), 100)};
  `;
  return rows.map(mapFileAsset);
}

export async function getFileAssetById(id: string) {
  const rows = await prisma.$queryRaw<FileAssetRow[]>`
    SELECT * FROM "recalc_admin"."file_asset"
    WHERE "id" = ${id}::uuid
    LIMIT 1;
  `;
  return rows[0] ? mapFileAsset(rows[0]) : null;
}

export async function assignFileAssetUsage(fileId: string, input: FileAssetUsageInput) {
  const usage = normalizeUsage(input);
  if (!usage) return null;

  const rows = await prisma.$queryRaw<FileAssetUsageRow[]>`
    INSERT INTO "recalc_admin"."file_asset_usage" (
      "file_id", "target_type", "target_id", "slot", "sort_order", "is_primary"
    ) VALUES (
      ${fileId}::uuid,
      ${usage.targetType},
      ${usage.targetId},
      ${usage.slot},
      ${usage.sortOrder},
      ${usage.isPrimary}
    )
    ON CONFLICT ("target_type", "target_id", "slot") WHERE "is_primary" = true
    DO UPDATE SET
      "file_id" = EXCLUDED."file_id",
      "sort_order" = EXCLUDED."sort_order",
      "updated_at" = now()
    RETURNING *;
  `;
  return rows[0] ? mapFileAssetUsage(rows[0]) : null;
}

export async function listFileAssetUsages(fileId: string) {
  const rows = await prisma.$queryRaw<FileAssetUsageRow[]>`
    SELECT * FROM "recalc_admin"."file_asset_usage"
    WHERE "file_id" = ${fileId}::uuid
    ORDER BY "target_type" ASC, "target_id" ASC, "slot" ASC, "sort_order" ASC;
  `;
  return rows.map(mapFileAssetUsage);
}

export async function getFileAssetForUsage(input: Pick<FileAssetUsageInput, "targetType" | "targetId" | "slot">) {
  const usage = normalizeUsage({ ...input, isPrimary: true });
  if (!usage) return null;

  const rows = await prisma.$queryRaw<FileAssetRow[]>`
    SELECT fa.*
    FROM "recalc_admin"."file_asset" fa
    INNER JOIN "recalc_admin"."file_asset_usage" fau ON fau."file_id" = fa."id"
    WHERE fau."target_type" = ${usage.targetType}
      AND fau."target_id" = ${usage.targetId}
      AND fau."slot" = ${usage.slot}
      AND fau."is_primary" = true
    ORDER BY fau."sort_order" ASC, fau."created_at" DESC
    LIMIT 1;
  `;
  return rows[0] ? mapFileAsset(rows[0]) : null;
}

export async function createShareLink(fileId: string, expiresAt?: Date | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashShareToken(token);
  await prisma.$executeRaw`
    INSERT INTO "recalc_admin"."file_share_link" ("file_id", "token_hash", "expires_at")
    VALUES (${fileId}::uuid, ${tokenHash}, ${expiresAt ?? null});
  `;
  await prisma.$executeRaw`
    UPDATE "recalc_admin"."file_asset"
    SET "visibility" = 'link', "updated_at" = now()
    WHERE "id" = ${fileId}::uuid;
  `;
  return token;
}

export async function getFileAssetByShareToken(token: string) {
  const rows = await prisma.$queryRaw<FileAssetRow[]>`
    SELECT fa.*
    FROM "recalc_admin"."file_asset" fa
    INNER JOIN "recalc_admin"."file_share_link" sl ON sl."file_id" = fa."id"
    WHERE sl."token_hash" = ${hashShareToken(token)}
      AND (sl."expires_at" IS NULL OR sl."expires_at" > now())
    LIMIT 1;
  `;
  return rows[0] ? mapFileAsset(rows[0]) : null;
}

export function hashShareToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
