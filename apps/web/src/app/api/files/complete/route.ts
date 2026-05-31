import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { assignFileAssetUsage, createFileAsset } from "@/lib/file-assets";
import { getMaxUploadBytes, isAllowedFileMimeType } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CompleteBody = {
  objectKey?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  usage?: Partial<{
    targetType: string;
    targetId: string;
    slot: string;
    sortOrder: number;
    isPrimary: boolean;
  }>;
};

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CompleteBody | null;

  const objectKey = body?.objectKey?.trim();
  const fileName = body?.fileName?.trim();
  const mimeType = body?.mimeType?.trim();
  const sizeBytes = Number(body?.sizeBytes);

  if (!objectKey || !fileName || !mimeType || !Number.isFinite(sizeBytes)) {
    return NextResponse.json({ ok: false, error: "Metadata inválida." }, { status: 400 });
  }
  if (!isAllowedFileMimeType(mimeType)) {
    return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido." }, { status: 415 });
  }
  if (sizeBytes <= 0 || sizeBytes > getMaxUploadBytes()) {
    return NextResponse.json({ ok: false, error: "Tamaño de archivo inválido." }, { status: 413 });
  }

  const asset = await createFileAsset({
    r2Key: objectKey,
    fileName,
    mimeType,
    sizeBytes,
    uploadedByUserId: admin.id,
    status: "uploaded",
  });

  let usage = null;
  if (body?.usage?.targetType && body.usage.targetId && body.usage.slot) {
    usage = await assignFileAssetUsage(asset.id, {
      targetType: body.usage.targetType,
      targetId: body.usage.targetId,
      slot: body.usage.slot,
      sortOrder: body.usage.sortOrder ?? 0,
      isPrimary: body.usage.isPrimary ?? true,
    });
  }

  return NextResponse.json({ ok: true, asset, usage, previewUrl: `/preview/${asset.id}` });
}
