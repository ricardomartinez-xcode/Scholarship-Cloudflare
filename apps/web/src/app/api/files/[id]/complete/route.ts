import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { markFileAssetUploaded } from "@/lib/file-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiCapability("files-complete-upload", AdminCapability.manage_offers);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { etag?: unknown };
  const etag = typeof payload.etag === "string" ? payload.etag : null;
  const asset = await markFileAssetUploaded(id, etag);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, asset });
}
