import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { getFileAssetById } from "@/lib/file-assets";
import { createShareLink } from "@/lib/file-share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const asset = await getFileAssetById(id);
  if (!asset) return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });

  const token = await createShareLink(asset.id);
  return NextResponse.json({ ok: true, shareUrl: `/share/${token}` });
}
