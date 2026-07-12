import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { createFileAsset } from "@/lib/file-assets";
import {
  createStorageObjectKey,
  getMaxUploadBytes,
  getStorageBucketName,
  isAllowedFileMimeType,
} from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PresignPayload = {
  fileName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
};

function parsePayload(payload: PresignPayload) {
  const fileName = String(payload.fileName ?? "").trim();
  const mimeType = String(payload.mimeType ?? "").trim();
  const sizeNumber = Number(payload.sizeBytes ?? 0);
  const sizeBytes = Number.isFinite(sizeNumber) && sizeNumber > 0 ? Math.trunc(sizeNumber) : null;

  if (!fileName) return { ok: false as const, error: "Nombre de archivo requerido." };
  if (!mimeType) return { ok: false as const, error: "MIME type requerido." };
  if (!isAllowedFileMimeType(mimeType)) {
    return { ok: false as const, error: "Tipo de archivo no permitido." };
  }
  if (sizeBytes === null || sizeBytes > getMaxUploadBytes()) {
    return { ok: false as const, error: "Tamaño de archivo inválido." };
  }

  return { ok: true as const, fileName, mimeType, sizeBytes };
}

export async function POST(request: Request) {
  const auth = await requireAdminApiCapability("files-presigned-upload", [
    AdminCapability.manage_offers,
    AdminCapability.manage_ctas,
  ]);
  if (!auth.ok) return auth.response;

  const parsed = parsePayload((await request.json()) as PresignPayload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const key = createStorageObjectKey(parsed.fileName, {
    userId: auth.admin.id,
    prefix: "documents",
    resourceId: "admin-files",
  });
  const asset = await createFileAsset({
    r2Key: key,
    bucket: getStorageBucketName(),
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    uploadedByUserId: auth.admin.id,
    status: "pending",
  });

  return NextResponse.json({
    ok: true,
    asset,
    uploadUrl: new URL(`/api/files/${asset.id}/upload`, request.url).toString(),
    uploadHeaders: {
      "Content-Type": parsed.mimeType,
    },
  });
}
