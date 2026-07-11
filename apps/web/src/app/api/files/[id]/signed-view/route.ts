import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { getFileAssetRedirectUrl } from "@/lib/file-asset-redirect";
import { getFileAssetById } from "@/lib/file-assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const asset = await getFileAssetById(id);
  if (!asset) return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });

  const signedUrl = await getFileAssetRedirectUrl(asset, "inline");
  const redirectUrl = signedUrl.startsWith("/") ? new URL(signedUrl, request.url) : signedUrl;

  return NextResponse.redirect(redirectUrl);
}
