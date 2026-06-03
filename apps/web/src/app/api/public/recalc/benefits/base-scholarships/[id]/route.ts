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
  const requestId = buildAdminRequestId("public_recalc_base_scholarship_delete");
  const auth = await requireRecalcPublicApiCapability(
    request,
    requestId,
    AdminCapability.manage_benefits,
  );
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const before = await prisma.scholarshipRule.findUnique({ where: { id } });
  if (!before) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "SCHOLARSHIP_RULE_NOT_FOUND",
      error: "La regla de beca no existe.",
      recoverable: true,
    });
  }

  await prisma.scholarshipRule.delete({ where: { id } });
  await writeAdminAuditLog({
    module: AdminConfigModule.BENEFITS,
    action: AdminAuditAction.DELETE,
    actor: auth.actor,
    entityType: "ScholarshipRule",
    entityId: id,
    requestId,
    before: {
      id: before.id,
      enrollmentType: before.enrollmentType,
      businessLine: before.businessLine,
      modality: before.modality,
      plan: before.plan,
      campusTier: before.campusTier,
      region: before.region,
      plantel: before.plantel,
      programaKey: before.programaKey,
      minAverage: before.minAverage === null ? null : Number(before.minAverage),
      maxAverage: before.maxAverage === null ? null : Number(before.maxAverage),
      scholarshipPercent:
        before.scholarshipPercent === null ? null : Number(before.scholarshipPercent),
      sourceVersion: before.sourceVersion,
    },
    after: null,
    message: "Regla de beca base eliminada desde API publica Recalc.",
  });

  revalidatePath("/admin/benefits");
  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");

  return adminApiSuccess(requestId, { deleted: true, id });
}
