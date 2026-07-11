import { NextResponse } from "next/server";

import { getFileAssetByShareToken } from "@/lib/file-share-links";
import { createSignedStorageDownloadUrl } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const asset = await getFileAssetByShareToken(token);
  if (!asset) return NextResponse.json({ ok: false, error: "Link inválido o expirado." }, { status: 404 });

  const signedUrl = await createSignedStorageDownloadUrl({
    bucket: asset.bucket,
    key: asset.r2Key,
    expiresSeconds: 600,
    fileName: asset.fileName,
    disposition: "inline",
  });

  return NextResponse.redirect(signedUrl);
}
