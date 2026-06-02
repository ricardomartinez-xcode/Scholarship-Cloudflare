import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { assignFileAssetUsage, clearFileAssetUsage, getFileAssetById } from "@/lib/file-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsagePayload = {
  targetType?: unknown;
  targetId?: unknown;
  slot?: unknown;
  sortOrder?: unknown;
  isPrimary?: unknown;
  clear?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiCapability("files-assign-usage", [
    AdminCapability.manage_offers,
    AdminCapability.manage_ctas,
  ]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const asset = await getFileAssetById(id);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as UsagePayload | null;
  const targetType = String(payload?.targetType ?? "").trim();
  const slot = String(payload?.slot ?? "").trim();
  const targetIdRaw = String(payload?.targetId ?? "").trim();
  const targetId = targetIdRaw || (targetType === "training_material" ? asset.id : "");
  const sortOrder = Number(payload?.sortOrder ?? 0);

  if (!targetType || !targetId || !slot) {
    return NextResponse.json(
      { ok: false, error: "Selecciona entidad, ID y uso del archivo." },
      { status: 400 },
    );
  }

  if (payload?.clear === true) {
    await clearFileAssetUsage({ targetType, targetId, slot });
    return NextResponse.json({ ok: true, usage: null });
  }

  const usage = await assignFileAssetUsage(id, {
    targetType,
    targetId,
    slot,
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    isPrimary: payload?.isPrimary === false ? false : true,
  });

  return NextResponse.json({ ok: true, usage });
}
