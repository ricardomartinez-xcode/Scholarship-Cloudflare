import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { createFileAsset } from "@/lib/file-assets";
import { createR2ObjectKey, getR2BucketName, getSignedR2PutUrl } from "@/lib/r2-storage";

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
  if (!mimeType.startsWith("application/pdf") && !mimeType.startsWith("image/")) {
    return { ok: false as const, error: "Solo se permiten PDFs e imagenes." };
  }

  return { ok: true as const, fileName, mimeType, sizeBytes };
}

export async function POST(request: Request) {
  const auth = await requireAdminApiCapability("files-presigned-upload", AdminCapability.manage_offers);
  if (!auth.ok) return auth.response;

  const parsed = parsePayload((await request.json()) as PresignPayload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const key = createR2ObjectKey(parsed.fileName);
  const asset = await createFileAsset({
    r2Key: key,
    bucket: getR2BucketName(),
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    uploadedByUserId: auth.admin.id,
    status: "pending",
  });

  return NextResponse.json({
    ok: true,
    asset,
    uploadUrl: getSignedR2PutUrl({
      key,
      contentType: parsed.mimeType,
    }),
    uploadHeaders: {
      "Content-Type": parsed.mimeType,
    },
  });
}
