import {
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  Prisma,
  Role,
} from "@prisma/client";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { isAllowedEmail } from "@/lib/domain";
import { logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { getPlacementForLegacyLocation } from "@/lib/admin-placement";
import {
  type AuthSyncDiagnostics,
  getAuthSyncDiagnostics,
} from "@/services/authSyncService";

export const REPAIR_ACTION_IDS = [
  "auth.link_missing_by_email",
  "auth.repair_broken_auth_reference",
  "auth.deactivate_orphans",
  "auth.create_minimal_app_users",
  "campaigns.reset_stuck_processing",
  "config.normalize_cta_placement",
] as const;

export type RepairActionId = (typeof REPAIR_ACTION_IDS)[number];

export type RepairSafety = "safe_auto_fix" | "review_required";

export type RepairActionDefinition = {
  id: RepairActionId;
  name: string;
  description: string;
  severity: RepairSafety;
  preconditions: string[];
  module: AdminConfigModule;
};

export type RepairPreviewItem = {
  key: string;
  title: string;
  details?: Record<string, unknown>;
};

export type RepairPreviewResult = RepairActionDefinition & {
  previewCount: number;
  sample: RepairPreviewItem[];
  warnings: string[];
};

export type RepairExecutionResult = RepairPreviewResult & {
  appliedCount: number;
  skippedCount: number;
};

type RepairActor = {
  id: string;
  email: string;
};

type LinkByEmailCandidate = {
  userId: string;
  userEmail: string;
  neonId: string;
  neonEmail: string | null;
};

type BrokenReferenceCandidate = {
  userId: string;
  userEmail: string;
  currentAuthUserId: string;
  suggestedNeonId: string;
  suggestedNeonEmail: string | null;
};

type OrphanDeactivationCandidate = {
  userId: string;
  userEmail: string;
  role: Role;
};

type MissingAppUserCandidate = {
  neonId: string;
  neonEmail: string;
};

type StuckCampaignCandidate = {
  campaignId: string;
  campaignName: string;
  status: string;
  updatedAt: string;
  claimedRecipients: number;
};

type CtaPlacementDriftCandidate = {
  ctaId: string;
  label: string;
  location: string;
};

const REPAIR_ACTIONS: RepairActionDefinition[] = [
  {
    id: "auth.link_missing_by_email",
    name: "Vincular authUserId por email",
    description:
      "Asigna authUserId cuando existe match único por email entre app y Neon Auth.",
    severity: "safe_auto_fix",
    preconditions: [
      "El email de app coincide con exactamente un usuario en Neon Auth.",
      "Ese authUserId aún no está enlazado a otro usuario de app.",
    ],
    module: AdminConfigModule.ACCESS,
  },
  {
    id: "auth.repair_broken_auth_reference",
    name: "Reparar referencia authUserId rota",
    description:
      "Corrige authUserId cuando la referencia actual no existe pero hay match único por email.",
    severity: "safe_auto_fix",
    preconditions: [
      "La referencia authUserId actual no existe en Neon Auth.",
      "Existe un match único por email en Neon Auth.",
    ],
    module: AdminConfigModule.ACCESS,
  },
  {
    id: "auth.deactivate_orphans",
    name: "Desactivar huérfanos seguros",
    description:
      "Desactiva usuarios activos huérfanos de rol user para evitar accesos inconsistentes.",
    severity: "safe_auto_fix",
    preconditions: [
      "El usuario tiene authUserId roto y sigue activo.",
      "El rol del usuario es user (no aplica a perfiles administrativos).",
    ],
    module: AdminConfigModule.ACCESS,
  },
  {
    id: "auth.create_minimal_app_users",
    name: "Regenerar usuarios mínimos",
    description:
      "Crea filas mínimas en recalc_admin.user para cuentas Neon Auth permitidas sin registro en app.",
    severity: "review_required",
    preconditions: [
      "El usuario existe en Neon Auth y no existe en recalc_admin.user.",
      "El correo cumple reglas de dominio permitido para acceso.",
    ],
    module: AdminConfigModule.ACCESS,
  },
  {
    id: "campaigns.reset_stuck_processing",
    name: "Resetear campañas atascadas",
    description:
      "Regresa a cola campañas extension_runner atascadas en ejecución y libera recipients claimed.",
    severity: "safe_auto_fix",
    preconditions: [
      "La campaña está en processing/waiting_runner (o running legacy) sin actualización reciente.",
      "Tiene recipients en estado claimed pendientes de reintento.",
    ],
    module: AdminConfigModule.CTAS,
  },
  {
    id: "config.normalize_cta_placement",
    name: "Normalizar placements CTA",
    description:
      "Sincroniza placementPage/section/panel/slot de CTAs con su location legacy.",
    severity: "safe_auto_fix",
    preconditions: [
      "El CTA usa una location legacy con mapeo definido.",
      "Los campos de placement no coinciden con el mapeo esperado.",
    ],
    module: AdminConfigModule.CTAS,
  },
];

export function isRepairActionId(value: string): value is RepairActionId {
  return (REPAIR_ACTION_IDS as readonly string[]).includes(value);
}

function assertAction(actionId: RepairActionId) {
  const action = REPAIR_ACTIONS.find((item) => item.id === actionId);
  if (!action) {
    throw new Error(`La acción de reparación "${actionId}" no existe.`);
  }
  return action;
}

function toSample(title: string, key: string, details?: Record<string, unknown>): RepairPreviewItem {
  return { key, title, details };
}

function limitSample<T>(items: T[], limit: number) {
  return items.slice(0, Math.max(0, limit));
}

function buildAppLookupByEmail(diagnostics: AuthSyncDiagnostics) {
  const map = new Map<string, { id: string; authUserId: string | null }>();
  for (const user of diagnostics.appUsers) {
    map.set(user.email.trim().toLowerCase(), {
      id: user.id,
      authUserId: user.authUserId,
    });
  }
  return map;
}

async function getLinkByEmailCandidates(
  diagnostics: AuthSyncDiagnostics,
): Promise<LinkByEmailCandidate[]> {
  return diagnostics.missingAuthUserIdMatches.map((record) => ({
    userId: record.user.id,
    userEmail: record.user.email,
    neonId: record.neonId,
    neonEmail: record.neonEmail,
  }));
}

async function getBrokenReferenceCandidates(
  diagnostics: AuthSyncDiagnostics,
): Promise<BrokenReferenceCandidate[]> {
  return diagnostics.brokenAuthReferences
    .filter((record) => Boolean(record.suggestedNeonId))
    .map((record) => ({
      userId: record.user.id,
      userEmail: record.user.email,
      currentAuthUserId: record.user.authUserId ?? "",
      suggestedNeonId: record.suggestedNeonId ?? "",
      suggestedNeonEmail: record.suggestedNeonEmail,
    }));
}

async function getOrphanDeactivationCandidates(
  diagnostics: AuthSyncDiagnostics,
): Promise<OrphanDeactivationCandidate[]> {
  return diagnostics.appOrphans
    .filter(
      (record) =>
        record.reason === "auth_reference_not_found" &&
        record.user.isActive &&
        record.user.role === Role.user,
    )
    .map((record) => ({
      userId: record.user.id,
      userEmail: record.user.email,
      role: record.user.role,
    }));
}

async function getMissingAppUserCandidates(
  diagnostics: AuthSyncDiagnostics,
): Promise<MissingAppUserCandidate[]> {
  if (!diagnostics.neonAuthAvailable) return [];
  const appByEmail = buildAppLookupByEmail(diagnostics);
  return diagnostics.neonOnly
    .map((neonUser) => {
      const email = String(neonUser.email ?? "").trim().toLowerCase();
      if (!email) return null;
      if (!isAllowedEmail(email)) return null;
      if (appByEmail.has(email)) return null;
      return {
        neonId: neonUser.id,
        neonEmail: email,
      } satisfies MissingAppUserCandidate;
    })
    .filter((candidate): candidate is MissingAppUserCandidate => Boolean(candidate));
}

async function getStuckCampaignCandidates(): Promise<StuckCampaignCandidate[]> {
  const staleBefore = new Date(Date.now() - 45 * 60 * 1000);
  const campaigns = await prisma.extensionCampaign.findMany({
    where: {
      status: { in: ["queued", "scheduled", "running", "processing", "waiting_runner"] },
      updatedAt: { lte: staleBefore },
    },
    select: {
      id: true,
      campaignName: true,
      status: true,
      updatedAt: true,
      recipients: {
        where: { status: "claimed" },
        select: { id: true },
      },
    },
    take: 100,
    orderBy: [{ updatedAt: "asc" }],
  });

  return campaigns
    .filter((campaign) => campaign.recipients.length > 0)
    .map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      status: campaign.status,
      updatedAt: campaign.updatedAt.toISOString(),
      claimedRecipients: campaign.recipients.length,
    }));
}

async function getCtaPlacementDriftCandidates(): Promise<CtaPlacementDriftCandidate[]> {
  const rows = await prisma.adminPublicCta.findMany({
    select: {
      id: true,
      label: true,
      location: true,
      placementPage: true,
      placementSection: true,
      placementPanel: true,
      placementSlot: true,
      placementBreakpoint: true,
    },
    take: 5000,
    orderBy: [{ updatedAt: "desc" }],
  });

  return rows
    .filter((row) => {
      const expected = getPlacementForLegacyLocation(row.location);
      return (
        row.placementPage !== expected.page ||
        row.placementSection !== expected.section ||
        row.placementPanel !== expected.panel ||
        row.placementSlot !== expected.slot ||
        row.placementBreakpoint !== expected.breakpoint
      );
    })
    .map((row) => ({
      ctaId: row.id,
      label: row.label,
      location: row.location,
    }));
}

async function resolveAuthDiagnostics(diagnostics?: AuthSyncDiagnostics) {
  if (diagnostics) return diagnostics;
  return getAuthSyncDiagnostics({ analysisLimit: 5000 });
}

export async function previewRepairAction(params: {
  actionId: RepairActionId;
  diagnostics?: AuthSyncDiagnostics;
  previewLimit?: number;
}): Promise<RepairPreviewResult> {
  const action = assertAction(params.actionId);
  const previewLimit = Math.min(Math.max(Math.trunc(params.previewLimit ?? 25), 1), 100);
  const warnings: string[] = [];
  let previewCount = 0;
  let sample: RepairPreviewItem[] = [];

  if (params.actionId.startsWith("auth.")) {
    const diagnostics = await resolveAuthDiagnostics(params.diagnostics);
    if (!diagnostics.neonAuthAvailable) {
      warnings.push(
        "No se puede previsualizar esta acción porque neon_auth.user no está disponible.",
      );
      return { ...action, warnings, previewCount: 0, sample: [] };
    }
    warnings.push(...diagnostics.warnings);

    if (params.actionId === "auth.link_missing_by_email") {
      const candidates = await getLinkByEmailCandidates(diagnostics);
      previewCount = candidates.length;
      sample = limitSample(candidates, previewLimit).map((candidate) =>
        toSample(candidate.userEmail, candidate.userId, {
          neonId: candidate.neonId,
          neonEmail: candidate.neonEmail,
        }),
      );
    } else if (params.actionId === "auth.repair_broken_auth_reference") {
      const candidates = await getBrokenReferenceCandidates(diagnostics);
      previewCount = candidates.length;
      sample = limitSample(candidates, previewLimit).map((candidate) =>
        toSample(candidate.userEmail, candidate.userId, {
          currentAuthUserId: candidate.currentAuthUserId,
          suggestedNeonId: candidate.suggestedNeonId,
        }),
      );
    } else if (params.actionId === "auth.deactivate_orphans") {
      const candidates = await getOrphanDeactivationCandidates(diagnostics);
      previewCount = candidates.length;
      sample = limitSample(candidates, previewLimit).map((candidate) =>
        toSample(candidate.userEmail, candidate.userId, { role: candidate.role }),
      );
    } else if (params.actionId === "auth.create_minimal_app_users") {
      const candidates = await getMissingAppUserCandidates(diagnostics);
      previewCount = candidates.length;
      sample = limitSample(candidates, previewLimit).map((candidate) =>
        toSample(candidate.neonEmail, candidate.neonId),
      );
    }
  } else if (params.actionId === "campaigns.reset_stuck_processing") {
    const candidates = await getStuckCampaignCandidates();
    previewCount = candidates.length;
    sample = limitSample(candidates, previewLimit).map((candidate) =>
      toSample(candidate.campaignName, candidate.campaignId, {
        status: candidate.status,
        updatedAt: candidate.updatedAt,
        claimedRecipients: candidate.claimedRecipients,
      }),
    );
  } else if (params.actionId === "config.normalize_cta_placement") {
    const candidates = await getCtaPlacementDriftCandidates();
    previewCount = candidates.length;
    sample = limitSample(candidates, previewLimit).map((candidate) =>
      toSample(candidate.label, candidate.ctaId, { location: candidate.location }),
    );
  }

  return {
    ...action,
    previewCount,
    sample,
    warnings,
  };
}

async function writeRepairAuditLog(params: {
  action: RepairActionDefinition;
  actor: RepairActor;
  requestId: string;
  preview: RepairPreviewResult;
  appliedCount: number;
  skippedCount: number;
}) {
  const before: Prisma.InputJsonValue = {
    previewCount: params.preview.previewCount,
    sample: params.preview.sample.map((item) => ({
      key: item.key,
      title: item.title,
      details:
        item.details && typeof item.details === "object"
          ? (item.details as Prisma.InputJsonValue)
          : null,
    })),
  };
  const after: Prisma.InputJsonValue = {
    appliedCount: params.appliedCount,
    skippedCount: params.skippedCount,
  };
  const diffSummary: Prisma.InputJsonValue = {
    actionId: params.action.id,
    severity: params.action.severity,
  };

  await writeAdminAuditLog({
    module: params.action.module,
    action: AdminAuditAction.UPDATE,
    source: AdminChangeSource.SYSTEM,
    actor: params.actor,
    entityType: "RepairAction",
    entityId: params.action.id,
    requestId: params.requestId,
    before,
    after,
    diffSummary,
    message: `Repair action ${params.action.id} aplicada.`,
  });
}

export async function executeRepairAction(params: {
  actionId: RepairActionId;
  actor: RepairActor;
  requestId: string;
  diagnostics?: AuthSyncDiagnostics;
  previewLimit?: number;
}): Promise<RepairExecutionResult> {
  const action = assertAction(params.actionId);
  const preview = await previewRepairAction({
    actionId: params.actionId,
    diagnostics: params.diagnostics,
    previewLimit: params.previewLimit,
  });

  let appliedCount = 0;
  let skippedCount = 0;

  if (params.actionId === "auth.link_missing_by_email") {
    const diagnostics = await resolveAuthDiagnostics(params.diagnostics);
    const candidates = await getLinkByEmailCandidates(diagnostics);
    for (const candidate of candidates) {
      const update = await prisma.user.updateMany({
        where: { id: candidate.userId, authUserId: null },
        data: { authUserId: candidate.neonId },
      });
      if (update.count > 0) appliedCount += 1;
      else skippedCount += 1;
    }
  } else if (params.actionId === "auth.repair_broken_auth_reference") {
    const diagnostics = await resolveAuthDiagnostics(params.diagnostics);
    const candidates = await getBrokenReferenceCandidates(diagnostics);
    for (const candidate of candidates) {
      const update = await prisma.user.updateMany({
        where: {
          id: candidate.userId,
          authUserId: candidate.currentAuthUserId,
        },
        data: { authUserId: candidate.suggestedNeonId },
      });
      if (update.count > 0) appliedCount += 1;
      else skippedCount += 1;
    }
  } else if (params.actionId === "auth.deactivate_orphans") {
    const diagnostics = await resolveAuthDiagnostics(params.diagnostics);
    const candidates = await getOrphanDeactivationCandidates(diagnostics);
    if (candidates.length) {
      const update = await prisma.user.updateMany({
        where: {
          id: { in: candidates.map((candidate) => candidate.userId) },
          isActive: true,
          role: Role.user,
        },
        data: { isActive: false },
      });
      appliedCount = update.count;
      skippedCount = candidates.length - update.count;
    }
  } else if (params.actionId === "auth.create_minimal_app_users") {
    const diagnostics = await resolveAuthDiagnostics(params.diagnostics);
    const candidates = await getMissingAppUserCandidates(diagnostics);
    if (candidates.length) {
      const created = await prisma.user.createMany({
        data: candidates.map((candidate) => ({
          authUserId: candidate.neonId,
          email: candidate.neonEmail,
          role: Role.user,
          isActive: true,
          lastLoginAt: null,
        })),
        skipDuplicates: true,
      });
      appliedCount = created.count;
      skippedCount = candidates.length - created.count;
    }
  } else if (params.actionId === "campaigns.reset_stuck_processing") {
    const candidates = await getStuckCampaignCandidates();
    for (const candidate of candidates) {
      const campaign = await prisma.extensionCampaign.findUnique({
        where: { id: candidate.campaignId },
        select: {
          id: true,
          recipients: {
            where: { status: "claimed" },
            select: { id: true, scheduledFor: true },
          },
        },
      });
      if (!campaign) {
        skippedCount += 1;
        continue;
      }
      const now = new Date();
      const queuedIds = campaign.recipients
        .filter((recipient) => !recipient.scheduledFor || recipient.scheduledFor <= now)
        .map((recipient) => recipient.id);
      const scheduledIds = campaign.recipients
        .filter((recipient) => recipient.scheduledFor && recipient.scheduledFor > now)
        .map((recipient) => recipient.id);

      await prisma.$transaction([
        prisma.extensionCampaign.update({
          where: { id: campaign.id },
          data: {
            status: queuedIds.length > 0 ? "queued" : "scheduled",
            completedAt: null,
          },
        }),
        ...(queuedIds.length
          ? [
              prisma.extensionCampaignRecipient.updateMany({
                where: { id: { in: queuedIds } },
                data: { status: "queued", attemptedAt: null, lastError: null },
              }),
            ]
          : []),
        ...(scheduledIds.length
          ? [
              prisma.extensionCampaignRecipient.updateMany({
                where: { id: { in: scheduledIds } },
                data: { status: "scheduled", attemptedAt: null, lastError: null },
              }),
            ]
          : []),
      ]);
      appliedCount += 1;
    }
  } else if (params.actionId === "config.normalize_cta_placement") {
    const candidates = await getCtaPlacementDriftCandidates();
    for (const candidate of candidates) {
      const cta = await prisma.adminPublicCta.findUnique({
        where: { id: candidate.ctaId },
        select: { id: true, location: true },
      });
      if (!cta) {
        skippedCount += 1;
        continue;
      }
      const placement = getPlacementForLegacyLocation(cta.location);
      await prisma.adminPublicCta.update({
        where: { id: cta.id },
        data: {
          placementPage: placement.page,
          placementSection: placement.section,
          placementPanel: placement.panel,
          placementSlot: placement.slot,
          placementBreakpoint: placement.breakpoint,
        },
      });
      appliedCount += 1;
    }
  }

  await writeRepairAuditLog({
    action,
    actor: params.actor,
    requestId: params.requestId,
    preview,
    appliedCount,
    skippedCount,
  });

  logStructured("info", "Repair action executed", {
    module: "repair-actions",
    action: action.id,
    result: "success",
    requestId: params.requestId,
    actorUserId: params.actor.id,
    actorEmail: params.actor.email,
    metadata: {
      appliedCount,
      skippedCount,
      previewCount: preview.previewCount,
    },
  });

  return {
    ...preview,
    appliedCount,
    skippedCount,
  };
}

export async function listRepairActionPreviews(params?: {
  diagnostics?: AuthSyncDiagnostics;
  previewLimit?: number;
}) {
  const diagnostics = params?.diagnostics;
  const previewLimit = params?.previewLimit ?? 25;
  return Promise.all(
    REPAIR_ACTIONS.map((action) =>
      previewRepairAction({
        actionId: action.id,
        diagnostics,
        previewLimit,
      }),
    ),
  );
}

export function listRepairActionsCatalog() {
  return [...REPAIR_ACTIONS];
}
