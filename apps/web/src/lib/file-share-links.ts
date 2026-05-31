import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { FileAssetRecord } from "@/lib/file-assets";

type ShareFileAssetRow = {
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

export type SharedFileAsset = FileAssetRecord & {
  title: string | null;
  objectKey: string;
};

function toNumber(value: bigint | number | null) {
  if (value === null) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

function hashShareToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function mapSharedFileAsset(row: ShareFileAssetRow): SharedFileAsset {
  return {
    id: row.id,
    r2Key: row.r2Key,
    objectKey: row.r2Key,
    bucket: row.bucket,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: toNumber(row.sizeBytes),
    etag: row.etag,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    title: null,
  };
}

export async function createShareLink(fileId: string, expiresAt?: Date | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$executeRaw`
    INSERT INTO "recalc_admin"."file_share_link" ("file_id", "token_hash", "expires_at")
    VALUES (${fileId}::uuid, ${hashShareToken(token)}, ${expiresAt ?? null});
  `;
  return token;
}

export async function getFileAssetByShareToken(token: string) {
  const rows = await prisma.$queryRaw<ShareFileAssetRow[]>`
    SELECT
      fa."id",
      fa."object_key" AS "r2Key",
      fa."bucket",
      fa."file_name" AS "fileName",
      fa."mime_type" AS "mimeType",
      fa."size_bytes" AS "sizeBytes",
      NULL::text AS "etag",
      'uploaded'::text AS "status",
      fa."created_at" AS "createdAt",
      fa."updated_at" AS "updatedAt"
    FROM "recalc_admin"."file_share_link" sl
    INNER JOIN "recalc_admin"."file_asset" fa ON fa."id" = sl."file_id"
    WHERE sl."token_hash" = ${hashShareToken(token)}
      AND (sl."expires_at" IS NULL OR sl."expires_at" > now())
    LIMIT 1;
  `;
  return rows[0] ? mapSharedFileAsset(rows[0]) : null;
}
