"use server";

import { AdminConfigModule } from "@prisma/client";

import { requireConfigPublisher } from "@/lib/admin-publish-auth";
import {
  publishDraftConfigModule,
  rollbackPublishedConfigModule,
} from "@/lib/admin-config-snapshots";

export type ConfigActionResult = {
  ok: boolean;
  error?: string;
};

function parseConfigModule(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim();
  const modules = new Set<string>(Object.values(AdminConfigModule));
  if (!modules.has(value)) return null;
  return value as AdminConfigModule;
}

export async function publishConfigModuleAction(
  formData: FormData,
): Promise<ConfigActionResult> {
  const configModule = parseConfigModule(formData.get("module"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!configModule) return { ok: false, error: "Módulo inválido." };

  try {
    const admin = await requireConfigPublisher(configModule);
    await publishDraftConfigModule({
      module: configModule,
      actor: admin,
      notes,
    });
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible publicar el snapshot draft.",
    };
  }
}

export async function rollbackConfigVersionAction(
  formData: FormData,
): Promise<ConfigActionResult> {
  const configModule = parseConfigModule(formData.get("module"));
  const versionId = String(formData.get("versionId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!configModule) return { ok: false, error: "Módulo inválido." };
  if (!versionId) return { ok: false, error: "Versión inválida." };

  try {
    const admin = await requireConfigPublisher(configModule);
    await rollbackPublishedConfigModule({
      module: configModule,
      versionId,
      actor: admin,
      notes,
    });
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible ejecutar el rollback lógico.",
    };
  }
}
