"use server";

import {
  AdminAuditAction,
  AdminCapability,
  AdminConfigModule,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  DEFAULT_EXTENSION_PANEL_CONFIG,
  EXTENSION_PANEL_CONFIG_KEYS,
  getExtensionPanelConfig,
} from "@/lib/extension-panel-config";
import { prisma } from "@/lib/prisma";
import {
  parseExtensionSelectorPackJson,
  serializeExtensionSelectorPack,
} from "@/lib/extension-selector-pack";

const EXTENSION_PANEL_WRITE_CAPABILITY = AdminCapability.manage_ctas;

function normalizeLabel(value: FormDataEntryValue | null, fallback: string) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizePath(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return DEFAULT_EXTENSION_PANEL_CONFIG.openSitePath;
  if (normalized.startsWith("/")) return normalized;
  if (/^https:\/\//i.test(normalized)) return normalized;
  return null;
}

export async function saveExtensionPanelConfigAction(formData: FormData) {
  const admin = await requireAdminCapabilityUser(EXTENSION_PANEL_WRITE_CAPABILITY);

  const sessionRequiredLabel = normalizeLabel(
    formData.get("sessionRequiredLabel"),
    DEFAULT_EXTENSION_PANEL_CONFIG.sessionRequiredLabel,
  );
  const openSiteLabel = normalizeLabel(
    formData.get("openSiteLabel"),
    DEFAULT_EXTENSION_PANEL_CONFIG.openSiteLabel,
  );
  const openSitePath = normalizePath(formData.get("openSitePath"));
  const openWhatsAppLabel = normalizeLabel(
    formData.get("openWhatsAppLabel"),
    DEFAULT_EXTENSION_PANEL_CONFIG.openWhatsAppLabel,
  );
  const selectorPackJsonInput = String(formData.get("selectorPackJson") ?? "");
  const selectorPackResult = parseExtensionSelectorPackJson(selectorPackJsonInput);

  if (!openSitePath) {
    return {
      ok: false,
      error: "La ruta debe iniciar con / o usar https://.",
    };
  }

  if (!selectorPackResult.ok) {
    return {
      ok: false,
      error: selectorPackResult.error,
    };
  }

  const before = await getExtensionPanelConfig();
  const selectorPackJson = serializeExtensionSelectorPack(selectorPackResult.value);

  await prisma.$transaction([
    prisma.adminSidebarInfo.upsert({
      where: { key: EXTENSION_PANEL_CONFIG_KEYS.sessionRequiredLabel },
      update: { value: sessionRequiredLabel, isActive: true, updatedBy: admin.email },
      create: {
        key: EXTENSION_PANEL_CONFIG_KEYS.sessionRequiredLabel,
        value: sessionRequiredLabel,
        isActive: true,
        updatedBy: admin.email,
      },
    }),
    prisma.adminSidebarInfo.upsert({
      where: { key: EXTENSION_PANEL_CONFIG_KEYS.openSiteLabel },
      update: { value: openSiteLabel, isActive: true, updatedBy: admin.email },
      create: {
        key: EXTENSION_PANEL_CONFIG_KEYS.openSiteLabel,
        value: openSiteLabel,
        isActive: true,
        updatedBy: admin.email,
      },
    }),
    prisma.adminSidebarInfo.upsert({
      where: { key: EXTENSION_PANEL_CONFIG_KEYS.openSitePath },
      update: { value: openSitePath, isActive: true, updatedBy: admin.email },
      create: {
        key: EXTENSION_PANEL_CONFIG_KEYS.openSitePath,
        value: openSitePath,
        isActive: true,
        updatedBy: admin.email,
      },
    }),
    prisma.adminSidebarInfo.upsert({
      where: { key: EXTENSION_PANEL_CONFIG_KEYS.openWhatsAppLabel },
      update: { value: openWhatsAppLabel, isActive: true, updatedBy: admin.email },
      create: {
        key: EXTENSION_PANEL_CONFIG_KEYS.openWhatsAppLabel,
        value: openWhatsAppLabel,
        isActive: true,
        updatedBy: admin.email,
      },
    }),
    prisma.adminSidebarInfo.upsert({
      where: { key: EXTENSION_PANEL_CONFIG_KEYS.selectorPackJson },
      update: { value: selectorPackJson, isActive: true, updatedBy: admin.email },
      create: {
        key: EXTENSION_PANEL_CONFIG_KEYS.selectorPackJson,
        value: selectorPackJson,
        isActive: true,
        updatedBy: admin.email,
      },
    }),
  ]);

  const after = {
    sessionRequiredLabel,
    openSiteLabel,
    openSitePath,
    openWhatsAppLabel,
    selectorPack: selectorPackResult.value,
  };

  await writeAdminAuditLog({
    module: AdminConfigModule.CTAS,
    action: AdminAuditAction.UPDATE,
    actor: admin,
    entityType: "ExtensionPanelConfig",
    entityId: "extension_panel",
    before,
    after,
  });

  revalidatePath("/admin/extension-panel");
  revalidatePath("/api/extension/panel-config");

  return { ok: true };
}
