import { revalidatePath } from "next/cache";
import { AdminAuditAction, AdminCapability, AdminConfigModule, Prisma } from "@prisma/client";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { requireRecalcPublicApiCapability } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PriceOverridePayload = {
  id?: unknown;
  scope?: unknown;
  targetKeys?: unknown;
  newPrice?: unknown;
  isActive?: unknown;
  notes?: unknown;
};

function serializePriceOverride(record: {
  id: string;
  scope: string;
  targetKeys: Prisma.JsonValue;
  newPrice: Prisma.Decimal | number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
}): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    id: record.id,
    scope: record.scope,
    targetKeys: record.targetKeys,
    newPrice: Number(record.newPrice),
    isActive: record.isActive,
    notes: record.notes,
    updatedBy: record.updatedBy,
  })) as Prisma.InputJsonValue;
}

function normalizeTargetKeys(value: unknown): Prisma.InputJsonValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("public_recalc_price_override");
  const auth = await requireRecalcPublicApiCapability(
    request,
    requestId,
    AdminCapability.manage_prices,
  );
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as PriceOverridePayload | null;
  if (!payload) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_JSON",
      error: "El cuerpo JSON no es valido.",
      recoverable: true,
    });
  }

  const id = String(payload.id ?? "").trim();
  const scope = String(payload.scope ?? "base_price").trim();
  const targetKeys = normalizeTargetKeys(payload.targetKeys);
  const newPrice = Number(payload.newPrice);
  const isActive = payload.isActive === undefined ? true : payload.isActive === true;
  const notes = String(payload.notes ?? "").trim() || null;

  if (!scope) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "PRICE_SCOPE_REQUIRED",
      error: "scope es requerido.",
      recoverable: true,
    });
  }
  if (!targetKeys) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "TARGET_KEYS_REQUIRED",
      error: "targetKeys debe ser un objeto JSON.",
      recoverable: true,
    });
  }
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_NEW_PRICE",
      error: "newPrice debe ser numerico y no negativo.",
      recoverable: true,
    });
  }

  const before = id
    ? await prisma.adminPriceOverride.findUnique({
        where: { id },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      })
    : null;

  if (id && !before) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "PRICE_OVERRIDE_NOT_FOUND",
      error: "El override de precio no existe.",
      recoverable: true,
    });
  }

  const saved = before
    ? await prisma.adminPriceOverride.update({
        where: { id: before.id },
        data: { scope, targetKeys, newPrice, isActive, notes, updatedBy: auth.actor.email },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      })
    : await prisma.adminPriceOverride.create({
        data: { scope, targetKeys, newPrice, isActive, notes, updatedBy: auth.actor.email },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      });

  await writeAdminAuditLog({
    module: AdminConfigModule.PRICES,
    action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
    actor: auth.actor,
    entityType: "AdminPriceOverride",
    entityId: saved.id,
    requestId,
    before: before ? serializePriceOverride(before) : null,
    after: serializePriceOverride(saved),
    message: "Override de precio actualizado desde API publica Recalc.",
  });

  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");

  return adminApiSuccess(requestId, { priceOverride: serializePriceOverride(saved) });
}
