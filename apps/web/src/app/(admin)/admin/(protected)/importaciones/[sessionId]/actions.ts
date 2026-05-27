"use server";

import { AdminCapability } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminImportSession } from "@/lib/importers/admin-import-sessions";
import {
  getAdminImportRollbackCapability,
  rollbackAdminImportSessionToBeforeSnapshot,
} from "@/lib/importers/admin-import-rollbacks";

export async function rollbackImportSessionAction(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  if (!sessionId) {
    throw new Error("Falta el identificador de la sesión de importación.");
  }

  const admin = await requireAdminCapabilityUser(
    AdminCapability.view_admin_operations,
  );
  const session = await getAdminImportSession({ sessionId });
  if (!session) {
    throw new Error("No se encontró la sesión de importación.");
  }

  const rollbackCapability = getAdminImportRollbackCapability(session.module);
  if (!rollbackCapability) {
    throw new Error("Esta sesión no soporta rollback operativo.");
  }

  await requireAdminCapabilityUser(rollbackCapability);

  await rollbackAdminImportSessionToBeforeSnapshot({
    sessionId,
    actor: {
      id: admin.id,
      email: admin.email,
    },
  });

  revalidatePath("/admin/importaciones");
  revalidatePath(`/admin/importaciones/${sessionId}`);
  redirect(`/admin/importaciones/${sessionId}`);
}
