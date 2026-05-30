import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { listFileAssets } from "@/lib/file-assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const assets = await listFileAssets();
  return NextResponse.json({ ok: true, assets });
}
