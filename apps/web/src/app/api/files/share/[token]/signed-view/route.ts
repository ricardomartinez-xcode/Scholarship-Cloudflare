import { NextResponse } from "next/server";

import { getFileAssetByShareToken } from "@/lib/file-assets";
import { createR2SignedUrl } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const asset = await getFileAssetByShareToken(token);
  if (!asset) return NextResponse.json({ ok: false, error: "Link inválido o expirado." }, { status: 404 });

  const signedUrl = createR2SignedUrl({
    method: "GET",
    key: asset.objectKey,
    expiresSeconds: 600,
    responseContentDisposition: `inline; filename="${asset.fileName.replace(/"/g, "")}"`,
  });
  return NextResponse.redirect(signedUrl);
}
