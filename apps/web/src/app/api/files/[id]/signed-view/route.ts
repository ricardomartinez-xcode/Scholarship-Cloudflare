import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { getFileAssetById } from "@/lib/file-assets";
import { createR2SignedUrl } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const asset = await getFileAssetById(id);
  if (!asset) return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });

  const signedUrl = createR2SignedUrl({
    method: "GET",
    key: asset.objectKey,
    expiresSeconds: 600,
    responseContentDisposition: `inline; filename="${asset.fileName.replace(/"/g, "")}"`,
  });
  return NextResponse.redirect(signedUrl);
}
