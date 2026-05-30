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
