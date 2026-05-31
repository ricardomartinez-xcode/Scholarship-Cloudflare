import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { getFileAssetForUsage } from "@/lib/file-assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType") || "";
  const targetId = url.searchParams.get("targetId") || "";
  const slot = url.searchParams.get("slot") || "";

  const asset = await getFileAssetForUsage({ targetType, targetId, slot });
  if (!asset) return NextResponse.json({ ok: false, asset: null }, { status: 404 });
  return NextResponse.json({ ok: true, asset, previewUrl: `/preview/${asset.id}` });
}
