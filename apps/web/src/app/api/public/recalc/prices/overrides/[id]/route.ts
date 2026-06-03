import { revalidatePath } from "next/cache";
import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { requireRecalcPublicApiCapability } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = buildAdminRequestId("public_recalc_price_override_delete");
  const auth = await requireRecalcPublicApiCapability(
    request,
    requestId,
    AdminCapability.manage_prices,
  );
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const before = await prisma.adminPriceOverride.findUnique({ where: { id } });
  if (!before) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "PRICE_OVERRIDE_NOT_FOUND",
      error: "El override de precio no existe.",
      recoverable: true,
    });
  }

  await prisma.adminPriceOverride.delete({ where: { id } });
  await writeAdminAuditLog({
    module: AdminConfigModule.PRICES,
    action: AdminAuditAction.DELETE,
    actor: auth.actor,
    entityType: "AdminPriceOverride",
    entityId: id,
    requestId,
    before: JSON.parse(JSON.stringify({
      id: before.id,
      scope: before.scope,
      targetKeys: before.targetKeys,
      newPrice: Number(before.newPrice),
      isActive: before.isActive,
      notes: before.notes,
      updatedBy: before.updatedBy,
    })),
    after: null,
    message: "Override de precio eliminado desde API publica Recalc.",
  });

  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");

  return adminApiSuccess(requestId, { deleted: true, id });
}
