import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import {
  createStorageObjectKey,
  getMaxUploadBytes,
  getStorageBucketName,
  isAllowedFileMimeType,
} from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { fileName?: string; mimeType?: string; sizeBytes?: number } | null;
  const fileName = body?.fileName?.trim();
  const mimeType = body?.mimeType?.trim();
  const sizeBytes = Number(body?.sizeBytes);
  const maxUploadBytes = getMaxUploadBytes();

  if (!fileName || !mimeType || !Number.isFinite(sizeBytes)) {
    return NextResponse.json({ ok: false, error: "Archivo inválido." }, { status: 400 });
  }
  if (!isAllowedFileMimeType(mimeType)) {
    return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido." }, { status: 415 });
  }
  if (sizeBytes <= 0 || sizeBytes > maxUploadBytes) {
    return NextResponse.json({ ok: false, error: `El archivo supera el límite de ${Math.round(maxUploadBytes / 1024 / 1024)} MB.` }, { status: 413 });
  }

  const objectKey = createStorageObjectKey(fileName, {
    userId: admin.id,
    prefix: "documents",
    resourceId: "legacy-presign",
  });
  const uploadUrl = new URL(
    `/api/files/upload-object?bucket=${encodeURIComponent(getStorageBucketName())}&key=${encodeURIComponent(objectKey)}`,
    request.url,
  ).toString();

  return NextResponse.json({ ok: true, objectKey, uploadUrl, maxUploadBytes });
}
