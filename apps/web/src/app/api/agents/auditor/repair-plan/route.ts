import { AdminAuditAction, AdminChangeSource, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { createRepairPlan } from "@/lib/agents/auditor/repair-plans";

import { requireAuditorReadAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const findingSchema = z.object({
  id: z.string().min(1).max(160),
  module: z.enum(["system", "tokens", "oauth", "users", "offers", "quote", "github", "security"]),
  severity: z.enum(["info", "warning", "error", "critical"]),
  title: z.string().min(1).max(240),
  summary: z.string().min(1).max(5_000),
  evidence: z.record(z.string(), z.unknown()).optional(),
  suggestedAction: z.string().max(5_000).optional(),
  repairable: z.boolean(),
  repairActionId: z.string().max(160).optional(),
});

const repairPlanSchema = z.object({
  finding: findingSchema,
});

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("agents_auditor_repair_plan");
  const auth = await requireAuditorReadAccess(requestId, "repair-plan");
  if (!auth.ok) return auth.response;

  const parsed = repairPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_AUDITOR_FINDING",
      error: "Payload invalido para generar plan de reparacion.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  const plan = createRepairPlan(parsed.data.finding);
  await writeAdminAuditLog({
    module: AdminConfigModule.ACCESS,
    action: AdminAuditAction.IMPORT_VALIDATE,
    source: AdminChangeSource.SYSTEM,
    actor: auth.admin,
    entityType: "AuditorRepairPlan",
    entityId: parsed.data.finding.id,
    requestId,
    after: {
      findingId: plan.findingId,
      filesToTouch: plan.filesToTouch,
      canCreatePr: plan.canCreatePr,
      requiresConfirmation: plan.requiresConfirmation,
    },
    message: `Plan Auditor/Reparador generado para ${parsed.data.finding.id}.`,
  });

  return adminApiSuccess(requestId, { plan });
}
