import { type Role } from "@prisma/client";

import { getExtensionPanelConfig } from "@/lib/extension-panel-config";
import { getQuoteMode } from "@/lib/runtime-modes";

const EXTENSION_RUNTIME_VERSION = "2026-06-18.caption-selector-v1";
const REQUIRED_EXTENSION_VERSION = "6.3.4";

export async function buildExtensionBootstrap(params: {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}) {
  const panelConfig = await getExtensionPanelConfig();
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
