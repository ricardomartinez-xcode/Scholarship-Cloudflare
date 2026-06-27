import { type Role } from "@prisma/client";

import { BASE_PRICE_OVERRIDE_SCOPE } from "@/lib/base-price-overrides";
import { d1All, parseD1Json } from "@/lib/cloudflare/d1";
import {
  listD1ActiveCampuses,
  listD1PriceOverrides,
} from "@/lib/cloudflare/public-data";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { getExtensionPanelConfig } from "@/lib/extension-panel-config";
import { buildQuotePricingOptions } from "@/lib/pricing-options";
import { prisma } from "@/lib/prisma";
import { getQuoteMode } from "@/lib/runtime-modes";

const EXTENSION_RUNTIME_VERSION = "2026-06-18.caption-selector-v1";
const REQUIRED_EXTENSION_VERSION = "6.3.4";

function targetRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object"
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function hasSubjectPriceTarget(targetKeys: unknown) {
  const keys = targetRecord(targetKeys);
  const value =
    keys.subject_price_mxn ??
    keys.precio_por_materia ??
    keys.precioPorMateria ??
    keys.price_per_subject ??
    keys.subjectPriceMxn;
  if (value === null || value === undefined || value === "") return false;
  const numeric = Number(String(value).replace(/[$\s,]/g, ""));
  return Number.isFinite(numeric) && numeric >= 0;
}

function buildSubjectCountOptions(priceOverrides: Array<{ targetKeys: unknown }>) {
  return priceOverrides.some((override) => hasSubjectPriceTarget(override.targetKeys))
    ? [1, 2, 3, 4, 5, 6, 7]
    : [];
}

async function buildCloudflareExtensionQuoteRuntime() {
  const [priceOverrides, campuses, rules] = await Promise.all([
    listD1PriceOverrides(BASE_PRICE_OVERRIDE_SCOPE),
    listD1ActiveCampuses(),
    d1All<{
      business_line: string;
      modality: string;
      plan: number;
      programa_key: string | null;
    }>(
      `SELECT business_line, modality, plan, programa_key
       FROM scholarship_rule
       WHERE source_version = 'canonical'`,
    ).catch(() => []),
  ]);

  return {
    combinations: buildQuotePricingOptions(
      rules.map((rule) => ({
        businessLine: rule.business_line,
        modality: rule.modality,
        plan: Number(rule.plan),
        programaKey: rule.programa_key,
      })),
      priceOverrides.map((override) => ({
        ...override,
        targetKeys:
          typeof override.targetKeys === "string"
            ? parseD1Json(override.targetKeys, {})
            : override.targetKeys,
      })),
    ),
    campuses: campuses.map((campus) => ({
      value: campus.metaKey || campus.code || campus.name,
      label: campus.name,
    })),
    subjectCounts: buildSubjectCountOptions(priceOverrides),
  };
}

async function buildExtensionQuoteRuntime() {
  if (isCloudflareRuntime()) {
    return buildCloudflareExtensionQuoteRuntime();
  }

  const [priceOverrides, campuses] = await Promise.all([
    prisma.adminPriceOverride.findMany({
      where: {
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        isActive: true,
      },
      select: {
        id: true,
        scope: true,
        targetKeys: true,
        newPrice: true,
        isActive: true,
        notes: true,
        updatedBy: true,
      },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, code: true, metaKey: true, name: true, slug: true },
    }),
  ]);

  return {
    combinations: buildQuotePricingOptions([], priceOverrides),
    campuses: campuses.map((campus) => ({
      value: campus.metaKey || campus.code || campus.name,
      label: campus.name,
    })),
    subjectCounts: buildSubjectCountOptions(priceOverrides),
  };
}

export async function buildExtensionBootstrap(params: {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}) {
  const [panelConfig, quoteRuntime] = await Promise.all([
    getExtensionPanelConfig(),
    buildExtensionQuoteRuntime(),
  ]);
  const quoteMode = getQuoteMode();

  return {
    ok: true as const,
    runtimeVersion: EXTENSION_RUNTIME_VERSION,
    user: {
      id: params.user.id,
      email: params.user.email,
      role: params.user.role,
    },
    panelConfig,
    selectorPack: panelConfig.selectorPack,
    quoteRuntime,
    quoteMode,
    features: {
      liveQuote: true,
      panelConfigSync: true,
      whatsappWebShortcut: true,
      runTracking: true,
      selectorPackReady: true,
      whatsappTemplateDraft: true,
      whatsappDomInjection: true,
      campaignQueue: true,
      bulkDispatch: true,
      scheduledDispatch: true,
      campaignRecipientImport: true,
      campaignTemplateText: true,
      campaignMediaUrl: true,
      campaignDelayControl: true,
      campaignRunner: true,
      runnerHeartbeat: true,
      campaignReports: true,
      campaignPauseControl: true,
      campaignDeleteControl: true,
      campaignMediaUpload: true,
      campaignMediaCaptionCompose: true,
      campaignMediaStickerGuard: true,
      contactsDirectory: false,
      contactsHybridSheets: false,
    },
    mediaCaptionPolicy: {
      version: EXTENSION_RUNTIME_VERSION,
      requiredExtensionVersion: REQUIRED_EXTENSION_VERSION,
      patchInjection: "manifest_main_world",
      expectedPatchVersion: EXTENSION_RUNTIME_VERSION,
      attachmentMenu: "photos_videos",
      mode: "compose_caption",
      captionSource: "messageTemplate",
      stickerFallback: "blocked",
      documentFallbackText: "only_when_no_media",
      summary:
        "Las campañas con mediaUrl deben seleccionar Fotos y videos y enviar el texto como caption del adjunto; no se permite caer al flujo de stickers.",
    },
    docs: {
      mediaCaption: "/extension/campaign-media-caption",
    },
    automationApi: {
      campaigns: "/api/ext/campaigns",
      claimBatch: "/api/ext/campaigns/claim",
      reportDispatch: "/api/ext/campaigns/:campaignId/dispatch",
      runnerHeartbeat: "/api/ext/runner/heartbeat",
      updateCampaign: "/api/ext/campaigns/:campaignId",
      deleteCampaign: "/api/ext/campaigns/:campaignId",
      uploadAsset: "/api/ext/campaigns/upload",
      mediaAsset: "/api/ext/campaigns/media",
    },
  };
}
