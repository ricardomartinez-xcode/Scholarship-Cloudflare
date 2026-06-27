import "server-only";

import { d1All } from "@/lib/cloudflare/d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EXTENSION_SELECTOR_PACK,
  parseExtensionSelectorPackJson,
  serializeExtensionSelectorPack,
  type ExtensionSelectorPack,
} from "@/lib/extension-selector-pack";

export const EXTENSION_PANEL_CONFIG_KEYS = {
  sessionRequiredLabel: "extension_panel.session_required_label",
  openSiteLabel: "extension_panel.open_site.label",
  openSitePath: "extension_panel.open_site.path",
  openWhatsAppLabel: "extension_panel.open_whatsapp.label",
  selectorPackJson: "extension_panel.selector_pack.json",
} as const;

export const DEFAULT_EXTENSION_PANEL_CONFIG = {
  sessionRequiredLabel: "Sesión requerida",
  openSiteLabel: "Abrir sitio completo",
  openSitePath: "/unidep",
  openWhatsAppLabel: "Abrir WhatsApp Web",
  selectorPack: DEFAULT_EXTENSION_SELECTOR_PACK,
} as const;

export type ExtensionPanelConfig = {
  sessionRequiredLabel: string;
  openSiteLabel: string;
  openSitePath: string;
  openWhatsAppLabel: string;
  selectorPack: ExtensionSelectorPack;
  selectorPackJson: string;
};

type ExtensionPanelConfigKey =
  (typeof EXTENSION_PANEL_CONFIG_KEYS)[keyof typeof EXTENSION_PANEL_CONFIG_KEYS];

const CONFIG_KEY_SET = new Set<ExtensionPanelConfigKey>(Object.values(EXTENSION_PANEL_CONFIG_KEYS));

function sanitizeLabel(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function sanitizePath(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return DEFAULT_EXTENSION_PANEL_CONFIG.openSitePath;
  if (normalized.startsWith("/")) return normalized;
  if (/^https:\/\//i.test(normalized)) return normalized;
  return DEFAULT_EXTENSION_PANEL_CONFIG.openSitePath;
}

export function isExtensionPanelConfigKey(key: string): key is ExtensionPanelConfigKey {
  return CONFIG_KEY_SET.has(key as ExtensionPanelConfigKey);
}

export async function getExtensionPanelConfig(): Promise<ExtensionPanelConfig> {
  const rows = isCloudflareRuntime()
    ? await d1All<{ key: string; value: string | null }>(
        `SELECT key, value
         FROM admin_sidebar_info
         WHERE is_active = 1
           AND key IN (${Object.values(EXTENSION_PANEL_CONFIG_KEYS).map(() => "?").join(", ")})`,
        Object.values(EXTENSION_PANEL_CONFIG_KEYS),
      )
    : await prisma.adminSidebarInfo.findMany({
        where: {
          key: { in: Object.values(EXTENSION_PANEL_CONFIG_KEYS) },
          isActive: true,
        },
        select: {
          key: true,
          value: true,
        },
      });

  const rowMap = new Map(rows.map((row) => [row.key, row.value]));
  const selectorPackRaw = rowMap.get(EXTENSION_PANEL_CONFIG_KEYS.selectorPackJson);
  const selectorPackResult = parseExtensionSelectorPackJson(selectorPackRaw);
  const selectorPack = selectorPackResult.ok
    ? selectorPackResult.value
    : DEFAULT_EXTENSION_PANEL_CONFIG.selectorPack;

  return {
    sessionRequiredLabel: sanitizeLabel(
      rowMap.get(EXTENSION_PANEL_CONFIG_KEYS.sessionRequiredLabel),
      DEFAULT_EXTENSION_PANEL_CONFIG.sessionRequiredLabel,
    ),
    openSiteLabel: sanitizeLabel(
      rowMap.get(EXTENSION_PANEL_CONFIG_KEYS.openSiteLabel),
      DEFAULT_EXTENSION_PANEL_CONFIG.openSiteLabel,
    ),
    openSitePath: sanitizePath(rowMap.get(EXTENSION_PANEL_CONFIG_KEYS.openSitePath)),
    openWhatsAppLabel: sanitizeLabel(
      rowMap.get(EXTENSION_PANEL_CONFIG_KEYS.openWhatsAppLabel),
      DEFAULT_EXTENSION_PANEL_CONFIG.openWhatsAppLabel,
    ),
    selectorPack,
    selectorPackJson: serializeExtensionSelectorPack(selectorPack),
  };
}
