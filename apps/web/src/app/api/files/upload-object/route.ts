import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import {
  getMaxUploadBytes,
  getStorageBucketName,
  isAllowedFileMimeType,
  uploadStorageObject,
} from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeContentType(value: string | null) {
  return String(value ?? "").split(";")[0].trim().toLowerCase();
}

function isSafeStorageKey(value: string) {
  return Boolean(value) && !value.startsWith("/") && !value.includes("..");
}

export async function PUT(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const url = new URL(request.url);
  const key = url.searchParams.get("key")?.trim() ?? "";
  const bucket = url.searchParams.get("bucket")?.trim() || getStorageBucketName();
  if (!isSafeStorageKey(key)) {
    return NextResponse.json({ ok: false, error: "Ruta de archivo inválida." }, { status: 400 });
  }

  const contentType = normalizeContentType(request.headers.get("content-type"));
  if (!contentType || !isAllowedFileMimeType(contentType)) {
    return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido." }, { status: 415 });
  }

  const bytes = await request.arrayBuffer();
  const maxUploadBytes = getMaxUploadBytes();
  if (bytes.byteLength <= 0 || bytes.byteLength > maxUploadBytes) {
    return NextResponse.json({ ok: false, error: "Tamaño de archivo inválido." }, { status: 413 });
  }

  const uploaded = await uploadStorageObject({
    bucket,
    key,
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
