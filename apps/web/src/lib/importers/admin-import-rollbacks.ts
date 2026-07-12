import { revalidatePath } from "next/cache";
import {
  AdminCapability,
  AdminConfigModule,
  AdminImportSessionStatus,
} from "@prisma/client";

import {
  getAdminConfigModulePaths,
} from "@/lib/admin-config-modules";
import {
  restoreDraftConfigSnapshot,
  type AdminConfigSnapshot,
} from "@/lib/admin-config-snapshots";
import {
  getAdminImportSession,
  markAdminImportSessionRolledBack,
  type AdminImportSessionSerialized,
  type ImportSessionActor,
} from "@/lib/importers/admin-import-sessions";
import {
  getPublicRouteTagsForModule,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";
import { captureException } from "@/lib/observability";

const ROLLBACK_CAPABILITY_BY_MODULE: Partial<Record<AdminConfigModule, AdminCapability>> = {
  [AdminConfigModule.BENEFITS]: AdminCapability.manage_benefits,
  [AdminConfigModule.PRICES]: AdminCapability.manage_prices,
  [AdminConfigModule.CTAS]: AdminCapability.manage_ctas,
  [AdminConfigModule.SIDEBAR]: AdminCapability.manage_sidebar,
  [AdminConfigModule.DIRECTORY]: AdminCapability.manage_directory,
  [AdminConfigModule.OFFER]: AdminCapability.manage_offers,
} satisfies Partial<Record<AdminConfigModule, AdminCapability>>;

export function getAdminImportRollbackCapability(module: AdminConfigModule) {
  return ROLLBACK_CAPABILITY_BY_MODULE[module] ?? null;
}

export function canRollbackAdminImportSession(
  session: Pick<AdminImportSessionSerialized, "module" | "status" | "beforeSnapshot">,
) {
  return (
    getAdminImportRollbackCapability(session.module) !== null &&
    session.status === AdminImportSessionStatus.applied &&
    session.beforeSnapshot !== null &&
    session.beforeSnapshot !== undefined
  );
}

export async function rollbackAdminImportSessionToBeforeSnapshot(input: {
  sessionId: string;
  actor: ImportSessionActor;
  requestId?: string | null;
}) {
  const session = await getAdminImportSession({ sessionId: input.sessionId });
  if (!session) {
    throw new Error("No se encontró la sesión de importación.");
  }

  const requiredCapability = getAdminImportRollbackCapability(session.module);
  if (!requiredCapability) {
    throw new Error(
      `El módulo ${session.module} no soporta rollback operativo desde sesiones de importación.`,
    );
  }

  if (!canRollbackAdminImportSession(session)) {
    throw new Error(
      "La sesión no puede revertirse. Solo las sesiones aplicadas con snapshot previo son elegibles.",
    );
  }

  const beforeSnapshot = session.beforeSnapshot as AdminConfigSnapshot;
  await restoreDraftConfigSnapshot(session.module, beforeSnapshot);

  try {
    for (const path of getAdminConfigModulePaths(session.module)) {
      revalidatePath(path);
    }
    revalidatePublicRouteTags(getPublicRouteTagsForModule(session.module));
    revalidatePath("/admin/importaciones");
    revalidatePath(`/admin/importaciones/${session.id}`);
  } catch (error) {
    captureException(error, {
      module: "admin-import-sessions",
      action: "rollback-revalidate",
      result: "failure",
      requestId: input.requestId ?? null,
      subjectType: "AdminImportSession",
      subjectId: session.id,
    }, "Admin import rollback cache revalidation failed");
  }

  return markAdminImportSessionRolledBack({
    sessionId: session.id,
    module: session.module,
    actor: input.actor,
    requestId: input.requestId ?? null,
    result: {
      rollback: true,
      restoredFrom: "beforeSnapshot",
      restoredAt: new Date().toISOString(),
      previousStatus: session.status,
      fileName: session.fileName,
      fileChecksum: session.fileChecksum,
      appliedAt: session.appliedAt,
      appliedByEmail: session.appliedByEmail,
    },
  });
}
