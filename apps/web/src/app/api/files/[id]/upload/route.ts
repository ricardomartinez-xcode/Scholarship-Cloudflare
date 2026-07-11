import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { getFileAssetById } from "@/lib/file-assets";
import {
  getMaxUploadBytes,
  isAllowedFileMimeType,
  uploadStorageObject,
} from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeContentType(value: string | null) {
  return String(value ?? "").split(";")[0].trim().toLowerCase();
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiCapability("files-upload-object", [
    AdminCapability.manage_offers,
    AdminCapability.manage_ctas,
  ]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const asset = await getFileAssetById(id);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  }

  const contentType = normalizeContentType(request.headers.get("content-type"));
  if (!contentType || contentType !== asset.mimeType || !isAllowedFileMimeType(contentType)) {
    return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido." }, { status: 415 });
  }

  const bytes = await request.arrayBuffer();
  const maxUploadBytes = getMaxUploadBytes();
  if (bytes.byteLength <= 0 || bytes.byteLength > maxUploadBytes) {
    return NextResponse.json({ ok: false, error: "Tamaño de archivo inválido." }, { status: 413 });
  }
  if (asset.sizeBytes !== null && bytes.byteLength !== asset.sizeBytes) {
    return NextResponse.json({ ok: false, error: "El tamaño no coincide con el registro." }, { status: 400 });
  }

  const uploaded = await uploadStorageObject({
    bucket: asset.bucket,
    key: asset.r2Key,
    body: bytes,
    contentType,
    upsert: true,
  });

  return NextResponse.json(
    { ok: true, path: uploaded.path },
    {
      headers: {
        ETag: uploaded.path,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
